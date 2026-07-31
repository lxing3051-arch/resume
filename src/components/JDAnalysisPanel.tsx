import { useEffect, useState } from 'react'
import type { JdAnalysis } from '../types'
import { analyzeJDByRules } from '../utils/jdAnalyzer'
import { saveJdAnalysis } from '../utils/jdAnalysisService'
import { buildAnalysisSummary, buildCursorProjectPrompt } from '../utils/cursorPrompt'

interface Props {
  analysis?: JdAnalysis
  jdRaw: string
  position: string
  companyName?: string
  companyId?: number
  onAnalysisChange?: (analysis: JdAnalysis) => void
  compact?: boolean
  /** 详情页打开时用最新规则重算（修正旧缓存里的重复分类） */
  autoRefresh?: boolean
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
  jdRaw,
  position,
  companyName,
  companyId,
  onAnalysisChange,
  compact = false,
  autoRefresh = false,
}: Props) {
  const [analysis, setAnalysis] = useState(initialAnalysis)
  const [classifying, setClassifying] = useState(false)
  const [message, setMessage] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [showCompany, setShowCompany] = useState(false)

  useEffect(() => {
    setAnalysis(initialAnalysis)
  }, [initialAnalysis])

  useEffect(() => {
    if (!autoRefresh || !jdRaw.trim()) return
    const next = analyzeJDByRules(jdRaw)
    void persistAnalysis(next)
  }, [autoRefresh, jdRaw, companyId])

  async function persistAnalysis(next: JdAnalysis) {
    setAnalysis(next)
    onAnalysisChange?.(next)
    if (companyId) await saveJdAnalysis(companyId, next)
  }

  async function handleClassify() {
    if (!jdRaw.trim()) {
      setMessage('请先录入 JD 文本')
      return
    }
    setClassifying(true)
    setMessage('')
    try {
      const next = analyzeJDByRules(jdRaw)
      await persistAnalysis(next)
      setMessage('分类完成')
    } finally {
      setClassifying(false)
    }
  }

  async function handleCopyForCursor() {
    if (!jdRaw.trim()) {
      setMessage('请先录入 JD 文本')
      return
    }
    const display = analysis ?? analyzeJDByRules(jdRaw)
    const text = buildCursorProjectPrompt({
      companyName,
      position: position || '（未填岗位名）',
      jdRaw,
      analysisSummary: buildAnalysisSummary(display),
    })
    try {
      await navigator.clipboard.writeText(text)
      setMessage('已复制，粘贴到 Cursor 对话即可让我带做项目')
    } catch {
      setMessage('复制失败，请检查浏览器剪贴板权限')
    }
  }

  const display = analysis

  return (
    <div className={`jd-analysis${compact ? ' jd-analysis-compact' : ''}`}>
      <div className="panel-head">
        <h3>职位要求</h3>
        <div className="quick-actions">
          {classifying && <span className="muted small">分类中…</span>}
          <button
            className="btn ghost"
            type="button"
            disabled={classifying || !jdRaw.trim()}
            onClick={() => void handleClassify()}
          >
            {display ? '重新分类' : '规则分类'}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!jdRaw.trim()}
            onClick={() => void handleCopyForCursor()}
          >
            复制给 Cursor
          </button>
        </div>
      </div>

      <p className="hint muted small">
        粘贴 JD 后会自动规则分类（无需 AI）。做项目：点「复制给 Cursor」，在本对话粘贴即可。
      </p>
      {message && <p className="hint">{message}</p>}
      {!display && jdRaw.trim() && (
        <p className="muted">正在自动分类… 也可手动点「规则分类」</p>
      )}
      {!display && !jdRaw.trim() && <p className="muted">粘贴 JD 后会显示结构化要求</p>}

      {display && (
        <>
          <div className="jd-primary-block">
            <h3 className="jd-block-title">职位要求（重点）</h3>
            <div className="jd-grid">
              {display.education.length > 0 && (
                <JdSection title="学历与专业">
                  <BulletList items={display.education} />
                </JdSection>
              )}
              {display.experience.length > 0 && (
                <JdSection title="经验要求">
                  <BulletList items={display.experience} />
                </JdSection>
              )}
              {display.hardSkills.length > 0 && (
                <JdSection title="硬技能 / 技术栈">
                  <TagList items={display.hardSkills} />
                </JdSection>
              )}
              {display.softSkills.length > 0 && (
                <JdSection title="软性素质">
                  <BulletList items={display.softSkills} />
                </JdSection>
              )}
              {display.projectRequirements.length > 0 && (
                <JdSection title="项目经历要求" highlight>
                  <BulletList items={display.projectRequirements} />
                </JdSection>
              )}
            </div>
            {display.responsibilities.length > 0 && (
              <div className="jd-grid jd-grid-wide">
                <JdSection title="岗位职责">
                  <BulletList items={display.responsibilities} />
                </JdSection>
              </div>
            )}
            {display.analyzedAt && (
              <p className="muted small">规则分类于 {new Date(display.analyzedAt).toLocaleString()}</p>
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
