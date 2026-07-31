/** JD 分类去重：同一段落不在多个栏重复出现 */

export function normalizeForDedupe(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/^【[^】]+】/, '')
    .replace(/^经验[：:\s]*/, '')
    .replace(/^[：:\s]+/, '')
    .trim()
    .toLowerCase()
}

export function isDuplicateText(a: string, b: string): boolean {
  const na = normalizeForDedupe(a)
  const nb = normalizeForDedupe(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const minLen = Math.min(na.length, nb.length)
  if (minLen < 8) return na === nb
  if (na.includes(nb) || nb.includes(na)) return true
  if (na.slice(0, 24) === nb.slice(0, 24)) return true
  return false
}

export function dedupeBullets(items: string[]): string[] {
  const out: string[] = []
  for (const item of items) {
    const cleaned = item.trim().replace(/^[-·•*\d.、)）\s]+/, '')
    if (cleaned.length < 4) continue
    if (out.some((existing) => isDuplicateText(existing, cleaned))) continue
    out.push(cleaned)
  }
  return out
}

type SectionKey =
  | 'education'
  | 'projectRequirements'
  | 'experience'
  | 'softSkills'
  | 'hardSkills'
  | 'responsibilities'
  | 'requirements'

/** 按优先级保留首次出现，从后续栏目移除重复段落 */
export function dedupeAcrossSections(
  sections: Partial<Record<SectionKey, string[]>>,
  order: SectionKey[] = [
    'education',
    'projectRequirements',
    'experience',
    'softSkills',
    'responsibilities',
    'requirements',
  ],
): Partial<Record<SectionKey, string[]>> {
  const kept: string[] = []
  const result: Partial<Record<SectionKey, string[]>> = {}

  for (const key of order) {
    const items = sections[key] ?? []
    const filtered: string[] = []
    for (const item of items) {
      const trimmed = item.trim()
      if (!trimmed) continue
      if (kept.some((k) => isDuplicateText(k, trimmed))) continue
      filtered.push(trimmed)
      kept.push(trimmed)
    }
    result[key] = filtered
  }

  if (sections.hardSkills?.length) {
    result.hardSkills = [...new Set(sections.hardSkills.map((s) => s.trim()).filter(Boolean))].filter(
      (skill) => !kept.some((p) => isDuplicateText(p, skill)),
    )
  }

  return result
}
