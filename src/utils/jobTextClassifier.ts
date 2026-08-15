import type { CompanyFormData } from './companyForm'
import type { JdNumberedSection } from '../types'
import { analyzeJDByRules, mergeSkillsFromAnalysis } from './jdAnalyzer'
import { parseJDText } from './jdParser'
import { buildDedupedSections } from './jdTextSections'

export type JobTextSource = 'boss' | 'liepin' | 'lagou' | 'generic'

export interface JobTextClassification {
  source: JobTextSource
  patch: Partial<CompanyFormData>
}

const SECTION_HEADINGS = /^(职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述|任职要求|职位要求|岗位要求|任职资格|任职条件|我们希望你|你需要具备|福利待遇|公司介绍|关于我们)\s*[：:]?$/
const RESPONSIBILITY_HEADING = /^(职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述)\s*[：:]?$/
const REQUIREMENT_HEADING = /^(任职要求|职位要求|岗位要求|任职资格|任职条件|我们希望你|你需要具备)\s*[：:]?$/
const END_OF_JD = /^(?:相关职位|相关推荐|推荐职位|职位推荐|联系我们|相关网站|职位\s*ID|公司地址|投递方式|立即投递|分享|举报)/i
const ROLE_WORD = /(?:工程师|开发|算法|产品|运营|设计|分析师|专员|顾问|实习生|管培生|经理|研究员|测试|招聘|销售|市场|商务|财务|法务|编辑|策划)/
const BAD_IDENTITY_TEXT = /(?:核心业务|校园(?:招聘|校招)?|快手校招|加入我们|相关职位|相关网站|联系我们|职位\s*ID|研发平台|广告产品)/
const GENERIC_POSITION_TEXT = /^(?:核心业务|校园(?:招聘|校招)?|校招|快手校招|加入我们|相关职位|相关网站|联系我们|职位\s*ID|研发平台|广告产品)$/

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ''
}

function detectSource(text: string): JobTextSource {
  if (/BOSS直聘|boss\.zhipin\.com/i.test(text)) return 'boss'
  if (/猎聘|liepin\.com/i.test(text)) return 'liepin'
  if (/拉勾|lagou\.com/i.test(text)) return 'lagou'
  return 'generic'
}

function sectionText(text: string, heading: RegExp): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => heading.test(line.trim()))
  if (start < 0) return ''
  const result: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (SECTION_HEADINGS.test(line.trim()) || END_OF_JD.test(line.trim())) break
    result.push(line)
  }
  return result.join('\n').trim()
}

function inferCompanyName(text: string): string {
  if (/字节跳动|ByteDance/i.test(text)) return '字节跳动'
  if (/腾讯(?:招聘|校招|实习|公司)?|Tencent/i.test(text)) return '腾讯'
  if (/快手(?:校园|校招|招聘)?|Kuaishou/i.test(text)) return '快手'
  if (/阿里巴巴|Alibaba/i.test(text)) return '阿里巴巴'
  if (/美团(?:招聘|校招)?/i.test(text)) return '美团'
  return ''
}

function isPlausibleCompany(value: string): boolean {
  return value.length >= 2 && value.length <= 30 && !BAD_IDENTITY_TEXT.test(value) && !ROLE_WORD.test(value)
}

function isPlausiblePosition(value: string): boolean {
  const position = value.trim()
  return position.length >= 2 && position.length <= 80 && !GENERIC_POSITION_TEXT.test(position) && ROLE_WORD.test(position)
}

function classifyUnheadedLines(text: string): Pick<CompanyFormData, 'responsibilities' | 'requirements'> {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 300)
  const responsibilities = lines.filter((line) => /负责|参与|协助|推进|设计|开发|维护|跟进|完成|协调|对接/.test(line))
  const requirements = lines.filter((line) => /要求|熟悉|掌握|具备|本科|学历|经验|能力|优先|了解|至少/.test(line))
  return {
    responsibilities: responsibilities.slice(0, 12).join('\n'),
    requirements: requirements.slice(0, 12).join('\n'),
  }
}

