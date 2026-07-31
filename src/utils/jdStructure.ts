import {
  filterHardSkills,
  filterJobDescTags,
  isEmployeeBenefit,
  looksLikeTechnicalSkill,
} from './jdFilters'
import { dedupeBullets } from './jdDedupe'
export interface RequirementParts {
  education: string
  skills: string
  softSkills: string
  experience: string
}

export interface StructuredJD {
  responsibilities: string
  requirements: string
  companyIntro: string
  /** 岗位职责下的 1. 2. 3. 大点（每点含子项摘要） */
  responsibilityItems: string[]
  requirementParts: RequirementParts
  /** 从「技能」小节 + 页面标签提取 */
  skillList: string[]
}

const REQ_SUB_HEADERS: Array<{ key: keyof RequirementParts; patterns: RegExp[] }> = [
  { key: 'education', patterns: [/学历与专业/, /学历/, /专业要求/] },
  { key: 'skills', patterns: [/^技能$/, /技能要求/, /硬技能/, /技术能力/] },
  { key: 'softSkills', patterns: [/软性素质/, /软技能/, /素质要求/] },
  { key: 'experience', patterns: [/^经验$/, /经验要求/, /实习经验/, /工作经历/] },
]

/** 从整段 JD 中切出「岗位职责」「任职要求」两大块 */
export function splitMainBlocks(text: string): {
  responsibilities: string
  requirements: string
  companyIntro: string
} {
  const normalized = text.replace(/\r\n/g, '\n')

  let responsibilities = extractBetween(
    normalized,
    /(?:岗位职责|工作内容)[：:\s]*/i,
    /(?:任职要求|岗位要求|任职资格|公司介绍)/i,
  )
  let requirements = extractBetween(
    normalized,
    /(?:任职要求|岗位要求|任职资格)[：:\s]*/i,
    /(?:公司介绍|公司简介|员工福利|工作地址|$)/i,
  )
  const companyIntro = extractBetween(
    normalized,
    /(?:公司介绍|公司简介)[：:\s]*/i,
    /(?:任职要求|岗位职责|员工福利|$)/i,
  )

  // Boss 常把职责+要求都放在「职位描述」里，前面没有单独标题
  if (!responsibilities && !requirements) {
    const descBody = extractBetween(normalized, /(?:职位描述)[：:\s]*/i, /(?:公司介绍|$)/i)
    if (descBody) {
      responsibilities = extractBetween(
        descBody,
        /(?:岗位职责|工作内容)[：:\s]*/i,
        /(?:任职要求|岗位要求)/i,
      )
      requirements = extractBetween(
        descBody,
        /(?:任职要求|岗位要求|任职资格)[：:\s]*/i,
        /$/,
      )
      if (!responsibilities && !requirements) {
        const inlineResp = descBody.match(
          /(?:岗位职责|工作内容)[：:\s]*([\s\S]*?)(?=任职要求|岗位要求|$)/i,
        )
        const inlineReq = descBody.match(/(?:任职要求|岗位要求|任职资格)[：:\s]*([\s\S]*)$/i)
        if (inlineResp) responsibilities = inlineResp[1]!.trim()
        if (inlineReq) requirements = inlineReq[1]!.trim()
      }
    }
  }

  return {
    responsibilities: responsibilities.trim(),
    requirements: requirements.trim(),
    companyIntro: companyIntro.trim(),
  }
}

function extractBetween(text: string, startRe: RegExp, endRe: RegExp): string {
  const startMatch = text.match(startRe)
  if (!startMatch) return ''
  const startIdx = (startMatch.index ?? 0) + startMatch[0].length
  const rest = text.slice(startIdx)
  const endMatch = rest.match(endRe)
  return (endMatch ? rest.slice(0, endMatch.index) : rest).trim()
}

/** 解析「1. xxx」层级的大点（用于岗位职责、任职要求总览） */
export function splitNumberedBlocks(text: string, maxItems = 8): string[] {
  if (!text.trim()) return []

  const items: string[] = []
  const chunks = text.split(/(?=^\s*\d+[.、．)\s]+)/m)

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    if (!/^\d+[.、．)\s]/.test(trimmed)) {
      if (!items.length && trimmed.length >= 8) items.push(trimmed)
      continue
    }
    const body = trimmed
      .replace(/^\d+[.、．)\s]+/, '')
      .replace(/\s*\(\d+\)\s*/g, '；')
      .replace(/\s*（\d+）\s*/g, '；')
      .replace(/\n+/g, ' ')
      .trim()
    if (body.length >= 4 && body.length < 500) items.push(body)
  }

  return dedupeBullets(items).slice(0, maxItems)
}

