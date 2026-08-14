import type { CompanyFormData } from './companyForm'
import { parseJDText, pickSectionText } from './jdParser'
import { analyzeJDByRules, mergeSkillsFromAnalysis } from './jdAnalyzer'
import { classifyJobText } from './jobTextClassifier'
import {
  decodeImportPayload,
  isExtensionImportPayload,
  type ExtensionImportPayload,
} from './extensionImport'

export const EXTENSION_IMPORT_EVENT = 'job-tracker-import'
export const POST_MESSAGE_TYPE = 'JOB_TRACKER_IMPORT'
export const PENDING_KEY = 'job-tracker-pending-import'

let initialized = false

// 通用网页的 <title> 往往是「校园招聘」「核心业务」等导航文案，不能直接写进表单。
const ROLE_WORD = /(?:工程师|开发|算法|产品|运营|设计|分析师|专员|顾问|实习生|管培生|经理|研究员|测试|招聘|销售|市场|商务|财务|法务|编辑|策划)/
const BAD_IDENTITY_TEXT = /(?:核心业务|校园(?:招聘|校招)?|快手校招|加入我们|相关职位|相关网站|联系我们|职位\s*ID|研发平台|广告产品)/
const GENERIC_POSITION_TEXT = /^(?:核心业务|校园(?:招聘|校招)?|校招|快手校招|加入我们|相关职位|相关网站|联系我们|职位\s*ID|研发平台|广告产品)$/
const isPlausibleCompany = (value: string) => value.trim().length >= 2 && value.trim().length <= 30 && !BAD_IDENTITY_TEXT.test(value) && !ROLE_WORD.test(value)
const isPlausiblePosition = (value: string) => value.trim().length >= 2 && value.trim().length <= 80 && !GENERIC_POSITION_TEXT.test(value.trim()) && ROLE_WORD.test(value)

export function stashExtensionImport(payload: ExtensionImportPayload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota errors */
  }
}

/** 读取待导入数据，但不删除（避免 React 严格模式/重复挂载丢数据） */
export function peekPendingExtensionImport(): ExtensionImportPayload | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (isExtensionImportPayload(data)) return data
  } catch {
    /* ignore */
  }
  return null
}

export function clearPendingExtensionImport() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function consumePendingExtensionImport(): ExtensionImportPayload | null {
  const data = peekPendingExtensionImport()
  if (data) clearPendingExtensionImport()
  return data
}

export function extensionPayloadToForm(
  payload: ExtensionImportPayload,
  current: CompanyFormData,
): Partial<CompanyFormData> {
  const parsed = parseJDText(payload.jdRaw, payload.skillTags ?? [])
  const classified = classifyJobText(payload.jdRaw, current)?.patch
  const skills = parsed.skills.length ? parsed.skills : current.skills
  const analysis = analyzeJDByRules(payload.jdRaw, {
    skillTags: payload.skillTags,
    requirementParts: payload.requirementParts,
    responsibilityItems: payload.responsibilityItems,
  })
  const mergedSkills = mergeSkillsFromAnalysis(analysis, skills)

  // Boss 插件有时把「公司名称」前缀写进 name
  const cleanName = (isPlausibleCompany(payload.name) ? payload.name : (classified?.name || parsed.name || current.name))
    .replace(/^公司名称\s*/, '')
    .trim()

  return {
    name: cleanName,
    position: isPlausiblePosition(payload.position) ? payload.position : (classified?.position || parsed.position || current.position),
    location: payload.location || parsed.location || current.location,
    salary: payload.salary || parsed.salary || current.salary,
    jdRaw: payload.jdRaw,
    // 优先使用统一分类器的结果：它会排除官网底部和「相关职位」等非 JD 内容。
    requirements: classified?.requirements || pickSectionText(payload.requirements ?? '', parsed.requirements, payload.jdRaw),
    responsibilities: classified?.responsibilities || pickSectionText(
      payload.responsibilities ?? '',
      parsed.responsibilities,
      payload.jdRaw,
    ),
    bossUrl: payload.bossUrl || current.bossUrl,
    skills: mergedSkills,
    jdAnalysis: analysis,
  }
}

export async function importFromClipboard(
  current: CompanyFormData,
): Promise<Partial<CompanyFormData> | null> {
  if (!navigator.clipboard?.readText) return null
  const text = await navigator.clipboard.readText()
  const payload = decodeImportPayload(text)
  if (payload) return extensionPayloadToForm(payload, current)
  return classifyJobText(text, current)?.patch ?? null
}

export function dispatchExtensionImport(payload: ExtensionImportPayload) {
  stashExtensionImport(payload)
  window.dispatchEvent(new CustomEvent(EXTENSION_IMPORT_EVENT, { detail: payload }))
}

export function subscribeExtensionImport(
  onImport: (payload: ExtensionImportPayload) => void,
): () => void {
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (isExtensionImportPayload(detail)) onImport(detail)
  }
  window.addEventListener(EXTENSION_IMPORT_EVENT, onEvent)
  return () => {
    window.removeEventListener(EXTENSION_IMPORT_EVENT, onEvent)
  }
}

/** 应用启动时调用，尽早监听插件消息 */
export function initExtensionBridge() {
  if (initialized) return
  initialized = true

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== POST_MESSAGE_TYPE) return
    if (!isExtensionImportPayload(event.data.payload)) return
    dispatchExtensionImport(event.data.payload)
  })

  window.__JOB_TRACKER__ = { dispatchImport: dispatchExtensionImport }
}

declare global {
  interface Window {
    __JOB_TRACKER__?: {
      dispatchImport: typeof dispatchExtensionImport
    }
  }
}

initExtensionBridge()
