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
import type { NotificationSettings, ThemeMode } from '../types'

export default function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings())
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode())
  const [syncFolder, setSyncFolder] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )

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
          <p className="muted">插件、文件夹同步、外观</p>
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
        <h2>做项目（Cursor 带做）</h2>
        <p className="hint">
          本网站不再内置 AI 分析。在公司详情页粘贴 JD 后，点「复制」，再把内容粘贴到任意 AI 对话中，让 AI
          帮你选题、设计项目并一步步带做代码。
        </p>
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