/** 解析任职要求内的 1.学历 2.技能 3.软性 4.经验 */
export function parseRequirementParts(reqBlock: string): RequirementParts {
  const empty: RequirementParts = {
    education: '',
    skills: '',
    softSkills: '',
    experience: '',
  }
  if (!reqBlock.trim()) return empty

  const normalized = reqBlock.replace(/\r\n/g, '\n').trim()
  const parts = { ...empty }

  // 按「1. 学历与专业」这类编号+标题切分
  const numbered = normalized.split(/(?=^\s*\d+[.、．)\s]+)/m).filter(Boolean)

  for (const chunk of numbered) {
    const titleLine = chunk.trim().split('\n')[0] ?? ''
    let body = chunk
      .trim()
      .replace(/^[^\n]+\n?/, '')
      .trim()

    const titleClean = titleLine.replace(/^\d+[.、．)\s]+/, '').trim()
    const inline = titleLine.match(/^\d+[.、．)\s]+[^：:\n]+[：:\s]+(.+)$/)
    if (!body && inline?.[1]) body = inline[1].trim()

    for (const def of REQ_SUB_HEADERS) {
      if (def.patterns.some((p) => p.test(titleClean))) {
        const piece = body || titleClean
        if (!piece) break
        const existing = parts[def.key]
        if (existing && isDuplicatePart(existing, piece)) break
        parts[def.key] = existing ? `${existing}\n${piece}` : piece
        break
      }
    }
  }

  // 兜底：按关键词行匹配
  if (!parts.education) {
    parts.education = grabLabeledSection(normalized, /学历与专业|学历|专业/)
  }
  if (!parts.skills) {
    parts.skills = grabLabeledSection(normalized, /^技能$|技能要求|硬技能/)
  }
  if (!parts.softSkills) {
    parts.softSkills = grabLabeledSection(normalized, /软性素质|软技能/)
  }
  if (!parts.experience) {
    parts.experience = grabLabeledSection(normalized, /^经验$|经验要求|实习/)
  }

  return parts
}

function grabLabeledSection(text: string, labelRe: RegExp): string {
  const lines = text.split('\n')
  let capturing = false
  const buf: string[] = []

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const isNumberedHeader = /^\d+[.、．)\s]+/.test(t)
    const titlePart = t.replace(/^\d+[.、．)\s]+/, '').trim()

    if (isNumberedHeader && labelRe.test(titlePart)) {
      capturing = true
      const inline = t.match(/^\d+[.、．)\s]+[^：:\s]+[：:\s]+(.+)$/)
      if (inline?.[1]) buf.push(inline[1].trim())
      continue
    }

    if (capturing) {
      if (isNumberedHeader && !labelRe.test(titlePart)) break
      buf.push(t)
    }
  }

  return buf.join('\n').trim()
}

function isDuplicatePart(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, '').toLowerCase()
  const nb = b.replace(/\s+/g, '').toLowerCase()
  return na === nb || na.includes(nb) || nb.includes(na)
}

const TOOL_SPLIT = /[、,，/／|｜\s]+/

/** 从「技能」小节提取工具/方法；页面标签仅作补充且必须像技术技能 */
export function extractSkillsFromSection(skillsSection: string, pageTags: string[] = []): string[] {
  const out = new Set<string>()

  if (skillsSection.trim()) {
    const labeled = [
      skillsSection.match(/工具[：:]\s*([^\n]+)/)?.[1],
      skillsSection.match(/方法[：:]\s*([^\n]+)/)?.[1],
      skillsSection.match(/AI\s*知识[：:]\s*([^\n]+)/i)?.[1],
      skillsSection.match(/技术栈[：:]\s*([^\n]+)/)?.[1],
    ].filter(Boolean) as string[]

    for (const line of labeled) {
      for (const piece of line.split(TOOL_SPLIT)) {
        const skill = normalizeSkillToken(piece)
        if (skill && !isEmployeeBenefit(skill)) out.add(skill)
      }
    }

    const inlineTools = skillsSection.match(
      /\b(SQL|Python(?:\/R)?|R语言|Excel|Tableau|Power\s*BI|Spark|Hadoop|MySQL|PostgreSQL|MongoDB|Redis|Git|Docker|Kubernetes|Java|C\+\+|Go|JavaScript|TypeScript|React|Vue|Spring|Kafka|Linux|MATLAB|SAS|SPSS|AutoML|Prompt\s*Engineering|LLM|ChatGPT|Claude)\b/gi,
    )
    inlineTools?.forEach((t) => {
      const n = normalizeSkillToken(t)
      if (n) out.add(n)
    })
  }

  // 仅有「技能」小节时才参考页面标签；且必须是技术类
  if (skillsSection.trim()) {
    for (const tag of filterJobDescTags(pageTags)) {
      if (looksLikeTechnicalSkill(tag)) out.add(tag)
    }
  }

  return filterHardSkills([...out]).slice(0, 24)
}

function normalizeSkillToken(raw: string): string {
  let s = raw.trim().replace(/[;；。．.]+$/g, '')
  if (/等$/.test(s)) s = s.slice(0, -1)
  if (s.length < 2 || s.length > 28) return ''
  if (/^(优先|加分|熟悉|掌握|了解|精通|具备|相关|以上|以下)$/.test(s)) return ''
  return s
}

/** 软性素质：按行或「标题：说明」拆分 */
export function splitSoftSkillItems(softBlock: string): string[] {
  if (!softBlock.trim()) return []
  return dedupeBullets(
    softBlock
      .split(/\n/)
      .map((l) => l.trim().replace(/^[-·•*\d.、)）\s]+/, ''))
      .filter((l) => l.length >= 6 && l.length < 200),
  ).slice(0, 8)
}

export function parseStructuredJD(text: string, pageTags: string[] = []): StructuredJD {
  const blocks = splitMainBlocks(text)
  const requirementParts = parseRequirementParts(blocks.requirements)
  const responsibilityItems = splitNumberedBlocks(blocks.responsibilities, 6)
  const skillList = extractSkillsFromSection(requirementParts.skills, filterJobDescTags(pageTags))

  return {
    responsibilities: blocks.responsibilities,
    requirements: blocks.requirements,
    companyIntro: blocks.companyIntro,
    responsibilityItems,
    requirementParts,
    skillList,
  }
}
