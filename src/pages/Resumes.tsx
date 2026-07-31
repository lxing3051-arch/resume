import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Layout, EmptyState } from '../components/Layout'
import { db } from '../db/database'
import {
  createResumeVersion,
  deleteResumeVersion,
  downloadResumeFile,
  formatFileSize,
  removeResumeFile,
  updateResumeNotes,
  uploadResumeFile,
} from '../utils/resumeService'

export default function Resumes() {
  const resumes = useLiveQuery(() => db.resumes.orderBy('createdAt').reverse().toArray())
  const [newName, setNewName] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await createResumeVersion(newName.trim())
    setNewName('')
    setShowAdd(false)
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>简历版本</h1>
          <p className="muted">上传 PDF 保存在本地，投递时关联对应版本</p>
        </div>
        <button className="btn primary" type="button" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? '取消' : '+ 添加版本'}
        </button>
      </div>

      {showAdd && (
        <form className="panel resume-add-form" onSubmit={handleAdd}>
          <label className="field">
            <span>版本名称</span>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：Java后端版、前端版"
            />
          </label>
          <button className="btn primary" type="submit">
            创建
          </button>
        </form>
      )}

      {!resumes?.length ? (
        <EmptyState title="还没有简历版本" hint="创建版本后上传 PDF，添加公司时可选择关联" />
      ) : (
        <div className="card-grid">
          {resumes.map((resume) => (
            <div key={resume.id} className="company-card resume-card">
              <h3>{resume.name}</h3>
              {resume.fileName ? (
                <div className="file-info">
                  <span className="tag">📄 {resume.fileName}</span>
                  <span className="muted small">{formatFileSize(resume.fileSize)}</span>
                </div>
              ) : (
                <p className="muted small">尚未上传文件</p>
              )}
              <label className="field">
                <span>备注</span>
                <input
                  defaultValue={resume.notes ?? ''}
                  placeholder="适用岗位方向..."
                  onBlur={(e) => updateResumeNotes(resume.id!, e.target.value)}
                />
              </label>
              <div className="resume-actions">
                <label className="btn ghost file-btn">
                  {resume.fileBlob ? '更换 PDF' : '上传 PDF'}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    hidden
                    onChange={(e) =>
                      e.target.files?.[0] && uploadResumeFile(resume.id!, e.target.files[0])
                    }
                  />
                </label>
                {resume.fileBlob && (
                  <>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => downloadResumeFile(resume)}
                    >
                      下载
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => removeResumeFile(resume.id!)}
                    >
                      移除文件
                    </button>
                  </>
                )}
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => confirm('删除此版本？') && deleteResumeVersion(resume.id!)}
                >
                  删除
                </button>
              </div>
              <span className="muted small">创建于 {resume.createdAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}

      <section className="panel">
        <p className="hint">
          PDF 文件存储在浏览器 IndexedDB，不会上传云端。备份 JSON 时会包含 PDF（Base64 编码），文件较大时备份也会变大。
        </p>
      </section>
    </Layout>
  )
}
