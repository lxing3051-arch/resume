import { useEffect, useState } from 'react'
import type { JdAnalysis, JdNumberedSection } from '../types'
import { analyzeJDByRules, ensureStructuredAnalysis } from '../utils/jdAnalyzer'
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
  autoRefresh?: boolean
}

function SubCards({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted small">暂无</p>
  return (
    <div className="jd-subcard-grid">
      {items.map((item, i) => (
        <article key={i} className="jd-subcard">
          <span className="jd-subcard-index">{i + 1}</span>
          <p>{item}</p>
        </article>
      ))}
    </div>
  )
}

function NumberedCards({ sections }: { sections: JdNumberedSection[] }) {
  if (!sections.length) return <p className="muted small">暂无</p>
  return (
    <div className="jd-numbered-grid">
      {sections.map((section) => (
        <article key={`${section.index}-${section.title}`} className="jd-numbered-card">
          <h4>
            {section.index}. {section.title}
          </h4>
          <SubCards items={section.items} />
        </article>
      ))}
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
  const [analysis, setAnalysis] = useState(() =>
    ensureStructuredAnalysis(initialAnalysis, jdRaw),
  )
  const [classifying, setClassifying] = useState(false)
  const [message, setMessage] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [showCompany, setShowCompany] = useState(false)

  useEffect(() => {
    setAnalysis(ensureStructuredAnalysis(initialAnalysis, jdRaw))
  }, [initialAnalysis, jdRaw])

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
      setMessage('已复制到剪贴板')
    } catch {
      setMessage('复制失败，请检查浏览器剪贴板权限')
    }
  }

  const display = analysis

  return (
    <div className={`jd-analysis${compact ? ' jd-analysis-compact' : ''}`}>
      <div className="panel-head">
        <h3>职位分析</h3>
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
            复制
          </button>
        </div>
      </div>

      <p className="hint muted small">
        按原文小标题归类；小标题是卡片标题，下面的职责和要求以同级小卡片展示。
      </p>
      {message && <p className="hint">{message}</p>}

      {display && (
        <>
          <div className="jd-major-block">
            <h3 className="jd-block-title">岗位职责</h3>
            <NumberedCards sections={display.responsibilitySections} />
          </div>

          <div className="jd-major-block">
            <h3 className="jd-block-title">任职要求</h3>
            <NumberedCards sections={display.requirementSections} />
            {display.hardSkills.length > 0 && (
              <div className="jd-skills-row">
                <span className="muted small">提取的技术栈：</span>
                <div className="jd-tag-list">
                  {display.hardSkills.map((s) => (
                    <span key={s} className="tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
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

          {display.analyzedAt && (
            <p className="muted small">规则分类于 {new Date(display.analyzedAt).toLocaleString()}</p>
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
