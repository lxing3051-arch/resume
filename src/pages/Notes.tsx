import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Layout, EmptyState } from '../components/Layout'
import { db } from '../db/database'
import {
  createInterviewNote,
  deleteInterviewNote,
  updateInterviewNote,
} from '../utils/noteService'
import type { StageType } from '../types'

const STAGE_TYPES: StageType[] = [
  '笔试',
  '一面',
  '二面',
  '三面',
  'HR面',
  'OC',
  '其他',
]

export default function Notes() {
  const notes = useLiveQuery(() => db.interviewNotes.orderBy('updatedAt').reverse().toArray())
  const companies = useLiveQuery(() => db.companies.toArray())
  const [query, setQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState<number | '全部'>('全部')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    companyId: '' as string,
    stageType: '' as StageType | '',
    title: '',
    content: '',
    tags: '',
  })

  const filtered = useMemo(() => {
    if (!notes) return []
    return notes.filter((note) => {
      if (companyFilter !== '全部' && note.companyId !== companyFilter) return false
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.companyName?.toLowerCase().includes(q) ||
        note.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [notes, companyFilter, query])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const company = companies?.find((c) => c.id === Number(form.companyId))
    await createInterviewNote({
      companyId: company?.id,
      companyName: company?.name,
      stageType: form.stageType || undefined,
      title: form.title.trim(),
      content: form.content.trim(),
      tags: form.tags
        .split(/[,，、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    })
    setForm({ companyId: '', stageType: '', title: '', content: '', tags: '' })
    setShowForm(false)
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>面经笔记</h1>
          <p className="muted">记录笔试题、面试问题、HR 沟通要点</p>
        </div>
        <button className="btn primary" type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '取消' : '+ 写笔记'}
        </button>
      </div>

      {showForm && (
        <form className="panel note-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>关联公司（选填）</span>
              <select
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
              >
                <option value="">不关联</option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.position}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>阶段（选填）</span>
              <select
                value={form.stageType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stageType: e.target.value as StageType | '' }))
                }
              >
                <option value="">不限</option>
                {STAGE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>标题</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例如：字节一面 - 项目深挖"
            />
          </label>
          <label className="field">
            <span>内容</span>
            <textarea
              required
              rows={6}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="题目、回答思路、反思..."
            />
          </label>
          <label className="field">
            <span>标签（逗号分隔）</span>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="算法, 项目, Java"
            />
          </label>
          <button className="btn primary" type="submit">
            保存笔记
          </button>
        </form>
      )}

      <div className="filters">
        <input
          placeholder="搜索标题、内容、标签..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={companyFilter}
          onChange={(e) =>
            setCompanyFilter(e.target.value === '全部' ? '全部' : Number(e.target.value))
          }
        >
          <option value="全部">全部公司</option>
          {companies?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        <EmptyState title="还没有面经笔记" hint="面试结束后及时记录，方便复盘和准备下一家" />
      ) : (
        <div className="note-list">
          {filtered.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={() => deleteInterviewNote(note.id!)} />
          ))}
        </div>
      )}
    </Layout>
  )
}

function NoteCard({ note, onDelete }: { note: import('../types').InterviewNote; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(note.content)

  async function saveEdit() {
    await updateInterviewNote(note.id!, { content })
    setEditing(false)
  }

  return (
    <article className="panel note-card">
      <div className="card-top">
        <div>
          <h3>{note.title}</h3>
          <div className="detail-meta">
            {note.companyName && (
              <>
                {note.companyId ? (
                  <Link to={`/company/${note.companyId}`}>{note.companyName}</Link>
                ) : (
                  <span>{note.companyName}</span>
                )}
              </>
            )}
            {note.stageType && <span>{note.stageType}</span>}
            <span className="muted small">{note.updatedAt.slice(0, 10)}</span>
          </div>
        </div>
        <div className="note-actions">
          <button className="btn ghost" type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? '取消' : '编辑'}
          </button>
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              if (confirm('删除？')) void onDelete()
            }}
          >
            删除
          </button>
        </div>
      </div>
      {note.tags.length > 0 && (
        <div className="tags">
          {note.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {editing ? (
        <>
          <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          <button className="btn primary" type="button" onClick={saveEdit}>
            保存
          </button>
        </>
      ) : (
        <pre className="text-block">{note.content}</pre>
      )}
    </article>
  )
}
