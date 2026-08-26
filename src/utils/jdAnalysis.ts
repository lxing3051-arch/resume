import type { JdAnalysis, JdNumberedSection, ResumeProjectSuggestion } from '../types'
import { analyzeJDByRules } from './jdAnalyzer'
import { aiGenerateJson, isAiAvailable, isAiConfigured } from './aiProvider'
import { createProjectId, jdRawFingerprint } from './jdFingerprint'

const ANALYZE_PROMPT = `你是资深 HR 和职业规划师。分析以下招聘 JD，提取并分类信息。
只输出 JSON，不要其他文字。字段说明：
- responsibilitySections: 岗位职责的段落分组，格式 [{"title":"原文小标题或概括标题","items":["该标题下的一段完整职责", "另一段完整职责"]}]。
- requirementSections: 任职要求的段落分组，格式同上。
- education: 学历、专业要求（字符串数组，每条一句）
- experience: 工作/实习年限与经验要求（数组）
- hardSkills: 硬技能、技术栈（数组）
- softSkills: 软性素质，如沟通、团队协作（数组）
- projectRequirements: 项目经历相关要求，重点提取（数组）
- responsibilities: 岗位职责，拆成简洁条目（数组，每条不超过40字）
- requirements: 任职要求，拆成简洁条目（数组）
- companySummary: 公司介绍压缩为1-2句话，非重点，不超过80字

分组规则：优先保留原文的小标题（例如“团队使命”“技术风险咨询”）；同一段内的连续说明合并为一项，绝不按单句或换行逐条切开；每类最多 6 个标题、每标题最多 6 项。不要把导航、面包屑、相关职位、页脚、职位列表、校园招聘主页、职位名称或公司名放入结果。只能使用 JD 中已有的信息，不得编造。

岗位描述：
`

const AI_NOISE = /^(?:职位列表|校园招聘主页|招聘首页|职位详情|首页\s*\/|分享|举报|相关职位|相关推荐|推荐职位)$/i

function normalizeAiSections(value: unknown, fallback: JdNumberedSection[]): JdNumberedSection[] {
  if (!Array.isArray(value)) return fallback
  const seen: string[] = []
  const sections = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as { title?: unknown; items?: unknown }
      const title = String(record.title ?? '').replace(/[：:]$/, '').trim()
      if (!title || title.length > 48 || AI_NOISE.test(title) || !Array.isArray(record.items)) return null
      const items = record.items
        .map((item) => String(item).replace(/\s+/g, ' ').trim())
        .filter((item) => item.length >= 4 && item.length <= 500 && !AI_NOISE.test(item))
        .filter((item) => {
          const key = item.replace(/\s+/g, '')
          if (seen.some((previous) => previous === key)) return false
          seen.push(key)
          return true
        })
        .slice(0, 6)
      return items.length ? { title, items } : null
    })
    .filter((section): section is { title: string; items: string[] } => Boolean(section))
    .slice(0, 6)
    .map((section, index) => ({ index: index + 1, ...section }))

  return sections.length ? sections : fallback
}

const PROJECT_PROMPT = `你是项目导师和简历辅导专家。根据以下岗位的项目/技术/职责要求，为学生设计2-3个可在2-4周内完成的实战项目。
项目要有明确业务场景，技术栈与 JD 对齐，适合写进简历，且学生真的能动手做出来。
只输出 JSON：{"projects":[{"title":"","description":"","techStack":[],"highlights":[]}]}
highlights 是 3-4 条 STAR 风格简历 bullet。

JD 分析：
`

function normalizeAnalysis(raw: Partial<JdAnalysis>, jdRaw: string): JdAnalysis {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
  const responsibilities = arr(raw.responsibilities).slice(0, 10)
  const requirements = arr(raw.requirements).slice(0, 10)
  // AI 负责理解段落语义；不完整或含网页噪音时才退回原文规则。
  const structured = analyzeJDByRules(jdRaw)
  return {
    responsibilitySections: normalizeAiSections(raw.responsibilitySections, structured.responsibilitySections),
    requirementSections: normalizeAiSections(raw.requirementSections, structured.requirementSections),
    education: arr(raw.education),
    experience: arr(raw.experience),
    hardSkills: arr(raw.hardSkills),
    softSkills: arr(raw.softSkills),
    projectRequirements: arr(raw.projectRequirements),
    responsibilities,
    requirements,
    companySummary: String(raw.companySummary ?? '').slice(0, 200),
    analyzedAt: new Date().toISOString(),
    source: 'ai',
    rulesVersion: structured.rulesVersion,
    jdRawFingerprint: jdRawFingerprint(jdRaw),
  }
}

