import { getAiSettings } from './aiSettings'
import { geminiChat, geminiGenerateJson, isGeminiConfigured, checkGeminiAvailable } from './gemini'
import { getOllamaSettings } from './ollamaSettings'
import { checkOllamaAvailable } from './ollama'

export type ResolvedProvider = 'gemini' | 'ollama'

async function resolveProvider(prefer?: ResolvedProvider): Promise<ResolvedProvider | null> {
  const { provider } = getAiSettings()
  const geminiOk = isGeminiConfigured() && (await checkGeminiAvailable())
  const ollamaOk = getOllamaSettings().enabled && (await checkOllamaAvailable())

  if (provider === 'gemini') return geminiOk ? 'gemini' : null
  if (provider === 'ollama') return ollamaOk ? 'ollama' : null

  // auto: prefer gemini
  if (prefer === 'ollama') return ollamaOk ? 'ollama' : geminiOk ? 'gemini' : null
  if (geminiOk) return 'gemini'
  if (ollamaOk) return 'ollama'
  return null
}

export function isAiConfigured(): boolean {
  const { provider } = getAiSettings()
  if (provider === 'gemini') return isGeminiConfigured()
  if (provider === 'ollama') return getOllamaSettings().enabled
  return isGeminiConfigured() || getOllamaSettings().enabled
}

export async function isAiAvailable(): Promise<boolean> {
  return (await resolveProvider()) !== null
}

export async function getActiveProviderLabel(): Promise<string> {
  const p = await resolveProvider()
  if (p === 'gemini') return 'Gemini Pro'
  if (p === 'ollama') return 'Ollama 本地'
  return '未连接'
}

export async function aiGenerateJson<T>(prompt: string): Promise<T> {
  const provider = await resolveProvider()
  if (!provider) {
    throw new Error('AI 未就绪：请配置 Gemini API Key 或启动 Ollama')
  }

  if (provider === 'gemini') {
    try {
      return await geminiGenerateJson<T>(prompt)
    } catch (e) {
      if (getAiSettings().provider === 'auto' && getOllamaSettings().enabled) {
        return ollamaGenerateJson<T>(prompt)
      }
      throw e
    }
  }

  return ollamaGenerateJson<T>(prompt)
}

export async function aiChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const provider = await resolveProvider()
  if (!provider) {
    throw new Error('AI 未就绪：请配置 Gemini API Key 或启动 Ollama')
  }

  if (provider === 'gemini') {
    try {
      return await geminiChat(messages)
    } catch (e) {
      if (getAiSettings().provider === 'auto' && getOllamaSettings().enabled) {
        return ollamaChat(messages)
      }
      throw e
    }
  }

  return ollamaChat(messages)
}

async function ollamaGenerateJson<T>(prompt: string): Promise<T> {
  const { baseUrl, model } = getOllamaSettings()
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
  })
  if (!res.ok) throw new Error(`Ollama 请求失败 (${res.status})`)
  const data = (await res.json()) as { response: string }
  return JSON.parse(data.response) as T
}

async function ollamaChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const { baseUrl, model } = getOllamaSettings()
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama 对话失败 (${res.status})`)
  const data = (await res.json()) as { message?: { content: string } }
  return data.message?.content?.trim() ?? ''
}
