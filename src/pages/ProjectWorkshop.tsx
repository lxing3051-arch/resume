import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/Layout'
import { db } from '../db/database'
import { updateResumeProject } from '../utils/jdAnalysisService'
import {
  coachProjectIntro,
  coachProjectStep,
  generateProjectRoadmap,
  normalizeLegacyProject,
} from '../utils/projectCoach'
import type { ProjectChatMessage, ResumeProjectSuggestion } from '../types'

export default function ProjectWorkshop() {
  const { id, projectId } = useParams()
  const companyId = Number(id)
  const company = useLiveQuery(() => db.companies.get(companyId), [companyId])
  const [project, setProject] = useState<ResumeProjectSuggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(false)
  const [chatting, setChatting] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (company === undefined) return
    if (!company || !projectId) {
      setLoading(false)
      return
    }
    const found = company.resumeProjects?.find((p) => p.id === projectId)
    if (found) setProject(normalizeLegacyProject(found))
    setLoading(false)
  }, [company, projectId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [project?.chatHistory])

  async function persist(next: ResumeProjectSuggestion) {
    setProject(next)
    if (projectId) await updateResumeProject(companyId, projectId, next)
  }

  async function ensureRoadmap(current: ResumeProjectSuggestion) {
    if (current.steps && current.steps.length > 0) return current
    if (!company) return current
    setPlanning(true)
    setError('')
    try {
      const steps = await generateProjectRoadmap(current, company.position, company.jdAnalysis)
      const next = {
        ...current,
        steps,
        currentStepIndex: 0,
        status: 'in_progress' as const,
        chatHistory: [],
      }
      await persist(next)
      return next
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成计划失败')
      return current
    } finally {
      setPlanning(false)
    }
  }

  useEffect(() => {
    if (!project || !company || planning) return
    if (project.steps && project.steps.length > 0) return
    void ensureRoadmap(project)
  }, [project?.id, company?.id])

  async function startStepGuide() {
    if (!project || !company) return
    const current = await ensureRoadmap(project)
    const stepIndex = current.currentStepIndex ?? 0
    const step = current.steps?.[stepIndex]
    if (!step) return

    setChatting(true)
    setError('')
    try {
      const reply = await coachProjectIntro(current, step, company.position)
      const msg: ProjectChatMessage = {
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      }
      await persist({
        ...current,
        chatHistory: [...(current.chatHistory ?? []), msg],
        status: 'in_progress',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 回复失败')
    } finally {
      setChatting(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !project || !company) return
    const stepIndex = project.currentStepIndex ?? 0
    const step = project.steps?.[stepIndex]
    if (!step) return

    const userMsg: ProjectChatMessage = {
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }
    const history = [...(project.chatHistory ?? []), userMsg]
    await persist({ ...project, chatHistory: history })
    setInput('')
    setChatting(true)
    setError('')
    try {
      const reply = await coachProjectStep(
        project,
        step,
        company.position,
        history.slice(0, -1),
        userMsg.content,
      )
      const assistantMsg: ProjectChatMessage = {
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      }
      await persist({ ...project, chatHistory: [...history, assistantMsg] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 回复失败')
    } finally {
      setChatting(false)
    }
  }

  async function toggleStepDone(stepId: string, done: boolean) {
    if (!project) return
    const steps = project.steps?.map((s) => (s.id === stepId ? { ...s, done } : s)) ?? []
    const allDone = steps.length > 0 && steps.every((s) => s.done)
    await persist({
      ...project,
      steps,
      status: allDone ? 'done' : 'in_progress',
    })
  }

  async function goToStep(index: number) {
    if (!project) return
    await persist({
      ...project,
      currentStepIndex: index,
      chatHistory: [],
    })
  }

  if (company === undefined || loading) return <Layout>加载中...</Layout>
  if (!company || !project) return <Layout>未找到项目</Layout>

  const stepIndex = project.currentStepIndex ?? 0
  const currentStep = project.steps?.[stepIndex]
  const doneCount = project.steps?.filter((s) => s.done).length ?? 0
  const totalSteps = project.steps?.length ?? 0

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to={`/company/${companyId}`} className="back-link">
            ← 返回 {company.name}
          </Link>
          <h1>AI 带做项目 · {project.title}</h1>
          <p className="muted">
            目标岗位：{company.position}
            {totalSteps > 0 && ` · 进度 ${doneCount}/${totalSteps}`}
          </p>
        </div>
      </div>

      <div className="workshop-layout">
        <aside className="panel workshop-steps">
          <h2>实施计划</h2>
          {planning && <p className="hint">AI 正在生成实施计划…</p>}
          {!planning && totalSteps === 0 && (
            <button className="btn primary" type="button" onClick={() => void ensureRoadmap(project)}>
              生成实施计划
            </button>
          )}
          <ol className="step-roadmap">
            {project.steps?.map((step, i) => (
              <li
                key={step.id}
                className={`step-roadmap-item${i === stepIndex ? ' active' : ''}${step.done ? ' done' : ''}`}
              >
                <label className="step-check">
                  <input
                    type="checkbox"
                    checked={step.done}
                    onChange={(e) => void toggleStepDone(step.id, e.target.checked)}
                  />
                  <button type="button" className="step-link" onClick={() => void goToStep(i)}>
                    {step.title}
                  </button>
                </label>
                {i === stepIndex && (
                  <ul className="step-tasks">
                    {step.tasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </aside>

        <section className="panel workshop-chat">
          <div className="panel-head">
            <h2>{currentStep ? `当前：${currentStep.title}` : 'AI 导师'}</h2>
            {currentStep && !(project.chatHistory?.length) && (
              <button
                className="btn primary"
                type="button"
                disabled={chatting || planning}
                onClick={() => void startStepGuide()}
              >
                开始这一步
              </button>
            )}
          </div>
          {currentStep && <p className="muted small">{currentStep.description}</p>}
          {error && <p className="hint error-hint">{error}</p>}

          <div className="chat-log">
            {(project.chatHistory ?? []).map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                <strong>{msg.role === 'user' ? '你' : 'AI 导师'}</strong>
                <pre className="chat-content">{msg.content}</pre>
              </div>
            ))}
            {chatting && <p className="muted">AI 思考中…</p>}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-input-row" onSubmit={sendMessage}>
            <textarea
              rows={2}
              placeholder="问 AI：这一步怎么开始？环境怎么搭？代码怎么写？"
              value={input}
              disabled={!currentStep || chatting}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={!input.trim() || chatting || !currentStep}>
              发送
            </button>
          </form>

          {currentStep && stepIndex < totalSteps - 1 && currentStep.done && (
            <button className="btn ghost" type="button" onClick={() => void goToStep(stepIndex + 1)}>
              进入下一步 →
            </button>
          )}
        </section>
      </div>
    </Layout>
  )
}
