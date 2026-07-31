import type { JdAnalysis } from '../types'
import { filterHardSkills, filterJobDescTags } from './jdFilters'
import { type RequirementParts } from './jdParser'
import {
  extractSkillsFromSection,
  parseStructuredJD,
  splitNumberedBlocks,
  splitSoftSkillItems,
} from './jdStructure'
import { jdRawFingerprint } from './jdFingerprint'

export interface AnalyzeOptions {
  skillTags?: string[]
  requirementParts?: Partial<RequirementParts>
  responsibilityItems?: string[]
}

function summarizeCompany(intro: string): string {
  if (!intro.trim()) return ''
  const oneLine = intro.replace(/\s+/g, ' ').slice(0, 120)
  return oneLine.length < intro.length ? `${oneLine}…` : oneLine
}

function normalizeForDedupe(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/^【[^】]+】/, '')
    .replace(/^经验[：:\s]*/, '')
    .trim()
}

function dedupeBullets(items: string[]): string[] {
  const out: string[] = []
  for (const item of items) {
    const cleaned = item.trim().replace(/^[-·•*\d.、)）\s]+/, '')
    if (cleaned.length < 4) continue
    const norm = normalizeForDedupe(cleaned)
    if (!norm) continue
    const isDup = out.some((existing) => {
      const en = normalizeForDedupe(existing)
      return en === norm || en.includes(norm) || norm.includes(en)
    })
    if (!isDup) out.push(cleaned)
  }
  return out
}

/** 按分号/换行拆句（Boss「经验」段常为一整段用；分隔） */
function splitSentences(text: string): string[] {
  if (!text.trim()) return []
  return text
    .split(/[；;\n]+/)
    .map((s) =>
      s
        .trim()
        .replace(/^[-·•*\d.、)）\s]+/, '')
        .replace(/^经验[：:\s]*/, ''),
    )
    .filter((s) => s.length >= 6 && s.length < 400)
}

function bulletFromBlock(text: string): string[] {
  if (!text.trim()) return []
  const numbered = splitNumberedBlocks(text, 6)
  if (numbered.length >= 2) return dedupeBullets(numbered)

  const sentences = splitSentences(text)
  if (sentences.length >= 2) return dedupeBullets(sentences)

  const lines = text
    .split(/\n/)
    .map((l) => l.trim().replace(/^[-·•*\d.、)）\s]+/, '').replace(/^经验[：:\s]*/, ''))
    .filter((l) => l.length >= 6 && l.length < 300)
  return dedupeBullets(lines.length ? lines : [text.trim()]).slice(0, 8)
}

function extractProjectLines(experienceBlock: string): string[] {
  if (!experienceBlock.trim()) return []
  const sentences = splitSentences(experienceBlock)
  const candidates =
    sentences.length >= 2 ? sentences : bulletFromBlock(experienceBlock)
  return dedupeBullets(
    candidates.filter((l) =>
      /项目|作品|建模|RAG|AutoML|GitHub|竞赛|实习产出|课程项目|Agent|知识库/.test(l),
    ),
  )
}

/** 纯规则分类：按 Boss 段落结构拆栏，各栏互不重复 */
export function analyzeJDByRules(jdRaw: string, options: AnalyzeOptions = {}): JdAnalysis {
  const structured = parseStructuredJD(jdRaw, filterJobDescTags(options.skillTags ?? []))

  const parts = {
    education:
      options.requirementParts?.education?.trim() || structured.requirementParts.education,
    skills: options.requirementParts?.skills?.trim() || structured.requirementParts.skills,
    softSkills:
      options.requirementParts?.softSkills?.trim() || structured.requirementParts.softSkills,
    experience:
      options.requirementParts?.experience?.trim() || structured.requirementParts.experience,
  }

  const responsibilityItems =
    options.responsibilityItems?.length ?
      options.responsibilityItems
    : structured.responsibilityItems

  const education = dedupeBullets(bulletFromBlock(parts.education))
  const experience = dedupeBullets(bulletFromBlock(parts.experience))
  const projectRequirements = extractProjectLines(parts.experience)
  const softSkills = dedupeBullets(splitSoftSkillItems(parts.softSkills))
  const hardSkills = filterHardSkills(
    extractSkillsFromSection(parts.skills, filterJobDescTags(options.skillTags ?? [])),
  )

  const requirementsSummary = [
    parts.education && `【学历与专业】${parts.education.replace(/\n/g, ' ').slice(0, 160)}`,
    parts.skills && `【技能】${parts.skills.replace(/\n/g, ' ').slice(0, 160)}`,
    parts.softSkills && `【软性素质】${parts.softSkills.replace(/\n/g, ' ').slice(0, 120)}`,
    parts.experience && `【经验】${parts.experience.replace(/\n/g, ' ').slice(0, 160)}`,
  ].filter(Boolean) as string[]

  return {
    education,
    experience,
    hardSkills,
    softSkills,
    projectRequirements,
    responsibilities: dedupeBullets(
      responsibilityItems.length ?
        responsibilityItems
      : bulletFromBlock(structured.responsibilities),
    ),
    requirements: dedupeBullets(
      requirementsSummary.length ?
        requirementsSummary
      : bulletFromBlock(structured.requirements),
    ),
    companySummary: summarizeCompany(structured.companyIntro),
    analyzedAt: new Date().toISOString(),
    source: 'rules',
    jdRawFingerprint: jdRawFingerprint(jdRaw),
  }
}

export function emptyJdAnalysis(): JdAnalysis {
  return {
    education: [],
    experience: [],
    hardSkills: [],
    softSkills: [],
    projectRequirements: [],
    responsibilities: [],
    requirements: [],
    companySummary: '',
  }
}

export function mergeSkillsFromAnalysis(analysis: JdAnalysis, existing: string[]): string[] {
  return filterHardSkills([...existing, ...analysis.hardSkills])
}