function metadataFromText(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 16)
  const salary = firstMatch(text, [
    /(?:薪资|薪酬|待遇)\s*[：:]?\s*([^\n]+)/i,
  ])
  const location = firstMatch(text, [
    /(?:工作地点|工作城市|地点|地址)\s*[：:]?\s*([^\n]+)/i,
  ]) || lines.find((line) => /(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|厦门|重庆|天津|长沙|合肥|郑州|青岛|大连|香港|远程)/.test(line) && line.length <= 50) || ''
  const position = firstMatch(text, [
    /(?:职位名称|岗位名称|招聘职位|职位|岗位)\s*[：:]?\s*([^\n]+)/i,
  ])
  const name = firstMatch(text, [
    /(?:公司名称|招聘公司|公司)\s*[：:]?\s*([^\n]+)/i,
  ])

  // 常见复制格式："公司名 · 职位名"、"公司名 | 职位名"。
  const pair = lines
    .slice(0, 8)
    .map((line) => line.match(/^(.{2,40}?)\s*(?:[·|｜—–-]|\/)\s*(.{2,50})$/))
    .find((match) => Boolean(match && isPlausibleCompany(match[1].trim()) && isPlausiblePosition(match[2].trim())))
  return {
    name: isPlausibleCompany(name) ? name : (pair?.[1]?.trim() || inferCompanyName(text)),
    position: isPlausiblePosition(position) ? position : (pair?.[2]?.trim() || ''),
    location: location.replace(/^(工作地点|工作城市|地点|地址)\s*[：:]?\s*/i, '').trim(),
    salary: salary.replace(/^(薪资|薪酬|待遇)\s*[：:]?\s*/i, '').trim(),
  }
}

function toSection(title: string, text: string): JdNumberedSection[] {
  return buildDedupedSections(text, title)
}

/** 将任意招聘网站、聊天记录或邮件中复制的职位文本归类为表单字段。 */
export function classifyJobText(text: string, current: CompanyFormData): JobTextClassification | null {
  const raw = clean(text)
  if (raw.length < 8) return null

  const parsed = parseJDText(raw)
  const meta = metadataFromText(raw)
  const fallback = classifyUnheadedLines(raw)
  const hasResponsibilityHeading = raw.split('\n').some((line) => RESPONSIBILITY_HEADING.test(line.trim()))
  const hasRequirementHeading = raw.split('\n').some((line) => REQUIREMENT_HEADING.test(line.trim()))
  const responsibilities = hasResponsibilityHeading
    ? sectionText(raw, RESPONSIBILITY_HEADING)
    : (parsed.responsibilities || fallback.responsibilities)
  const requirements = hasRequirementHeading
    ? sectionText(raw, REQUIREMENT_HEADING)
    : (hasResponsibilityHeading ? '' : (parsed.requirements || fallback.requirements))
  const analysis = analyzeJDByRules(raw)
  // 部分网站没有 Boss 的固定标题结构；保证分类结果也能在分析面板中可见。
  if (!analysis.responsibilitySections.length) {
    analysis.responsibilitySections = toSection('岗位职责', responsibilities)
  }
  if (!analysis.requirementSections.length) {
    analysis.requirementSections = toSection('任职要求', requirements)
  }
  const skills = mergeSkillsFromAnalysis(analysis, parsed.skills.length ? parsed.skills : current.skills)

  return {
    source: detectSource(raw),
    patch: {
      jdRaw: raw,
      name: meta.name || (isPlausibleCompany(parsed.name) ? parsed.name : '') || current.name,
      position: meta.position || (isPlausiblePosition(parsed.position) ? parsed.position : '') || current.position,
      location: meta.location || parsed.location || current.location,
      salary: meta.salary || current.salary || '暂无',
      responsibilities,
      requirements,
      skills,
      jdAnalysis: analysis,
    },
  }
}
