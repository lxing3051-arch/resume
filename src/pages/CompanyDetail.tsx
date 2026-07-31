import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Layout, StatusBadge, daysUntil } from '../components/Layout'
import { JDAnalysisPanel } from '../components/JDAnalysisPanel'
import { CompanyProjectLinks } from '../components/CompanyProjectLinks'
import { db } from '../db/database'
import { addCustomStage, updateStageStatus, deleteCompany } from '../utils/companyService'
import { createInterviewNote, updateStageSchedule } from '../utils/noteService'
import { downloadResumeFile } from '../utils/resumeService'
import type { StageStatus, StageType } from '../types'

const STAGE_STATUS: StageStatus[] = ['未开始', '进行中', '已完成', '已跳过']

export default function CompanyDetail() {
  const { id } = useParams()
  const companyId = Number(id)
  const navigate = useNavigate()
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  const company = useLiveQuery(() => db.companies.get(companyId), [companyId])
  const stages = useLiveQuery(
    () => db.stages.where('companyId').equals(companyId).sortBy('order'),
    [companyId],
  )
  const companyNotes = useLiveQuery(async () => {
    const list = await db.interviewNotes.where('companyId').equals(companyId).toArray()
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [companyId])
  const resume = useLiveQuery(
    () => (company?.resumeVersionId ? db.resumes.get(company.resumeVersionId) : undefined),
    [company?.resumeVersionId],
  )

  if (company === undefined) return <Layout>加载中...</Layout>
  if (!company) return <Layout>未找到该公司</Layout>

  const stageList = stages ?? []

  async function handleDelete() {
    if (!confirm('确定删除这条记录？')) return
    await deleteCompany(companyId)
    navigate('/')
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteTitle.trim() || !noteContent.trim() || !company) return
    await createInterviewNote({
      companyId,
      companyName: company.name,
      title: noteTitle.trim(),
      content: noteContent.trim(),
    })
    setNoteTitle('')
    setNoteContent('')
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 返回看板
          </Link>
          <h1>{company.name}</h1>
          <p>{company.position}</p>
        </div>
        <div className="header-actions">
          <Link to={`/company/${companyId}/edit`} className="btn ghost">
            编辑
          </Link>
          <StatusBadge status={company.status} />
        </div>
      </div>

      <div className="detail-meta">
        <span>
          {company.season} · {company.year}
        </span>
        {company.location && <span>{company.location}</span>}
        {company.salary && <span>{company.salary}</span>}
        {company.deadline && <span>截止 {company.deadline}</span>}
        {daysUntil(company.deadline) && <span className="deadline">{daysUntil(company.deadline)}</span>}
      </div>

      <section className="panel panel-stages">
        <div className="panel-head">
          <h2>进度跟踪</h2>
          <button
            className="btn ghost"
            type="button"
            onClick={() => addCustomStage(companyId, '其他')}
          >
            + 阶段
          </button>
        </div>
        <div className="stage-pipeline">
          {stageList.map((stage, index) => (
            <div key={stage.id} className="stage-pipeline-item">
              {index > 0 && <div className="stage-pipeline-line" aria-hidden />}
              <div className="stage-block" data-status={stage.status}>
                <div className="stage-row">
                  <strong>{stage.type}</strong>
                  <select
                    value={stage.status}
                    onChange={(e) =>
                      updateStageStatus(stage.id!, companyId, e.target.value as StageStatus)
                    }
                  >
                    {STAGE_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {stage.completedAt && (
                    <span className="muted small stage-done-date">{stage.completedAt.slice(0, 10)}</span>
                  )}
                </div>
                <details className="stage-details">
                  <summary>时间 / 备注</summary>
                  <label className="field inline stage-field">
                    <span>安排时间</span>
                    <input
                      type="datetime-local"
                      value={stage.scheduledAt?.slice(0, 16) ?? ''}
                      onChange={(e) =>
                        updateStageSchedule(stage.id!, {
                          scheduledAt:
                            e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                    />
                  </label>
                  <label className="field inline stage-field">
                    <span>备注</span>
                    <input
                      placeholder="会议链接等"
                      defaultValue={stage.notes ?? ''}
                      onBlur={(e) => updateStageSchedule(stage.id!, { notes: e.target.value })}
                    />
                  </label>
                </details>
              </div>
            </div>
          ))}
        </div>
        <div className="quick-actions stage-quick-actions">
          {(['笔试', '一面', '拒信'] as StageType[]).map((type) => (
            <button
              key={type}
              type="button"
              className="btn ghost"
              onClick={() => addCustomStage(companyId, type)}
            >
              + {type}
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel-jd">
        <h2>岗位要求</h2>
        <JDAnalysisPanel
          analysis={company.jdAnalysis}
          jdRaw={company.jdRaw}
          position={company.position}
          companyName={company.name}
          companyId={companyId}
        />
      </section>

      <CompanyProjectLinks companyId={companyId} />

      <section className="panel">
        <div className="panel-head">
          <h2>面经笔记</h2>
          <Link to="/notes" className="muted small">
            查看全部 →
          </Link>
        </div>
        <form className="note-form compact" onSubmit={handleAddNote}>
          <input
            placeholder="标题，例如：一面面经"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
          />
          <textarea
            rows={3}
            placeholder="记录面试题、回答、反思..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <button className="btn primary" type="submit">
            添加笔记
          </button>
        </form>
        {companyNotes && companyNotes.length > 0 && (
          <div className="note-list compact">
            {companyNotes.map((note) => (
              <div key={note.id} className="note-card compact">
                <strong>{note.title}</strong>
                {note.stageType && <span className="tag">{note.stageType}</span>}
                <pre className="text-block">{note.content}</pre>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>联系人与投递</h2>
        <div className="contact-grid">
          {(company.referrerName || company.referrerContact) && (
            <div className="contact-card">
              <strong>内推人</strong>
              <p>{company.referrerName}</p>
              {company.referrerContact && (
                <a href={`tel:${company.referrerContact}`}>{company.referrerContact}</a>
              )}
            </div>
          )}
          {(company.hrName || company.hrContact) && (
            <div className="contact-card">
              <strong>HR</strong>
              <p>{company.hrName}</p>
              {company.hrContact && <a href={`tel:${company.hrContact}`}>{company.hrContact}</a>}
            </div>
          )}
          {resume && (
            <div className="contact-card">
              <strong>投递简历</strong>
              <p>{resume.name}</p>
              {resume.fileName && <span className="muted small">{resume.fileName}</span>}
              {resume.fileBlob && (
                <button className="btn ghost" type="button" onClick={() => downloadResumeFile(resume)}>
                  下载 PDF
                </button>
              )}
            </div>
          )}
        </div>
        {!company.referrerName &&
          !company.hrName &&
          !resume && (
            <p className="muted">可在「编辑」页添加内推人、HR 和关联简历版本</p>
          )}
      </section>

      <section className="panel">
        <h2>其他信息</h2>
        <div className="detail-meta">
          {company.bossUrl && (
            <a href={company.bossUrl} target="_blank" rel="noreferrer">
              Boss 直聘链接
            </a>
          )}
        </div>
        {company.notes && <pre className="text-block">{company.notes}</pre>}
        <button className="btn danger" type="button" onClick={handleDelete}>
          删除记录
        </button>
      </section>
    </Layout>
  )
}
