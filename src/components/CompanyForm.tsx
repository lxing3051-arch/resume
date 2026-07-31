import type { CompanyFormData } from '../utils/companyForm'
import { importFromClipboard } from '../utils/extensionBridge'
import { analyzeJDByRules, mergeSkillsFromAnalysis } from '../utils/jdAnalyzer'
import { parseJDText } from '../utils/jdParser'
import { recognizeImage } from '../utils/ocr'
import { JDAnalysisPanel } from './JDAnalysisPanel'
import type { ResumeVersion, Season } from '../types'
import { useEffect, useRef, useState } from 'react'

interface Props {
  form: CompanyFormData
  onChange: (patch: Partial<CompanyFormData>) => void
  submitLabel: string
  onSubmit: (e: React.FormEvent) => void
  showOcr?: boolean
  resumeVersions?: ResumeVersion[]
  submitting?: boolean
}

function applyParsed(
  form: CompanyFormData,
  text: string,
  parsed: ReturnType<typeof parseJDText>,
): Partial<CompanyFormData> {
  const skills = parsed.skills.length ? parsed.skills : form.skills
  const analysis = analyzeJDByRules(text)
  const mergedSkills = mergeSkillsFromAnalysis(analysis, skills)
  return {
    jdRaw: text,
    name: parsed.name || form.name,
    position: parsed.position || form.position,
    location: parsed.location || form.location,
    salary: parsed.salary || form.salary,
    requirements: parsed.requirements,
    responsibilities: parsed.responsibilities,
    skills: mergedSkills,
    jdAnalysis: analysis,
  }
}

