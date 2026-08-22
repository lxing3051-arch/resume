import type { GeminiSettings } from '../types'

const KEY = 'job-tracker-gemini'

const DEFAULTS: GeminiSettings = {
  apiKey: '',
  model: 'gemini-2.5-flash',
}

/** 仅作 API 拉取失败时的兜底 */
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const

function isTextGenerationModel(id: string): boolean {
  if (id.includes('embedding') || id.includes('tts') || id.includes('aqa')) return false
  if (id.includes('image') || id.includes('imagen')) return false
  return true
}

function rankModel(id: string): number {
  if (id === 'gemini-2.5-flash' || id === 'gemini-2.5-flash-latest') return 0
  if (id.startsWith('gemini-2.5-pro')) return 1
  if (id.includes('2.5') && id.includes('flash-lite')) return 2
  if (id.includes('2.5') && id.includes('flash')) return 3
  if (id.includes('2.0') && id.includes('flash')) return 8
  if (id.includes('1.5')) return 9
  return 10
}

export function pickBestTextModel(models: string[]): string {
  const text = models.filter(isTextGenerationModel).sort((a, b) => rankModel(a) - rankModel(b))
  return text[0] ?? models[0] ?? DEFAULTS.model
}

export function getGeminiSettings(): GeminiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) } as GeminiSettings
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

