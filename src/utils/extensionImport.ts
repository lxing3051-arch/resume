export const IMPORT_MARKER = 'JOB_TRACKER_IMPORT:'

export interface RequirementPartsPayload {
  education?: string
  skills?: string
  softSkills?: string
  experience?: string
}

export interface ExtensionImportPayload {
  source: 'boss-zhipin'
  name: string
  position: string
  location?: string
  salary?: string
  jdRaw: string
  bossUrl: string
  requirements?: string
  responsibilities?: string
  /** 插件已拆好的任职要求四小节 */
  requirementParts?: RequirementPartsPayload
  /** 岗位职责 1.2.3. 大点 */
  responsibilityItems?: string[]
  /** Boss 页面技能标签 */
  skillTags?: string[]
  scrapedAt: string
}

export function encodeImportPayload(payload: ExtensionImportPayload): string {
  return IMPORT_MARKER + JSON.stringify(payload)
}

export function decodeImportPayload(text: string): ExtensionImportPayload | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith(IMPORT_MARKER)) return null
  try {
    return JSON.parse(trimmed.slice(IMPORT_MARKER.length)) as ExtensionImportPayload
  } catch {
    return null
  }
}

export function isExtensionImportPayload(value: unknown): value is ExtensionImportPayload {
  if (!value || typeof value !== 'object') return false
  const p = value as ExtensionImportPayload
  return p.source === 'boss-zhipin' && typeof p.jdRaw === 'string'
}
