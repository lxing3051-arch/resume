import type { JdAnalysis } from '../types'
import { filterHardSkills, filterJobDescTags } from './jdFilters'
import {
  dedupeAcrossSections,
  dedupeBullets,
  isProjectRequirementLine,
  stripTaggedSummaries,
} from './jdDedupe'
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

/** 经验段拆成：一般实习经验 vs 项目/作品要求（互斥） */
function splitExperienceBlock(experienceBlock: string): {
  experience: string[]
  projectRequirements: string[]
} {
  const all = dedupeBullets(bulletFromBlock(experienceBlock))
  const projectRequirements = all.filter(isProjectRequirementLine)
  const experience = all.filter((l) => !isProjectRequirementLine(l))
  return { experience, projectRequirements }
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

  const { experience, projectRequirements } = splitExperienceBlock(parts.experience)

  const hasStructuredGrid = Boolean(
    parts.education ||
      parts.skills ||
      parts.softSkills ||
      parts.experience ||
      responsibilityItems.length,
  )

  const merged = dedupeAcrossSections({
    education: dedupeBullets(bulletFromBlock(parts.education)),
    projectRequirements,
    experience,
    softSkills: dedupeBullets(splitSoftSkillItems(parts.softSkills)),
    hardSkills: filterHardSkills(
      extractSkillsFromSection(parts.skills, filterJobDescTags(options.skillTags ?? [])),
    ),
    responsibilities: dedupeBullets(
      responsibilityItems.length ?
        responsibilityItems
      : bulletFromBlock(structured.responsibilities),
    ),
    requirements:
      hasStructuredGrid ?
        []
      : stripTaggedSummaries(dedupeBullets(bulletFromBlock(structured.requirements))),
  })

  return {
    education: merged.education ?? [],
    experience: merged.experience ?? [],
    hardSkills: merged.hardSkills ?? [],
    softSkills: merged.softSkills ?? [],
    projectRequirements: merged.projectRequirements ?? [],
    responsibilities: merged.responsibilities ?? [],
    requirements: merged.requirements ?? [],
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
