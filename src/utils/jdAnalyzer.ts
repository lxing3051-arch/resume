import type { JdAnalysis } from '../types'
import { filterHardSkills, filterJobDescTags } from './jdFilters'
import { type RequirementParts } from './jdParser'
import {
  extractSkillsFromSection,
  parseStructuredJD,
} from './jdStructure'
import { buildDedupedSections, extractJobBlocks } from './jdTextSections'
import { jdRawFingerprint } from './jdFingerprint'

export interface AnalyzeOptions {
  skillTags?: string[]
  requirementParts?: Partial<RequirementParts>
  responsibilityItems?: string[]
  responsibilities?: string
  requirements?: string
}

// 改动分段规则后，旧的规则分类必须自动重算，不能继续展示缓存的逐句卡片。
export const JD_RULES_VERSION = '2026-08-18.4'

export function needsRuleRefresh(analysis: JdAnalysis | undefined): boolean {
  // AI 只负责补充技能和摘要，卡片层级始终由原文分段规则决定。
  // 因此旧版 AI 结果（没有规则版本）也必须刷新，不能继续把逐句数组直接展示出来。
  return Boolean(analysis) && analysis?.rulesVersion !== JD_RULES_VERSION
}

function summarizeCompany(intro: string): string {
  if (!intro.trim()) return ''
  const oneLine = intro.replace(/\s+/g, ' ').slice(0, 120)
  return oneLine.length < intro.length ? `${oneLine}…` : oneLine
}

function emptyLegacyArrays() {
  return {
    education: [] as string[],
    experience: [] as string[],
    hardSkills: [] as string[],
    softSkills: [] as string[],
    projectRequirements: [] as string[],
    responsibilities: [] as string[],
    requirements: [] as string[],
  }
}

/** 按 Boss 结构：岗位职责 + 任职要求，各含 1.2.3. 编号小块 */
export function analyzeJDByRules(jdRaw: string, options: AnalyzeOptions = {}): JdAnalysis {
  const structured = parseStructuredJD(jdRaw, filterJobDescTags(options.skillTags ?? []))
  const genericBlocks = extractJobBlocks(jdRaw)
  const lines = jdRaw.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
  const hasResponsibilityHeading = lines.some((line) => /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述)\s*[：:]?$/.test(line))
  const hasRequirementHeading = lines.some((line) => /^(?:任职要求|职位要求|岗位要求|任职资格|任职条件|你需要|我们希望你|我们期待你|你将负责)\s*[：:]?$/.test(line))

  // 完整 JD 中重新分出的区块优先级最高。旧插件可能把整段内容错误塞入
  // responsibilities；若先相信该字段，网页端的新分段规则就永远不会生效。
  let respText = genericBlocks.responsibilities.trim() || options.responsibilities?.trim() ||
    (hasResponsibilityHeading ? genericBlocks.responsibilities : structured.responsibilities)
  let reqText = genericBlocks.requirements.trim() || options.requirements?.trim() ||
    (hasRequirementHeading ? genericBlocks.requirements : structured.requirements)

  if (options.requirementParts) {
    const p = options.requirementParts
    if (p.education || p.skills || p.softSkills || p.experience) {
      reqText = [
        p.education && `1.学历与专业\n${p.education}`,
        p.skills && `2.技能\n${p.skills}`,
        p.softSkills && `3.软性素质\n${p.softSkills}`,
        p.experience && `4.经验\n${p.experience}`,
      ]
        .filter(Boolean)
        .join('\n\n')
    }
  }

  let responsibilitySections = buildDedupedSections(respText, '岗位职责')
  let requirementSections = buildDedupedSections(reqText, '任职要求')

  if (!responsibilitySections.length && respText.trim()) {
    responsibilitySections = [{ index: 1, title: '岗位职责', items: [respText.replace(/\n+/g, ' ').trim()] }]
  }
  if (!requirementSections.length && reqText.trim()) {
    requirementSections = [{ index: 1, title: '任职要求', items: [reqText.replace(/\n+/g, ' ').trim()] }]
  }

  const skillBlock = requirementSections.find((s) => /技能/.test(s.title))
  const hardSkills = filterHardSkills(
    extractSkillsFromSection(
      skillBlock?.items.join('\n') ?? '',
      filterJobDescTags(options.skillTags ?? []),
    ),
  )

  return {
    responsibilitySections,
    requirementSections,
    ...emptyLegacyArrays(),
    hardSkills,
    companySummary: summarizeCompany(structured.companyIntro),
    analyzedAt: new Date().toISOString(),
    source: 'rules',
    rulesVersion: JD_RULES_VERSION,
    jdRawFingerprint: jdRawFingerprint(jdRaw),
  }
}

export function emptyJdAnalysis(): JdAnalysis {
  return {
    responsibilitySections: [],
    requirementSections: [],
    ...emptyLegacyArrays(),
    companySummary: '',
  }
}

export function mergeSkillsFromAnalysis(analysis: JdAnalysis, existing: string[]): string[] {
  return filterHardSkills([...existing, ...analysis.hardSkills])
}

/** 旧版分析无 sections 时，用 jdRaw 重算 */
export function ensureStructuredAnalysis(analysis: JdAnalysis | undefined, jdRaw: string): JdAnalysis {
  if ((analysis?.responsibilitySections?.length || analysis?.requirementSections?.length) && !needsRuleRefresh(analysis)) {
    return analysis
  }
  if (!jdRaw.trim()) return analysis ?? emptyJdAnalysis()
  return analyzeJDByRules(jdRaw)
}
