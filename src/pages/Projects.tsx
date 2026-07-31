import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Layout, EmptyState } from '../components/Layout'
import { db } from '../db/database'
import { getLinkedCompanies } from '../utils/companyProjectService'
import {
  addProjectFile,
  createProject,
  deleteProject,
  downloadProjectFile,
  formatFileSize,
  parseCommaList,
  parseLines,
  removeProjectFile,
  updateProject,
} from '../utils/projectService'
import type { PortfolioProject, ProjectStatus } from '../types'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: '规划中',
  in_progress: '进行中',
  done: '已完成',
}

function ProjectCard({ project }: { project: PortfolioProject }) {
  const linked = useLiveQuery(
    () => (project.id ? getLinkedCompanies(project.id) : []),
    [project.id],
  )
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const [techStackText, setTechStackText] = useState(project.techStack.join('、'))
  const [highlightsText, setHighlightsText] = useState(project.highlights.join('\n'))
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? '')
  const [notes, setNotes] = useState(project.notes ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)

  async function handleSave() {
    if (!project.id || !title.trim()) return
    await updateProject(project.id, {
      title: title.trim(),
      description: description.trim(),
      techStack: parseCommaList(techStackText),
      highlights: parseLines(highlightsText),
      repoUrl: repoUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    })
    setEditing(false)
  }

  return (
    <article className="company-card project-card">
      <div className="project-card-head">
        {editing ? (
          <input className="project-title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        ) : (
          <h3>{project.title}</h3>
        )}
        <span className="tag">{STATUS_LABEL[project.status]}</span>
      </div>

      {editing ? (
        <div className="project-edit-form">
          <label className="field">
            <span>项目描述</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="field">
            <span>技术栈（逗号分隔）</span>
            <input value={techStackText} onChange={(e) => setTechStackText(e.target.value)} />
          </label>
          <label className="field">
            <span>简历亮点（每行一条）</span>
            <textarea rows={4} value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} />
          </label>
          <label className="field">
            <span>仓库链接（选填）</span>
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
          </label>
          <label className="field">
            <span>备注</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="field">
            <span>状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="quick-actions">
            <button className="btn primary" type="button" onClick={() => void handleSave()}>
              保存
            </button>
            <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          {project.description && <p>{project.description}</p>}
          {project.techStack.length > 0 && (
            <div className="jd-tag-list">
              {project.techStack.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          {project.highlights.length > 0 && (
            <ul className="jd-bullet-list">
              {project.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="muted small">
              {project.repoUrl}
            </a>
          )}
        </>
      )}

      <div className="project-files">
        <strong className="small">项目文件</strong>
        {project.files.length === 0 && <p className="muted small">可上传代码压缩包、文档、截图等</p>}
        {project.files.map((file) => (
          <div key={file.id} className="file-info">
            <span className="tag">📎 {file.fileName}</span>
            <span className="muted small">{formatFileSize(file.fileSize)}</span>
            {file.fileBlob && (
              <button className="btn ghost" type="button" onClick={() => downloadProjectFile(file)}>
                下载
              </button>
            )}
            <button
              className="btn ghost"
              type="button"
              onClick={() => project.id && void removeProjectFile(project.id, file.id)}
            >
              移除
            </button>
          </div>
        ))}
        <label className="btn ghost file-btn">
          上传文件
          <input
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f && project.id) void addProjectFile(project.id, f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {linked && linked.length > 0 && (
        <div className="project-links">
          <strong className="small">已关联岗位（{linked.length}）</strong>
          <ul className="link-list">
            {linked.map(({ company }) => (
              <li key={company.id}>
                <Link to={`/company/${company.id}`}>
                  {company.name} · {company.position}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!editing && (
        <div className="resume-actions">
          <button className="btn ghost" type="button" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button
            className="btn danger"
            type="button"
            onClick={() =>
              confirm('删除项目？关联关系也会解除，文件不可恢复') &&
              project.id &&
              void deleteProject(project.id)
            }
          >
            删除
          </button>
        </div>
      )}

      <span className="muted small">更新于 {project.updatedAt.slice(0, 10)}</span>
    </article>
  )
}

export default function Projects() {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray())
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createProject({ title: newTitle.trim() })
    setNewTitle('')
    setShowAdd(false)
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>项目库</h1>
          <p className="muted">一个项目可关联多个岗位，一个岗位也可挂多个项目。文件保存在浏览器本地。</p>
        </div>
        <button className="btn primary" type="button" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? '取消' : '+ 新建项目'}
        </button>
      </div>

      {showAdd && (
        <form className="panel resume-add-form" onSubmit={handleAdd}>
          <label className="field">
            <span>项目名称</span>
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：电商用户行为分析平台"
            />
          </label>
          <button className="btn primary" type="submit">
            创建
          </button>
        </form>
      )}

      {!projects?.length ? (
        <EmptyState
          title="还没有项目"
          hint="在 Cursor 里做完项目后，在这里建档并上传文件；到公司详情页关联岗位"
        />
      ) : (
        <div className="card-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <section className="panel">
        <p className="hint">
          项目与岗位是多对多关系：同一套代码/分析项目可以写进多份 JD 匹配的简历；一个岗位也可以选多个项目展示不同能力。
          备份 JSON 时会包含项目文件（Base64），体积可能较大。
        </p>
      </section>
    </Layout>
  )
}
