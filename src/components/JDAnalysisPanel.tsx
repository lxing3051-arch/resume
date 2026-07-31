import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JdAnalysis, ResumeProjectSuggestion } from '../types'
import { analyzeJDByRules } from '../utils/jdAnalyzer'
import { analyzeJD, generateResumeProjects } from '../utils/jdAnalysis'
import { getAiSettings, getProviderLabel } from '../utils/aiSettings'
import { isAiConfigured } from '../utils/aiProvider'
import {
  copyProjectToClipboard,
  saveJdAnalysis,
  saveResumeProjects,
} from '../utils/jdAnalysisService'
import { normalizeLegacyProject } from '../utils/projectCoach'

interface Props {
  analysis?: JdAnalysis
  resumeProjects?: ResumeProjectSuggestion[]
  jdRaw: string
  position: string
  companyId?: number
  onAnalysisChange?: (analysis: JdAnalysis) => void
  onProjectsChange?: (projects: ResumeProjectSuggestion[]) => void
  compact?: boolean
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted small">暂无</p>
  return (
    <ul className="jd-bullet-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function TagList({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted small">暂无</p>
  return (
    <div className="jd-tag-list">
      {items.map((item) => (
        <span key={item} className="tag">
          {item}
        </span>
      ))}
    </div>
  )
}

function JdSection({
  title,
  children,
  highlight,
}: {
  title: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`jd-section${highlight ? ' jd-section-highlight' : ''}`}>
      <h4>{title}</h4>
      {children}
    </div>
  )
}

