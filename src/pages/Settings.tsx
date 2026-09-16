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
import { getThemeMode, saveThemeMode } from '../utils/theme'
import { getAiSettings, saveAiSettings } from '../utils/aiSettings'
import {
  GEMINI_MODELS,
  getGeminiSettings,
  saveGeminiSettings,
  testGeminiConnection,
  validateGeminiApiKey,
} from '../utils/gemini'
import type { GeminiSettings, NotificationSettings, ThemeMode } from '../types'
import { useCloudSync } from '../contexts/CloudSyncContext'

export default function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings())
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode())
  const [syncFolder, setSyncFolder] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [gemini, setGemini] = useState<GeminiSettings>(getGeminiSettings())
  const [geminiMessage, setGeminiMessage] = useState('')
  const [testingGemini, setTestingGemini] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const cloud = useCloudSync()

  useEffect(() => {
    void getSyncFolderName().then(setSyncFolder)
  }, [])

  function updateSettings(patch: Partial<NotificationSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveNotificationSettings(next)
  }

  function updateTheme(mode: ThemeMode) {
    setTheme(mode)
    saveThemeMode(mode)
  }

  function updateGemini(patch: Partial<GeminiSettings>) {
    const next = { ...gemini, ...patch }
    setGemini(next)
    saveGeminiSettings(next)
    saveAiSettings({ ...getAiSettings(), provider: 'gemini' })
    setGeminiMessage('已保存到此浏览器')
  }

  async function handleTestGemini() {
    const formatError = validateGeminiApiKey(gemini.apiKey)
    if (formatError) {
      setGeminiMessage(formatError)
      return
    }
    setTestingGemini(true)
    setGeminiMessage('正在连接 Gemini…')
    try {
      saveGeminiSettings(gemini)
      saveAiSettings({ ...getAiSettings(), provider: 'gemini' })
      setGeminiMessage(await testGeminiConnection())
    } catch (error) {
      setGeminiMessage(error instanceof Error ? `连接失败：${error.message}` : '连接失败，请检查 Key 和网络')
    } finally {
      setTestingGemini(false)
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

  async function handleAuth(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 6) {
      setAuthMessage('请输入邮箱；密码至少 6 位')
      return
    }
    setAuthMessage(mode === 'signin' ? '正在登录…' : '正在注册…')
    const result = await (mode === 'signin'
      ? cloud.signIn(email.trim(), password)
      : cloud.signUp(email.trim(), password))
    setPassword('')
    setAuthMessage(result)
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
          <p className="muted">插件、文件夹同步、外观</p>
        </div>
      </div>

      <section className="panel cloud-sync-panel">
        <div className="panel-head">
          <h2>账号与云同步</h2>
          <span className={`sync-status ${cloud.status === '已同步' ? 'success' : ''}`}>
            {cloud.status}
          </span>
        </div>
        {cloud.session ? (
          <>
            <p className="hint">
              已登录：<strong>{cloud.session.user.email}</strong>。本地修改会自动保存到云端，换设备登录后自动恢复。
            </p>
            {(cloud.message || authMessage) && <p className="hint">{cloud.message || authMessage}</p>}
            <div className="quick-actions">
              {cloud.status === '需要选择' && (
                <>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      if (confirm('用当前浏览器数据覆盖云端数据？')) void cloud.uploadLocal()
                    }}
                  >
                    保留当前浏览器数据
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      if (confirm('用云端数据覆盖当前浏览器数据？')) void cloud.restoreCloud()
                    }}
                  >
                    使用云端数据
                  </button>
                </>
              )}
              <button className="btn ghost" type="button" onClick={() => void cloud.uploadLocal()}>
                立即上传
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (confirm('从云端恢复会覆盖当前浏览器数据，确定继续？')) void cloud.restoreCloud()
                }}
              >
                从云端恢复
              </button>
              <button className="btn danger" type="button" onClick={() => void cloud.signOut()}>
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">登录后自动同步职位、进度、笔记和项目数据；首次注册会上传当前浏览器已有数据。</p>
            <div className="form-grid">
              <label className="field">
                <span>邮箱</span>
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  minLength={6}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>
            <div className="quick-actions">
              <button className="btn primary" type="button" onClick={() => void handleAuth('signin')}>
                登录
              </button>
              <button className="btn ghost" type="button" onClick={() => void handleAuth('signup')}>
                注册新账号
              </button>
            </div>
            {authMessage && <p className="hint">{authMessage}</p>}
          </>
        )}
      </section>

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
        <h2>Gemini AI（可选）</h2>
        <p className="hint">
          填入你自己的 Gemini API Key 后，可在岗位详情页用 Gemini 分析 JD 或直接提问。未配置时仍使用本地规则分析。
        </p>
        <label className="field">
          <span>Gemini API Key</span>
          <input
            type="password"
            value={gemini.apiKey}
            placeholder="AIza…"
            autoComplete="off"
            onChange={(event) => updateGemini({ apiKey: event.target.value })}
          />
        </label>
        <label className="field">
          <span>模型</span>
          <select value={gemini.model} onChange={(event) => updateGemini({ model: event.target.value })}>
            {GEMINI_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        <div className="quick-actions">
          <button className="btn primary" type="button" disabled={testingGemini} onClick={() => void handleTestGemini()}>
            {testingGemini ? '测试中…' : '测试 Gemini 连接'}
          </button>
        </div>
        {geminiMessage && <p className="hint">{geminiMessage}</p>}
        <p className="muted small">API Key 仅保存在当前浏览器的本地存储中；点击 Gemini 分析或提问时，相关 JD 文本才会发送给 Google。</p>
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
          <button className="btn primary" type="button" onClick={() => void handleEnableNotifications()}>
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
          <button className="btn primary" type="button" onClick={() => void handleExport()}>
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
