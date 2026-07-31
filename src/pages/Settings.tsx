import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { downloadBackup, exportBackup, importBackup } from '../utils/backup'
import { downloadCompaniesCsv } from '../utils/exportCsv'
import {
  clearSyncFolder,
  getSyncFolderName,
  pickSyncFolder,
  readLatestBackupFromFolder,
  supportsFolderSync,
  syncBackupToFolder,
} from '../utils/folderSync'
import {
  checkAndNotify,
  getNotificationSettings,
  requestNotificationPermission,
  saveNotificationSettings,
} from '../utils/notifications'
import { checkOllamaAvailable, listOllamaModels } from '../utils/ollama'
import { getAiSettings, getProviderLabel, saveAiSettings } from '../utils/aiSettings'
import { getActiveProviderLabel } from '../utils/aiProvider'
import { getOllamaSettings, saveOllamaSettings } from '../utils/ollamaSettings'
import {
  GEMINI_MODELS,
  getGeminiSettings,
  listGeminiModels,
  saveGeminiSettings,
  testGeminiConnection,
} from '../utils/gemini'
import { getThemeMode, saveThemeMode } from '../utils/theme'
import type {
  AiProvider,
  GeminiSettings,
  NotificationSettings,
  OllamaSettings,
  ThemeMode,
} from '../types'

