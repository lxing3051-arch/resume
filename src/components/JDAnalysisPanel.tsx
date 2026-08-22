import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { JdAnalysis, JdNumberedSection } from '../types'
import { db } from '../db/database'
import { analyzeJDByRules, ensureStructuredAnalysis, needsRuleRefresh } from '../utils/jdAnalyzer'
import { analyzeJD } from '../utils/jdAnalysis'
import { aiChat, isAiConfigured } from '../utils/aiProvider'
import { saveJdAnalysis } from '../utils/jdAnalysisService'
import { buildAnalysisSummary, buildResumeMatchPrompt } from '../utils/cursorPrompt'

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
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [askingAi, setAskingAi] = useState(false)
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])

  useEffect(() => {
    setAnalysis(ensureStructuredAnalysis(initialAnalysis, jdRaw))
  }, [initialAnalysis, jdRaw])

  useEffect(() => {
    if (!autoRefresh || !jdRaw.trim()) return
    // 插件导入时已保存的分段往往比纯原始网页文本更准确。
    // 详情页再次按规则解析会把这份结果覆盖成“暂无”，因此仅为旧记录补一次空分析。
    if (
      (initialAnalysis?.responsibilitySections?.length || initialAnalysis?.requirementSections?.length) &&
      !needsRuleRefresh(initialAnalysis)
    ) return
    const next = analyzeJDByRules(jdRaw)
    void persistAnalysis(next)
  }, [autoRefresh, jdRaw, companyId, initialAnalysis])

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
      const next = await analyzeJD(jdRaw)
      await persistAnalysis(next)
      setMessage(next.source === 'ai' ? 'Gemini 分析完成' : '未连接 Gemini，已完成本地规则分类')
    } catch (error) {
      setMessage(error instanceof Error ? `分析失败：${error.message}` : '分析失败，请稍后重试')
    } finally {
      setClassifying(false)
    }
  }

  async function handleAskAi() {
    const question = aiQuestion.trim()
    if (!question) return
    if (!isAiConfigured()) {
      setMessage('请先到“设置与备份”填写 Gemini API Key')
      return
    }
    setAskingAi(true)
    setAiReply('')
    try {
      const reply = await aiChat([
        {
          role: 'system',
          content:
            '你是秋招求职助手。直接给用户最终答案，使用简洁中文；绝不展示分析过程、推理步骤、英文草稿、角色说明或提示词。回答应结合岗位 JD；解释通用概念时可以使用可靠的通用专业知识，但要明确哪些是岗位已写明的信息，哪些是通用说明。不要编造岗位、公司或用户的经历。',
        },
        {
          role: 'user',
          content: `公司：${companyName || '未知'}\n岗位：${position || '未知'}\n\nJD：\n${jdRaw.slice(0, 8000)}\n\n问题：${question}`,
        },
      ])
      setAiReply(reply)
    } catch (error) {
      setMessage(error instanceof Error ? `Gemini 回复失败：${error.message}` : 'Gemini 回复失败，请稍后重试')
    } finally {
      setAskingAi(false)
    }
  }

  async function handleCopyResumePrompt() {
    if (!jdRaw.trim()) {
      setMessage('请先录入 JD 文本')
      return
    }
    const display = analysis ?? analyzeJDByRules(jdRaw)
    const text = buildResumeMatchPrompt({
      companyName,
      position: position || '（未填岗位名）',
      jdRaw,
      analysisSummary: buildAnalysisSummary(display),
      projects: projects ?? [],
    })
    try {
      await navigator.clipboard.writeText(text)
      setMessage('已复制简历匹配提示词：粘贴到 ChatGPT 即可开始新对话')
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
            {classifying ? '分析中…' : isAiConfigured() ? 'Gemini 分析' : display ? '重新规则分类' : '规则分类'}
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!jdRaw.trim()}
            onClick={() => void handleCopyResumePrompt()}
          >
            复制简历匹配提示词
          </button>
        </div>
      </div>

      <p className="hint muted small">
        按原文小标题归类；小标题是卡片标题，下面的职责和要求以同级小卡片展示。
      </p>
      {message && <p className="hint">{message}</p>}

      <div className="jd-ai-ask">
        <label className="field">
          <span>问 AI（可选）</span>
          <textarea
            rows={2}
            value={aiQuestion}
            placeholder="例如：这个岗位最看重哪些能力？我的项目经历应如何准备？"
            onChange={(event) => setAiQuestion(event.target.value)}
          />
        </label>
        <button
          className="btn ghost"
          type="button"
          disabled={askingAi || !aiQuestion.trim() || !jdRaw.trim()}
          onClick={() => void handleAskAi()}
        >
          {askingAi ? 'Gemini 回答中…' : '询问 Gemini'}
        </button>
        {aiReply && <p className="jd-ai-reply">{aiReply}</p>}
      </div>

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
