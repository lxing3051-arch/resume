import type {
  JdAnalysis,
  ProjectChatMessage,
  ProjectStep,
  ResumeProjectSuggestion,
} from '../types'
import { createProjectId, createStepId } from './jdFingerprint'
import { aiChat, aiGenerateJson, isAiAvailable, isAiConfigured } from './aiProvider'

const ROADMAP_PROMPT = `你是资深项目导师，目标帮助学生做出能写进简历、且能通过后端/全栈岗面试追问的真实项目。
根据项目信息和目标岗位 JD，生成 6-8 步可执行实施计划，从环境搭建到核心功能、测试、部署/演示。
每步必须包含：清晰验收标准（怎样算做完）、预计耗时、2-4 个具体任务。
技术选型与 JD 要求对齐，难度适合 2-4 周独立完成。
只输出 JSON：{"steps":[{"title":"","description":"","tasks":["任务1","任务2"]}]}

目标岗位：
`

const COACH_SYSTEM = `你是顶级项目实战导师（Gemini Pro 级），带学生从零完成一个能写进简历、经得起面试追问的项目。

每次回答结构：
1. 【本步目标】一句话说明这一步要达成什么
2. 【怎么做】分 1-3 个小动作，给出具体命令、目录结构、接口设计或关键代码片段（Java/Python/Go 等按项目技术栈）
3. 【验收】怎样确认这一步做对了
4. 【常见坑】1-2 个容易踩的坑

原则：
- 一次只推进一个小动作，不要一次倾倒整章内容
- 代码可以给关键片段（Controller/Service/SQL/配置），但要解释为什么这样写
- 学生说「卡住了/报错了」时，先问或根据描述定位问题，再给排查步骤
- 用中文，语气像耐心的学长/学姐`

function ensureAi() {
  if (!isAiConfigured()) throw new Error('请先在设置中配置 Gemini 或 Ollama')
}

export async function generateProjectRoadmap(
  project: ResumeProjectSuggestion,
  position: string,
  analysis?: JdAnalysis,
): Promise<ProjectStep[]> {
  ensureAi()
  if (!(await isAiAvailable())) throw new Error('AI 未连接，请检查 Gemini API Key 或 Ollama')

  const context = JSON.stringify(
    {
      position,
      project: {
        title: project.title,
        description: project.description,
        techStack: project.techStack,
        highlights: project.highlights,
      },
      jdSkills: analysis?.hardSkills ?? [],
      jdProjects: analysis?.projectRequirements ?? [],
    },
    null,
    2,
  )

  const raw = await aiGenerateJson<{
    steps: Array<{ title: string; description: string; tasks: string[] }>
  }>(ROADMAP_PROMPT + context.slice(0, 5000))

  return (raw.steps ?? []).map((s) => ({
    id: createStepId(),
    title: s.title,
    description: s.description,
    tasks: s.tasks ?? [],
    done: false,
  }))
}

export async function coachProjectStep(
  project: ResumeProjectSuggestion,
  step: ProjectStep,
  position: string,
  history: ProjectChatMessage[],
  userMessage: string,
): Promise<string> {
  ensureAi()
  if (!(await isAiAvailable())) throw new Error('AI 未连接')

  const stepContext = `项目：${project.title}
描述：${project.description}
技术栈：${project.techStack.join('、')}
目标岗位：${position}
当前步骤：${step.title}
步骤说明：${step.description}
本步任务：${step.tasks.join('；')}`

  const messages = [
    { role: 'system' as const, content: COACH_SYSTEM },
    { role: 'user' as const, content: `项目背景：\n${stepContext}` },
    {
      role: 'assistant' as const,
      content: '好的，我会按步骤带你完成。有任何问题随时问我，我们从当前这一步开始。',
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  return aiChat(messages)
}

export async function coachProjectIntro(
  project: ResumeProjectSuggestion,
  step: ProjectStep,
  position: string,
): Promise<string> {
  return coachProjectStep(
    project,
    step,
    position,
    [],
    `请开始带我完成这一步：${step.title}。先说明本步目标和验收标准，然后给出第一个要做的小动作（含具体命令或代码思路）。`,
  )
}

export function normalizeLegacyProject(project: ResumeProjectSuggestion): ResumeProjectSuggestion {
  return {
    ...project,
    id: project.id || createProjectId(),
    status: project.status ?? 'planned',
    currentStepIndex: project.currentStepIndex ?? 0,
    chatHistory: project.chatHistory ?? [],
    steps: project.steps ?? [],
  }
}