export default function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings())
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode())
  const [ollama, setOllama] = useState<OllamaSettings>(getOllamaSettings())
  const [ai, setAi] = useState(getAiSettings())
  const [gemini, setGemini] = useState<GeminiSettings>(getGeminiSettings())
  const [ollamaStatus, setOllamaStatus] = useState('')
  const [geminiStatus, setGeminiStatus] = useState('')
  const [geminiModelOptions, setGeminiModelOptions] = useState<string[]>([...GEMINI_MODELS])
  const [aiStatus, setAiStatus] = useState('检测中…')
  const [models, setModels] = useState<string[]>([])
  const [syncFolder, setSyncFolder] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )

  useEffect(() => {
    void getSyncFolderName().then(setSyncFolder)
  }, [])

  useEffect(() => {
    void refreshAiStatus()
  }, [ai.provider, gemini.apiKey, ollama.enabled])

  async function refreshAiStatus() {
    setAiStatus(await getActiveProviderLabel())
  }

  function updateSettings(patch: Partial<NotificationSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveNotificationSettings(next)
  }

  function updateTheme(mode: ThemeMode) {
    setTheme(mode)
    saveThemeMode(mode)
  }

  function updateOllama(patch: Partial<OllamaSettings>) {
    const next = { ...ollama, ...patch }
    setOllama(next)
    saveOllamaSettings(next)
  }

  function updateAi(patch: Partial<typeof ai>) {
    const next = { ...ai, ...patch }
    setAi(next)
    saveAiSettings(next)
  }

  function updateGemini(patch: Partial<GeminiSettings>) {
    const next = { ...gemini, ...patch }
    setGemini(next)
    saveGeminiSettings(next)
  }

  async function handleTestOllama() {
    setOllamaStatus('检测中...')
    const ok = await checkOllamaAvailable()
    if (!ok) {
      setOllamaStatus('未连接。这是 Ollama 本地服务，与 Gemini 无关。只用 Gemini 可忽略本节，或运行 ollama serve')
      return
    }
    try {
      const list = await listOllamaModels()
      setModels(list)
      setOllamaStatus(`已连接，${list.length} 个模型可用`)
      if (list.length && !list.includes(ollama.model)) {
        updateOllama({ model: list[0]! })
      }
    } catch {
      setOllamaStatus('已连接但无法列出模型')
    }
  }

  async function handleTestGemini() {
    setGeminiStatus('检测中...')
    try {
      const msg = await testGeminiConnection()
      const list = await listGeminiModels(gemini.apiKey)
      setGeminiModelOptions(list)
      setGemini({ ...getGeminiSettings() })
      updateAi({ provider: 'gemini' })
      setGeminiStatus(`${msg} · 已切换为 Gemini 引擎`)
      void refreshAiStatus()
    } catch (e) {
      setGeminiStatus(e instanceof Error ? e.message : '连接失败')
    }
  }

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission()
    setPermission(result === 'unsupported' ? 'unsupported' : result)
    if (result === 'granted') {
      updateSettings({ enabled: true })
      await checkAndNotify()
    }
  }

  async function handleExport() {
    const content = await exportBackup()
    downloadBackup(content, `job-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`)
  }

  async function handleImport(file: File) {
    const text = await file.text()
    if (!confirm('导入会覆盖当前所有数据，确定继续？')) return
    await importBackup(text)
    alert('导入成功')
    window.location.href = '/'
  }

  async function handlePickFolder() {
    try {
      const name = await pickSyncFolder()
      setSyncFolder(name)
      setSyncMsg(`已选择文件夹：${name}`)
    } catch {
      setSyncMsg('未选择文件夹')
    }
  }

  async function handleSyncNow() {
    try {
      await syncBackupToFolder()
      setSyncMsg('已写入备份 JSON 到同步文件夹')
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败')
    }
  }

  async function handleRestoreFromFolder() {
    try {
      const text = await readLatestBackupFromFolder()
      if (!text) {
        setSyncMsg('文件夹中没有备份文件')
        return
      }
      if (!confirm('从文件夹恢复会覆盖当前数据，确定？')) return
      await importBackup(text)
      alert('已从文件夹恢复')
      window.location.href = '/'
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '恢复失败')
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>设置与备份</h1>
          <p className="muted">插件、AI 引擎、文件夹同步、外观</p>
        </div>
      </div>

      <section className="panel">
        <h2>Boss 直聘浏览器插件（免费）</h2>
        <p className="hint">比截图 OCR 更准确，一键抓取 JD 导入本网站。</p>
        <ol className="info-list">
          <li>Chrome 打开 <code>chrome://extensions</code>，开启开发者模式</li>
          <li>加载已解压的扩展程序 → 选择项目内 <code>extension</code> 文件夹</li>
          <li>打开 Boss 直聘岗位页，点插件图标 → 导入秋招助手</li>
        </ol>
        <p className="hint">详见 <code>extension/README.md</code></p>
      </section>

      <section className="panel">
        <h2>AI 引擎</h2>
        <p className="hint">JD 分析、项目生成、带做辅导均使用此处配置的引擎。</p>
        <div className="settings-row">
          <span>当前状态</span>
          <strong>{aiStatus}</strong>
        </div>
        <label className="field">
          <span>优先使用</span>
          <select
            value={ai.provider}
            onChange={(e) => updateAi({ provider: e.target.value as AiProvider })}
          >
            <option value="auto">自动（优先 Gemini，不可用则 Ollama）</option>
            <option value="gemini">Gemini Pro（云端）</option>
            <option value="ollama">Ollama（本地）</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={ai.autoAnalyze}
            onChange={(e) => updateAi({ autoAnalyze: e.target.checked })}
          />
          录入 JD 后自动 AI 分析
        </label>
        <p className="hint muted small">当前策略：{getProviderLabel(ai.provider)}</p>
      </section>

      <section className="panel">
        <h2>Gemini Pro（Google AI）</h2>
        <p className="hint">
          在{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>{' '}
          用<strong>同一个 Google 账号</strong>创建 API Key（与 Gemini Pro 订阅同账号即可，无需 Edge/Copilot）。
          带做项目推荐选 API 返回的 <code>gemini-2.5-flash</code>。
          若报 429 / Quota limit 0，说明该模型对你 Key 无免费额度，请换 2.5 系列。
        </p>
        <p className="hint muted small">
          API Key 仅保存在浏览器本地。新版 Key 以 <code>AQ.</code> 开头正常。
          <strong> Gemini 请在本地 </strong><code>npm run dev</code> 使用（已修复代理）；GitHub Pages 线上可能无法直连。
        </p>
        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            value={gemini.apiKey}
            placeholder="AIza... 或 AQ...."
            autoComplete="off"
            onChange={(e) => updateGemini({ apiKey: e.target.value.trim() })}
          />
        </label>
        <label className="field">
          <span>模型</span>
          <select value={gemini.model} onChange={(e) => updateGemini({ model: e.target.value })}>
            {geminiModelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" type="button" onClick={() => void handleTestGemini()}>
          测试 Gemini 连接
        </button>
        {geminiStatus && <p className="hint">{geminiStatus}</p>}
      </section>

      <section className="panel panel-muted">
        <h2>Ollama 本地 AI（可选）</h2>
        <p className="hint">
          <strong>已配置 Gemini 时不必安装 Ollama。</strong> 本节仅作免费本地备用。
          安装 <a href="https://ollama.com">Ollama</a> 后运行 <code>ollama serve</code> 与 <code>ollama pull llama3.2</code>。
        </p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={ollama.enabled}
            onChange={(e) => updateOllama({ enabled: e.target.checked })}
          />
          启用 Ollama 作为 AI 引擎（或自动模式的备用）
        </label>
        <label className="field">
          <span>Ollama 地址</span>
          <input
            value={ollama.baseUrl}
            onChange={(e) => updateOllama({ baseUrl: e.target.value.replace(/\/$/, '') })}
          />
        </label>
        <label className="field">
          <span>模型名称</span>
          {models.length > 0 ? (
            <select value={ollama.model} onChange={(e) => updateOllama({ model: e.target.value })}>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input value={ollama.model} onChange={(e) => updateOllama({ model: e.target.value })} />
          )}
        </label>
        <button className="btn ghost" type="button" onClick={() => void handleTestOllama()}>
          测试 Ollama 连接（非 Gemini）
        </button>
        {ollamaStatus && <p className="hint">{ollamaStatus}</p>}
      </section>

      {supportsFolderSync() && (
        <section className="panel">
          <h2>文件夹同步备份（免费）</h2>
          <p className="hint">
            选择 OneDrive / 百度网盘同步目录，手动写入 JSON 备份，多设备通过网盘同步。
          </p>
          <div className="settings-row">
            <span>当前文件夹</span>
            <strong>{syncFolder ?? '未选择'}</strong>
          </div>
          <div className="quick-actions">
            <button className="btn ghost" type="button" onClick={() => void handlePickFolder()}>
              选择文件夹
            </button>
            <button className="btn primary" type="button" onClick={() => void handleSyncNow()}>
              立即同步备份
            </button>
            <button className="btn ghost" type="button" onClick={() => void handleRestoreFromFolder()}>
              从文件夹恢复
            </button>
            {syncFolder && (
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  void clearSyncFolder()
                  setSyncFolder(null)
                  setSyncMsg('已清除文件夹绑定')
                }}
              >
                清除绑定
              </button>
            )}
          </div>
          {syncMsg && <p className="hint">{syncMsg}</p>}
        </section>
      )}

      <section className="panel">
        <h2>外观</h2>
        <label className="field">
          <span>主题模式</span>
          <select value={theme} onChange={(e) => updateTheme(e.target.value as ThemeMode)}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>浏览器提醒</h2>
        <div className="settings-row">
          <span>通知权限</span>
          <strong>{permission === 'unsupported' ? '浏览器不支持' : permission}</strong>
        </div>
        {permission !== 'granted' && (
          <button className="btn primary" type="button" onClick={handleEnableNotifications}>
            开启浏览器通知
          </button>
        )}
        {permission === 'granted' && (
          <>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => updateSettings({ enabled: e.target.checked })}
              />
              启用截止日提醒
            </label>
            <label className="field">
              <span>提前几天提醒截止</span>
              <select
                value={settings.deadlineDays}
                onChange={(e) => updateSettings({ deadlineDays: Number(e.target.value) })}
              >
                {[1, 3, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d} 天
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.stageReminder}
                onChange={(e) => updateSettings({ stageReminder: e.target.checked })}
              />
              启用笔试/面试日程提醒
            </label>
          </>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>导出 JSON 备份</h2>
          <button className="btn primary" type="button" onClick={handleExport}>
            导出 JSON
          </button>
        </section>
        <section className="panel">
          <h2>导出 CSV 报表</h2>
          <button className="btn primary" type="button" onClick={() => void downloadCompaniesCsv()}>
            导出 CSV
          </button>
        </section>
      </div>

      <section className="panel">
        <h2>导入 JSON 备份</h2>
        <label className="upload-box">
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <span>选择 JSON 文件导入</span>
        </label>
      </section>
    </Layout>
  )
}
