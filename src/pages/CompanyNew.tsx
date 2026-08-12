import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout } from '../components/Layout'
import { CompanyForm } from '../components/CompanyForm'
import { createCompany } from '../utils/companyService'
import { emptyCompanyForm } from '../utils/companyForm'
import {
  clearPendingExtensionImport,
  extensionPayloadToForm,
  peekPendingExtensionImport,
  subscribeExtensionImport,
} from '../utils/extensionBridge'
import type { ExtensionImportPayload } from '../utils/extensionImport'
import { formToCompanyPayload } from '../utils/serialize'
import { analyzeJDByRules } from '../utils/jdAnalyzer'
import { db } from '../db/database'

export default function CompanyNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyCompanyForm())
  const [extensionNotice, setExtensionNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const formRef = useRef(form)
  formRef.current = form

  const resumes = useLiveQuery(() => db.resumes.toArray())

  function applyImport(payload: ExtensionImportPayload) {
    try {
      setForm((prev) => ({ ...prev, ...extensionPayloadToForm(payload, prev) }))
      setExtensionNotice('已从 Boss 插件导入，请确认信息后保存')
      setSaveError('')
      clearPendingExtensionImport()
    } catch (err) {
      console.error(err)
      setSaveError('插件数据解析失败，请尝试「从剪贴板导入」')
    }
  }

  useEffect(() => {
    const pending = peekPendingExtensionImport()
    if (pending) applyImport(pending)

    const unsub = subscribeExtensionImport(applyImport)

    let tries = 0
    const poll = window.setInterval(() => {
      tries++
      const p = peekPendingExtensionImport()
      if (p) applyImport(p)
      if (tries >= 50) window.clearInterval(poll)
    }, 300)

    return () => {
      unsub()
      window.clearInterval(poll)
    }
  }, [])

  function update(patch: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const current = formRef.current
    if (!current.name.trim()) {
      setSaveError('请填写公司名称（插件未识别时可手动输入）')
      return
    }
    if (!current.position.trim()) {
      setSaveError('请填写岗位名称')
      return
    }

    setSaving(true)
    setSaveError('')
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    try {
      const jdAnalysis =
        current.jdAnalysis ??
        (current.jdRaw.trim() ? analyzeJDByRules(current.jdRaw) : undefined)
      const id = await createCompany(formToCompanyPayload({ ...current, jdAnalysis }))
      navigate(`/company/${id}`)
    } catch (err) {
      console.error(err)
      const msg =
        err instanceof Error && err.message.includes('IndexedDB') ?
          '浏览器无法写入本地数据库，请关闭无痕模式或换 Chrome/Edge 重试'
        : '保存失败，请重试'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>添加公司</h1>
          <p className="muted">智能识别剪贴板 · 粘贴任意 JD · 自动分类关键信息</p>
          {extensionNotice && <p className="hint success-hint">{extensionNotice}</p>}
          {saveError && <p className="hint error-hint">{saveError}</p>}
        </div>
      </div>
      <CompanyForm
        form={form}
        onChange={update}
        submitLabel={saving ? '保存中…' : '保存并开始跟踪'}
        onSubmit={handleSubmit}
        resumeVersions={resumes ?? []}
        submitting={saving}
      />
    </Layout>
  )
}
