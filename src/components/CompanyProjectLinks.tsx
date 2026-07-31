import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { db } from '../db/database'
import {
  getLinkedProjects,
  linkProjectToCompany,
  unlinkProjectFromCompany,
  updateLinkPitch,
} from '../utils/companyProjectService'

interface Props {
  companyId: number
}

export function CompanyProjectLinks({ companyId }: Props) {
  const linked = useLiveQuery(() => getLinkedProjects(companyId), [companyId])
  const allProjects = useLiveQuery(() => db.projects.orderBy('title').toArray())
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [message, setMessage] = useState('')

  const linkedIds = new Set(linked?.map((l) => l.project.id) ?? [])
  const available = allProjects?.filter((p) => p.id && !linkedIds.has(p.id)) ?? []

  async function handleLink() {
    const projectId = Number(selectedProjectId)
    if (!projectId) {
      setMessage('请选择要关联的项目')
      return
    }
    await linkProjectToCompany(companyId, projectId)
    setSelectedProjectId('')
    setMessage('已关联')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>关联项目</h2>
        <Link to="/projects" className="muted small">
          管理项目库 →
        </Link>
      </div>
      <p className="hint muted small">同一项目可关联多个岗位；在此为当前岗位挑选要写的项目。</p>

      {linked && linked.length > 0 ? (
        <div className="project-list">
          {linked.map(({ link, project }) => (
            <article key={project.id} className="project-card compact">
              <div className="project-card-head">
                <strong>{project.title}</strong>
                <div className="quick-actions">
                  <Link className="btn ghost" to="/projects">
                    编辑项目
                  </Link>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => project.id && void unlinkProjectFromCompany(companyId, project.id)}
                  >
                    取消关联
                  </button>
                </div>
              </div>
              <span className="tag">{project.status === 'done' ? '已完成' : project.status === 'in_progress' ? '进行中' : '规划中'}</span>
              {project.files.length > 0 && (
                <p className="muted small">📎 {project.files.length} 个文件</p>
              )}
              <label className="field">
                <span>针对本岗位的简历表述（选填）</span>
                <textarea
                  rows={2}
                  defaultValue={link.pitch ?? ''}
                  placeholder="不写则用项目默认描述"
                  onBlur={(e) =>
                    project.id && void updateLinkPitch(companyId, project.id, e.target.value)
                  }
                />
              </label>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">尚未关联项目，可在下方选择或到「项目库」新建</p>
      )}

      {available.length > 0 && (
        <div className="link-project-row">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
            <option value="">选择已有项目…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button className="btn primary" type="button" onClick={() => void handleLink()}>
            关联
          </button>
        </div>
      )}

      {available.length === 0 && allProjects && allProjects.length > 0 && (
        <p className="muted small">项目库中的项目已全部关联到本岗位</p>
      )}

      {(!allProjects || allProjects.length === 0) && (
        <p className="muted small">
          <Link to="/projects">去项目库</Link> 创建第一个项目
        </p>
      )}

      {message && <p className="hint">{message}</p>}
    </section>
  )
}