export function CompanyForm({
  form,
  onChange,
  submitLabel,
  onSubmit,
  showOcr = true,
  resumeVersions = [],
  submitting = false,
}: Props) {
  const [ocrProgress, setOcrProgress] = useState<number | null>(null)
  const [importHint, setImportHint] = useState('')
  const formRef = useRef(form)
  formRef.current = form
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<CompanyFormData>) {
    onChange(patch)
  }

  async function handleImage(file: File) {
    setOcrProgress(0)
    try {
      const text = await recognizeImage(file, setOcrProgress)
      update(applyParsed(form, text, parseJDText(text)))
    } finally {
      setOcrProgress(null)
    }
  }

  function handleJdRawChange(text: string) {
    update({ jdRaw: text })
  }

  function runJdParse(text: string) {
    if (!text.trim()) {
      update({ jdAnalysis: undefined })
      return
    }
    update(applyParsed(formRef.current, text, parseJDText(text)))
  }

  useEffect(() => {
    if (!form.jdRaw.trim()) return
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current)
    parseTimerRef.current = setTimeout(() => runJdParse(form.jdRaw), 600)
    return () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current)
    }
  }, [form.jdRaw])

  async function handleClipboardImport() {
    try {
      const patch = await importFromClipboard(form)
      if (!patch) {
        setImportHint('剪贴板无插件数据，请先用 Boss 插件复制')
        return
      }
      update(patch)
      setImportHint('已从剪贴板导入 Boss 直聘数据')
    } catch {
      setImportHint('无法读取剪贴板，请检查浏览器权限')
    }
  }

  return (
    <div className="two-col">
      {showOcr && (
        <section className="panel">
          <h2>录入 JD</h2>
          <div className="quick-actions">
            <button className="btn primary" type="button" onClick={() => void handleClipboardImport()}>
              从剪贴板导入（插件）
            </button>
          </div>
          {importHint && <p className="hint">{importHint}</p>}
          <p className="hint">
            推荐：安装 <code>extension</code> 浏览器插件，在 Boss 直聘一键抓取（比 OCR 更准）。
          </p>
          <h3 className="section-title">截图 OCR（备选）</h3>
          <label className="upload-box">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
            />
            <span>{ocrProgress !== null ? `识别中 ${ocrProgress}%` : '点击上传截图'}</span>
          </label>
          <label className="field">
            <span>或粘贴 JD 文本</span>
            <textarea
              rows={8}
              value={form.jdRaw}
              onChange={(e) => handleJdRawChange(e.target.value)}
              onBlur={() => runJdParse(form.jdRaw)}
              placeholder="从 Boss 直聘复制岗位描述粘贴到这里..."
            />
          </label>
        </section>
      )}

      <form className="panel" onSubmit={onSubmit} noValidate>
        <h2>{showOcr ? '确认信息' : '编辑信息'}</h2>
        <div className="form-grid">
          <label className="field">
            <span>公司名称</span>
            <input required value={form.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label className="field">
            <span>岗位</span>
            <input required value={form.position} onChange={(e) => update({ position: e.target.value })} />
          </label>
          <label className="field">
            <span>赛季</span>
            <select value={form.season} onChange={(e) => update({ season: e.target.value as Season })}>
              {(['秋招', '春招', '实习', '社招', '其他'] as Season[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>年份</span>
            <input type="number" value={form.year} onChange={(e) => update({ year: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>地点</span>
            <input value={form.location} onChange={(e) => update({ location: e.target.value })} />
          </label>
          <label className="field">
            <span>薪资</span>
            <input value={form.salary} onChange={(e) => update({ salary: e.target.value })} />
          </label>
          <label className="field">
            <span>截止日期</span>
            <input type="date" value={form.deadline} onChange={(e) => update({ deadline: e.target.value })} />
          </label>
          <label className="field">
            <span>Boss 链接（选填）</span>
            <input value={form.bossUrl} onChange={(e) => update({ bossUrl: e.target.value })} />
          </label>
          <label className="field">
            <span>投递简历版本</span>
            <select
              value={form.resumeVersionId}
              onChange={(e) =>
                update({
                  resumeVersionId: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">未选择</option>
              {resumeVersions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3 className="section-title">联系人（选填）</h3>
        <div className="form-grid">
          <label className="field">
            <span>内推人</span>
            <input value={form.referrerName} onChange={(e) => update({ referrerName: e.target.value })} />
          </label>
          <label className="field">
            <span>内推联系方式</span>
            <input
              value={form.referrerContact}
              onChange={(e) => update({ referrerContact: e.target.value })}
              placeholder="微信 / 手机 / 邮箱"
            />
          </label>
          <label className="field">
            <span>HR 姓名</span>
            <input value={form.hrName} onChange={(e) => update({ hrName: e.target.value })} />
          </label>
          <label className="field">
            <span>HR 联系方式</span>
            <input
              value={form.hrContact}
              onChange={(e) => update({ hrContact: e.target.value })}
              placeholder="微信 / 手机 / 邮箱"
            />
          </label>
        </div>

        {form.jdRaw.trim() && (
          <JDAnalysisPanel
            analysis={form.jdAnalysis}
            jdRaw={form.jdRaw}
            position={form.position}
            companyName={form.name}
            compact
            onAnalysisChange={(jdAnalysis) => {
              const skills = mergeSkillsFromAnalysis(jdAnalysis, form.skills)
              update({
                jdAnalysis,
                skills,
              })
            }}
          />
        )}

        <label className="field">
          <span>任职要求</span>
          <textarea rows={4} value={form.requirements} onChange={(e) => update({ requirements: e.target.value })} />
        </label>
        <label className="field">
          <span>岗位职责</span>
          <textarea
            rows={4}
            value={form.responsibilities}
            onChange={(e) => update({ responsibilities: e.target.value })}
          />
        </label>
        {!showOcr && (
          <label className="field">
            <span>原始 JD</span>
            <textarea rows={4} value={form.jdRaw} onChange={(e) => update({ jdRaw: e.target.value })} />
          </label>
        )}
        <label className="field">
          <span>备注</span>
          <textarea rows={3} value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
        </label>

        <button className="btn primary" type="submit" disabled={submitting}>
          {submitLabel}
        </button>
      </form>
    </div>
  )
}
