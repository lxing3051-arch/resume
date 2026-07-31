import type { CompanyFormData } from './companyForm'
import { initSkillRatings } from './companyForm'
import { parseJDText, pickSectionText } from './jdParser'
import { analyzeJDByRules, mergeSkillsFromAnalysis } from './jdAnalyzer'
import {
  decodeImportPayload,
  isExtensionImportPayload,
  type ExtensionImportPayload,
} from './extensionImport'

export const EXTENSION_IMPORT_EVENT = 'job-tracker-import'
export const POST_MESSAGE_TYPE = 'JOB_TRACKER_IMPORT'
export const PENDING_KEY = 'job-tracker-pending-import'

let initialized = false

export function stashExtensionImport(payload: ExtensionImportPayload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota errors */
  }
}

export function consumePendingExtensionImport(): ExtensionImportPayload | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_KEY)
    const data = JSON.parse(raw) as unknown
    if (isExtensionImportPayload(data)) return data
  } catch {
    /* ignore */
  }
  return null
}

export function extensionPayloadToForm(
  payload: ExtensionImportPayload,
  current: CompanyFormData,
): Partial<CompanyFormData> {
  const parsed = parseJDText(payload.jdRaw, payload.skillTags ?? [])
  const skills = parsed.skills.length ? parsed.skills : current.skills
  const analysis = analyzeJDByRules(payload.jdRaw, {
    skillTags: payload.skillTags,
    requirementParts: payload.requirementParts,
    responsibilityItems: payload.responsibilityItems,
  })
  const mergedSkills = mergeSkillsFromAnalysis(analysis, skills)

  return {
    name: payload.name || parsed.name || current.name,
    position: payload.position || parsed.position || current.position,
    location: payload.location || parsed.location || current.location,
    salary: payload.salary || parsed.salary || current.salary,
    jdRaw: payload.jdRaw,
    requirements: pickSectionText(payload.requirements ?? '', parsed.requirements, payload.jdRaw),
    responsibilities: pickSectionText(
      payload.responsibilities ?? '',
      parsed.responsibilities,
      payload.jdRaw,
    ),
    bossUrl: payload.bossUrl || current.bossUrl,
    skills: mergedSkills,
    skillRatings: initSkillRatings(mergedSkills, current.skillRatings),
    jdAnalysis: analysis,
  }
}

export async function importFromClipboard(
  current: CompanyFormData,
): Promise<Partial<CompanyFormData> | null> {
  if (!navigator.clipboard?.readText) return null
  const text = await navigator.clipboard.readText()
  const payload = decodeImportPayload(text)
  if (!payload) return null
  return extensionPayloadToForm(payload, current)
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
