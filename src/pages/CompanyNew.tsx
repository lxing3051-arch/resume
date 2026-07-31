import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout } from '../components/Layout'
import { CompanyForm } from '../components/CompanyForm'
import { createCompany } from '../utils/companyService'
import { emptyCompanyForm, initSkillRatings } from '../utils/companyForm'
import {
  consumePendingExtensionImport,
  extensionPayloadToForm,
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
  const appliedRef = useRef(false)
  const resumes = useLiveQuery(() => db.resumes.toArray())

  useEffect(() => {
    function apply(payload: ExtensionImportPayload) {
      if (appliedRef.current && !payload.jdRaw) return
      appliedRef.current = true
      setForm((prev) => ({ ...prev, ...extensionPayloadToForm(payload, prev) }))
      setExtensionNotice('已从 Boss 插件导入，请确认信息后保存')
    }

    // 1. localStorage 兜底（插件 executeScript 写入）
    const pending = consumePendingExtensionImport()
    if (pending) apply(pending)

    // 2. 实时事件 / postMessage
    const unsub = subscribeExtensionImport(apply)

    // 3. React 晚于插件注入时，短暂轮询 localStorage
    let tries = 0
    const poll = window.setInterval(() => {
      tries++
      const p = consumePendingExtensionImport()
      if (p) apply(p)
      if (tries >= 30) window.clearInterval(poll)
    }, 200)

    return () => {
      unsub()
      window.clearInterval(poll)
    }
  }, [])

  function update(patch: Partial<typeof form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (patch.skills) {
        next.skillRatings = initSkillRatings(patch.skills, prev.skillRatings)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      const jdAnalysis =
        form.jdAnalysis ?? (form.jdRaw.trim() ? analyzeJDByRules(form.jdRaw) : undefined)
      const id = await createCompany(formToCompanyPayload({ ...form, jdAnalysis }))
      navigate(`/company/${id}`)
    } catch {
      setSaveError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>添加公司</h1>
          <p className="muted">Boss 插件一键导入 · Ollama 智能解析 · 截图 OCR</p>
          {extensionNotice && <p className="hint success-hint">{extensionNotice}</p>}
          {saveError && <p className="hint">{saveError}</p>}
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