export function saveGeminiSettings(settings: GeminiSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function isGeminiConfigured(): boolean {
  return getGeminiSettings().apiKey.trim().length > 0
}

const API_BASE =
  import.meta.env.DEV ?
    '/gemini-api/v1beta'
  : 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiContent {
  role?: string
  parts: Array<{ text: string }>
}

interface GeminiResponsePart {
  text?: string
  /** Gemini 2.5 会将模型推理以独立 part 返回，不能直接展示给用户。 */
  thought?: boolean
}

export function extractGeminiFinalText(data: {
  candidates?: Array<{ content?: { parts?: GeminiResponsePart[] } }>
}): string {
  const parts = data.candidates?.[0]?.content?.parts ?? []
  // Gemini 有时先返回 thought part，再返回最终答案。旧逻辑拿了第一段，
  // 因而把英文推理草稿显示在“询问 AI”区域。
  const finalText = parts
    .filter((part) => !part.thought)
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
  if (finalText) return finalText

  // 兼容不带 thought 标记的旧模型响应。
  return parts.map((part) => part.text?.trim() ?? '').filter(Boolean).join('\n')
}

async function geminiFetch(path: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${path}`
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('x-goog-api-key', apiKey)

  let res = await fetch(url, { ...init, headers })

  if ((res.status === 401 || res.status === 403 || res.status === 404) && apiKey.startsWith('AQ.')) {
    const join = path.includes('?') ? '&' : '?'
    res = await fetch(`${url}${join}key=${encodeURIComponent(apiKey)}`, {
      ...init,
      headers: { 'Content-Type': headers.get('Content-Type') ?? 'application/json' },
    })
  }

  return res
}

function shouldTryNextModel(errorMessage: string, status?: number): boolean {
  const msg = errorMessage.toLowerCase()
  return (
    status === 404 ||
    status === 429 ||
    msg.includes('not found') ||
    msg.includes('quota exceeded') ||
    msg.includes('limit: 0') ||
    msg.includes('invalid_argument')
  )
}

async function geminiRequest(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  let res: Response
  try {
    res = await geminiFetch(`/models/${encodeURIComponent(model)}:generateContent`, apiKey, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (e) {
    const hint =
      e instanceof TypeError ?
        '网络/CORS 错误：请用 npm run dev 本地打开设置页测试 Gemini。'
      : ''
    throw new Error(hint || (e instanceof Error ? e.message : '网络请求失败'))
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    const detail = err.error?.message ?? `Gemini 请求失败 (${res.status})`
    const retry = shouldTryNextModel(detail, res.status)
    throw new Error(retry ? `__RETRY__:${detail}` : detail)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiResponsePart[] } }>
  }
  const text = extractGeminiFinalText(data)
  if (!text) throw new Error('Gemini 返回为空')
  return text
}

export function validateGeminiApiKey(apiKey: string): string | null {
  const key = apiKey.trim()
  if (!key) return '请先填写 API Key'
  if (key.startsWith('AIza')) return null
  if (key.startsWith('AQ.')) return null
  return 'Key 格式异常：通常以 AIza 或 AQ. 开头，请确认复制完整'
}

/** 从 Google API 拉取当前 Key 可用的 generateContent 模型 */
export async function listGeminiModels(apiKey?: string): Promise<string[]> {
  const key = (apiKey ?? getGeminiSettings().apiKey).trim()
  if (!key) return [...GEMINI_MODELS]

  let res: Response
  try {
    res = await geminiFetch('/models', key)
  } catch {
    return [...GEMINI_MODELS]
  }
  if (!res.ok) return [...GEMINI_MODELS]

  const data = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
  }

  const ids =
    data.models
      ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter(isTextGenerationModel)
      .sort((a, b) => rankModel(a) - rankModel(b)) ?? []

  return ids.length > 0 ? ids : [...GEMINI_MODELS]
}

async function listGeminiModelsStrict(
  apiKey: string,
): Promise<{ ok: true; models: string[] } | { ok: false; status: number; message: string }> {
  try {
    const res = await geminiFetch('/models', apiKey.trim())
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      return {
        ok: false,
        status: res.status,
        message: err.error?.message ?? `无法列出模型 (${res.status})`,
      }
    }
    const models = await listGeminiModels(apiKey)
    return { ok: true, models }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : '网络错误',
    }
  }
}

export async function geminiQuickCheck(apiKey?: string): Promise<boolean> {
  const key = (apiKey ?? getGeminiSettings().apiKey).trim()
  if (!key) return false
  try {
    const res = await geminiFetch('/models', key)
    return res.ok
  } catch {
    return false
  }
}

export async function checkGeminiAvailable(): Promise<boolean> {
  return geminiQuickCheck()
}

export async function geminiGenerateJson<T>(prompt: string): Promise<T> {
  const { apiKey, model } = getGeminiSettings()
  if (!apiKey.trim()) throw new Error('请先在设置中填写 Gemini API Key')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }

  const listed = await listGeminiModels(apiKey)
  const preferred = pickBestTextModel(listed)
  const candidates = [
    ...new Set([...(listed.includes(model) ? [model] : []), preferred, ...listed]),
  ].slice(0, 6)

  let lastError = 'Gemini 请求失败'

  for (const m of candidates) {
    try {
      const text = await geminiRequest(m, apiKey, body)
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      saveGeminiSettings({ ...getGeminiSettings(), model: m })
      return JSON.parse(cleaned) as T
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Gemini 请求失败'
      lastError = raw.startsWith('__RETRY__:') ? raw.slice('__RETRY__:'.length) : raw
      if (!raw.startsWith('__RETRY__:')) break
    }
  }

  throw new Error(lastError)
}

export async function geminiChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { maxOutputTokens?: number },
): Promise<string> {
  const { apiKey, model } = getGeminiSettings()
  if (!apiKey.trim()) throw new Error('请先在设置中填写 Gemini API Key')

  const system = messages.find((m) => m.role === 'system')?.content
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: options?.maxOutputTokens ?? 2048 },
  }
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] }
  }

  return geminiRequest(model, apiKey, body)
}

export async function testGeminiConnection(): Promise<string> {
  const { apiKey, model } = getGeminiSettings()
  const formatErr = validateGeminiApiKey(apiKey)
  if (formatErr) throw new Error(formatErr)

  const key = apiKey.trim()
  const listed = await listGeminiModelsStrict(key)

  if (!listed.ok) {
    const devHint =
      import.meta.env.DEV ?
        ' 若刚更新代码，请先 Ctrl+C 停掉 dev 再重新 npm run dev。'
      : ' 请改用 npm run dev 在本地测试 Gemini。'
    throw new Error(`${listed.message}${devHint}`)
  }

  const fromApi = listed.models.filter(isTextGenerationModel)
  if (fromApi.length === 0) {
    throw new Error('Key 有效但未找到可用的文本模型。')
  }

  // 只尝试 API 返回的模型（你的 Key 对 2.0/1.5 可能是 limit:0）
  const preferred = pickBestTextModel(fromApi)
  const candidates = [
    ...new Set([
      ...(fromApi.includes(model) ? [model] : []),
      preferred,
      ...fromApi,
    ]),
  ]

  let lastError = '连接失败'

  for (const m of candidates) {
    try {
      await geminiRequest(m, key, {
        contents: [{ role: 'user', parts: [{ text: 'reply ok' }] }],
        generationConfig: { maxOutputTokens: 16 },
      })
      saveGeminiSettings({ ...getGeminiSettings(), model: m })
      return `已连接 Gemini（${m}）· 你的 Key 可用 ${fromApi.length} 个文本模型`
    } catch (e) {
      const raw = e instanceof Error ? e.message : '连接失败'
      lastError = raw.startsWith('__RETRY__:') ? raw.slice('__RETRY__:'.length) : raw
      if (!raw.startsWith('__RETRY__:')) break
    }
  }

  throw new Error(
    `${lastError}。请在下拉框选择：${fromApi.slice(0, 4).join('、')}（不要选 2.0/1.5，你的免费额度可能为 0）`,
  )
}