export function JDAnalysisPanel({
  analysis: initialAnalysis,
  resumeProjects: initialProjects = [],
  jdRaw,
  position,
  companyId,
  onAnalysisChange,
  onProjectsChange,
  compact = false,
}: Props) {
  const [analysis, setAnalysis] = useState(initialAnalysis)
  const [projects, setProjects] = useState(initialProjects.map(normalizeLegacyProject))
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [showCompany, setShowCompany] = useState(false)
  const aiSettings = getAiSettings()
  const aiConfigured = isAiConfigured()

  useEffect(() => {
    setAnalysis(initialAnalysis)
  }, [initialAnalysis])

  useEffect(() => {
    const normalized = initialProjects.map(normalizeLegacyProject)
    setProjects(normalized)
  }, [initialProjects])

  async function persistAnalysis(next: JdAnalysis) {
    setAnalysis(next)
    onAnalysisChange?.(next)
    if (companyId) await saveJdAnalysis(companyId, next)
  }

  async function persistProjects(next: ResumeProjectSuggestion[]) {
    const normalized = next.map(normalizeLegacyProject)
    setProjects(normalized)
    onProjectsChange?.(normalized)
    if (companyId) await saveResumeProjects(companyId, normalized)
  }

  async function handleAnalyze(useAi: boolean) {
    if (!jdRaw.trim()) {
      setMessage('请先录入 JD 文本')
      return
    }
    setAnalyzing(true)
    setMessage('')
    try {
      const next = useAi && aiConfigured ? await analyzeJD(jdRaw) : analyzeJDByRules(jdRaw)
      await persistAnalysis(next)
      setMessage(useAi && aiConfigured ? 'AI 分析完成' : '规则分类完成')
    } catch {
      const fallback = analyzeJDByRules(jdRaw)
      await persistAnalysis(fallback)
      setMessage('AI 不可用，已使用规则分析')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerateProjects() {
    if (!analysis && !jdRaw.trim()) return
    const base = analysis ?? analyzeJDByRules(jdRaw)
    if (!aiConfigured) {
      setMessage('请先在设置中配置 Gemini API Key 或 Ollama')
      return
    }
    setGenerating(true)
    setMessage('')
    try {
      const next = await generateResumeProjects(base, position)
      await persistProjects(next)
      setMessage(`已生成 ${next.length} 个项目，点击「AI 带我做」开始实战`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const display = analysis

  return (
    <div className={`jd-analysis${compact ? ' jd-analysis-compact' : ''}`}>
      <div className="panel-head">
        <h3>职位分析</h3>
        <div className="quick-actions">
          {analyzing && <span className="muted small">分析中…</span>}
          <button
            className="btn ghost"
            type="button"
            disabled={analyzing}
            onClick={() => void handleAnalyze(false)}
          >
            {display ? '重新分类' : '规则分类'}
          </button>
          {aiConfigured && (
            <button
              className="btn ghost"
              type="button"
              disabled={analyzing}
              onClick={() => void handleAnalyze(true)}
            >
              重新 AI 分析
            </button>
          )}
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
      {aiConfigured && aiSettings.autoAnalyze && (
        <p className="hint muted small">
          已开启自动 AI 分析 · 引擎：{getProviderLabel(aiSettings.provider)}（可在设置中切换）
        </p>
      )}
      {!display && <p className="muted">粘贴 JD 后点击「规则分类」，或手动点「AI 分析」</p>}

      {display && (
        <>
          <div className="jd-primary-block">
            <h3 className="jd-block-title">职位要求（重点）</h3>
            <div className="jd-grid">
              <JdSection title="学历与专业">
                <BulletList items={display.education} />
              </JdSection>
              <JdSection title="经验要求">
                <BulletList items={display.experience} />
              </JdSection>
              <JdSection title="硬技能 / 技术栈">
                <TagList items={display.hardSkills} />
              </JdSection>
              <JdSection title="软性素质">
                <BulletList items={display.softSkills} />
              </JdSection>
              <JdSection title="项目经历要求" highlight>
                <BulletList items={display.projectRequirements} />
              </JdSection>
            </div>
            {(display.responsibilities.length > 0 || display.requirements.length > 0) && (
              <div className="jd-grid jd-grid-wide">
                {display.responsibilities.length > 0 && (
                  <JdSection title="岗位职责">
                    <BulletList items={display.responsibilities} />
                  </JdSection>
                )}
                {display.requirements.length > 0 && (
                  <JdSection title="任职要求">
                    <BulletList items={display.requirements} />
                  </JdSection>
                )}
              </div>
            )}
            {display.analyzedAt && (
              <p className="muted small">
                {display.source === 'ai' ? 'AI' : '规则'}分析于{' '}
                {new Date(display.analyzedAt).toLocaleString()}
              </p>
            )}
          </div>

          {display.companySummary && (
            <div className="jd-secondary-block">
              <button
                type="button"
                className="jd-collapse-trigger"
                onClick={() => setShowCompany((v) => !v)}
              >
                {showCompany ? '▼' : '▶'} 公司介绍（已精简，非重点）
              </button>
              {showCompany && <p className="jd-company-summary">{display.companySummary}</p>}
              {!showCompany && (
                <p className="jd-company-summary collapsed">{display.companySummary.slice(0, 60)}…</p>
              )}
            </div>
          )}

          {!compact && (
            <div className="jd-projects-block">
              <div className="panel-head">
                <h3>匹配简历项目</h3>
                <button
                  className="btn primary"
                  type="button"
                  disabled={generating || !jdRaw.trim()}
                  onClick={() => void handleGenerateProjects()}
                >
                  {generating ? '生成中…' : 'AI 生成项目'}
                </button>
              </div>
              <p className="hint">根据 JD 生成可实战的项目，点击「AI 带我做」逐步完成（支持 Gemini / Ollama）</p>
              {projects.length > 0 && (
                <div className="project-list">
                  {projects.map((project) => (
                    <article key={project.id} className="project-card">
                      <div className="project-card-head">
                        <strong>{project.title}</strong>
                        <div className="quick-actions">
                          {companyId && (
                            <Link
                              className="btn primary"
                              to={`/company/${companyId}/project/${project.id}`}
                            >
                              AI 带我做
                            </Link>
                          )}
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={() => void copyProjectToClipboard(project)}
                          >
                            复制简历描述
                          </button>
                        </div>
                      </div>
                      {project.status === 'done' && <span className="tag success-tag">已完成</span>}
                      {project.status === 'in_progress' && <span className="tag">进行中</span>}
                      <p>{project.description}</p>
                      <TagList items={project.techStack} />
                      <BulletList items={project.highlights} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {!compact && jdRaw && (
            <div className="jd-raw-block">
              <button type="button" className="jd-collapse-trigger" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? '▼' : '▶'} 原始 JD 全文
              </button>
              {showRaw && <pre className="text-block">{jdRaw}</pre>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