export async function analyzeJDWithAi(jdRaw: string): Promise<JdAnalysis> {
  const raw = await aiGenerateJson<Partial<JdAnalysis>>(ANALYZE_PROMPT + jdRaw.slice(0, 8000))
  return normalizeAnalysis(raw, jdRaw)
}

export async function analyzeJD(jdRaw: string): Promise<JdAnalysis> {
  if (isAiConfigured()) {
    try {
      if (await isAiAvailable()) {
        return await analyzeJDWithAi(jdRaw)
      }
    } catch {
      /* fallback */
    }
  }
  return analyzeJDByRules(jdRaw)
}

export async function generateResumeProjects(
  analysis: JdAnalysis,
  position: string,
): Promise<ResumeProjectSuggestion[]> {
  if (!isAiConfigured()) throw new Error('请先在设置中配置 Gemini 或 Ollama')
  if (!(await isAiAvailable())) throw new Error('AI 未连接，请检查 Gemini API Key 或 Ollama')

  const context = JSON.stringify({ position, ...analysis }, null, 2)
  const raw = await aiGenerateJson<{
    projects: Array<{
      title: string
      description: string
      techStack: string[]
      highlights: string[]
    }>
  }>(PROJECT_PROMPT + context.slice(0, 6000))

  const now = new Date().toISOString()
  return (raw.projects ?? []).map((p) => ({
    id: createProjectId(),
    title: p.title,
    description: p.description,
    techStack: p.techStack ?? [],
    highlights: p.highlights ?? [],
    createdAt: now,
    status: 'planned' as const,
  }))
}

/** AI 不可用时的规则模板项目（无需联网） */
export function generateResumeProjectsByRules(
  analysis: JdAnalysis,
  position: string,
): ResumeProjectSuggestion[] {
  const skills = analysis.hardSkills.length ? analysis.hardSkills : ['Python', 'SQL']
  const focus = analysis.projectRequirements[0] ?? analysis.responsibilities[0] ?? position
  const now = new Date().toISOString()

  const templates: Array<Omit<ResumeProjectSuggestion, 'id' | 'createdAt' | 'status'>> = [
    {
      title: `${position} · 数据分析实战项目`,
      description: `围绕「${focus.slice(0, 40)}…」设计的数据分析项目：数据采集、清洗、建模与可视化报告。`,
      techStack: skills.slice(0, 5),
      highlights: [
        `使用 ${skills.slice(0, 3).join('、') || 'SQL/Python'} 完成业务指标分析`,
        '输出可演示的数据看板或分析报告',
        '项目过程可整理为简历 STAR 描述',
      ],
    },
    {
      title: `${position} · 业务场景模拟项目`,
      description: '基于 JD 职责设计的端到端小项目，覆盖需求分析、实现与结果复盘。',
      techStack: skills.slice(0, 4),
      highlights: [
        '按 JD 要求选取 1 个核心业务场景落地',
        `对齐岗位技能：${skills.slice(0, 4).join('、')}`,
        '形成 GitHub 仓库或文档作为作品链接',
      ],
    },
  ]

  if (analysis.projectRequirements.some((r) => /RAG|AutoML|Agent|建模/i.test(r))) {
    templates.push({
      title: `${position} · AI/建模专项练习`,
      description: '针对 JD 中的 AI、建模或 RAG 要求设计的练习项目。',
      techStack: [...skills.slice(0, 3), 'Prompt Engineering'].filter(Boolean),
      highlights: [
        '完成一个可演示的建模或 AI 应用原型',
        '记录实验过程与效果指标',
        '总结可写进简历的技术亮点',
      ],
    })
  }

  return templates.slice(0, 3).map((p) => ({
    ...p,
    id: createProjectId(),
    createdAt: now,
    status: 'planned' as const,
  }))
}

// 兼容旧名称
export const analyzeJDWithOllama = analyzeJDWithAi
