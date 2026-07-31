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

/** 是否属于「项目/作品」类要求（区别于一般实习经验） */
export function isProjectRequirementLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  // 一般实习/工作年限 → 经验栏，不是项目栏
  if (/实习经验|工作经历|从业经验|年以上/.test(t) && !/项目作品|课程项目|建模项目/.test(t)) {
    return false
  }
  if (/项目作品|完整.*项目|课程项目|竞赛|实习产出|GitHub|附上简要说明|建模项目|数据分析项目/.test(t)) {
    return true
  }
  if (/RAG|AutoML|Agent|知识库/.test(t) && /项目|实践/.test(t)) return true
  return false
}

/** 是否为旧版「【学历】摘要」格式，不应再展示 */
export function isTaggedSummaryLine(line: string): boolean {
  return /^【[^】]+】/.test(line.trim())
}

export function stripTaggedSummaries(items: string[]): string[] {
  return items.filter((l) => !isTaggedSummaryLine(l))
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
