import { filterHardSkills, filterJobDescTags } from './jdFilters'
import {
  parseStructuredJD,
  splitMainBlocks,
  type RequirementParts,
  type StructuredJD,
} from './jdStructure'

export type { RequirementParts, StructuredJD }

export interface ParsedJD {
  name: string
  position: string
  location: string
  salary: string
  requirements: string
  responsibilities: string
  companyIntro: string
  skills: string[]
  structured: StructuredJD
}

export interface JDSections {
  responsibilities: string
  requirements: string
  companyIntro: string
  other: string
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ''
}

/** 按 Boss 直聘常见小标题切分 JD（兼容旧逻辑） */
export function parseJDSections(text: string): JDSections {
  const blocks = splitMainBlocks(text)
  return {
    responsibilities: blocks.responsibilities,
    requirements: blocks.requirements,
    companyIntro: blocks.companyIntro,
    other: '',
  }
}

export function parseJDText(text: string, pageTags: string[] = []): ParsedJD {
  const filteredTags = filterJobDescTags(pageTags)
  const structured = parseStructuredJD(text, filteredTags)
  const skills = filterHardSkills(structured.skillList)

  const salary = firstMatch(text, [
    /(\d+[kK]?[-~至]\d+[kK]?(?:·\d+薪)?)/,
    /((?:\d+[-~至]\d+|\d+)元(?:\/月)?)/,
  ])

  const location = firstMatch(text, [
    /(?:工作地[点址]|地点)[：:\s]*([^\n]+)/,
    /(?:^|\n)地点[：:\s]*([^\n]+)/,
  ])

  const position = firstMatch(text, [
    /(?:^|\n)岗位[：:\s]*([^\n]+)/,
    /(?:职位|岗位|招聘)[：:\s]*([^\n]+)/,
    /^([^\n]{2,40}(?:工程师|开发|算法|产品|运营|设计|实习|专员|分析师))/m,
  ])

  const name = firstMatch(text, [
    /(?:^|\n)公司[：:\s]*([^\n]+)/,
    /(?:公司|企业)[：:\s]*([^\n]+)/,
  ])

  return {
    name,
    position,
    location,
    salary,
    requirements: structured.requirements,
    responsibilities: structured.responsibilities,
    companyIntro: structured.companyIntro,
    skills,
    structured,
  }
}

/** 表单字段：空则留空，绝不把全文塞进某一栏 */
export function parsedToFormFields(parsed: ParsedJD) {
  return {
    name: parsed.name,
    position: parsed.position,
    location: parsed.location,
    salary: parsed.salary,
    requirements: parsed.requirements,
    responsibilities: parsed.responsibilities,
    skills: parsed.skills,
  }
}

/** 若某段与全文几乎相同，视为未分段，优先用较短的有效片段 */
export function pickSectionText(section: string, parsed: string, jdRaw: string): string {
  const jdLen = jdRaw.trim().length
  if (jdLen < 20) return parsed.trim() || section.trim()

  const candidates = [parsed.trim(), section.trim()].filter(Boolean)
  for (const text of candidates) {
    if (text.length < jdLen * 0.85) return text
  }
  return parsed.trim() || section.trim()
}

export function mergeRequirementParts(
  fromPayload?: Partial<RequirementParts>,
  fromParse?: RequirementParts,
): RequirementParts {
  return {
    education: fromPayload?.education?.trim() || fromParse?.education || '',
    skills: fromPayload?.skills?.trim() || fromParse?.skills || '',
    softSkills: fromPayload?.softSkills?.trim() || fromParse?.softSkills || '',
    experience: fromPayload?.experience?.trim() || fromParse?.experience || '',
  }
}
