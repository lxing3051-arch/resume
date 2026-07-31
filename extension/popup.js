const MARKER = 'JOB_TRACKER_IMPORT:'
const statusEl = document.getElementById('status')
const previewEl = document.getElementById('preview')
const importBtn = document.getElementById('importBtn')
const copyBtn = document.getElementById('copyBtn')

let payload = null

function setStatus(text) {
  statusEl.textContent = text
}

function isJobPage(url) {
  if (!url || !url.includes('zhipin.com')) return false
  return (
    url.includes('job_detail') ||
    url.includes('/job/') ||
    url.includes('geek/job') ||
    url.includes('jobs/')
  )
}

async function scrapeViaInjection(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['scrape-boss.js'],
  })
  const [{ result: data }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof window.__SCRAPE_BOSS_ZHIPIN__ === 'function') {
        return window.__SCRAPE_BOSS_ZHIPIN__()
      }
      return { error: '抓取脚本未加载，请刷新 Boss 页面后重试' }
    },
  })
  return data
}

async function scrapeTab(tab) {
  // 方式1：向已注入的 content script 发消息
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_JOB' })
    if (res?.ok) return { ok: true, data: res.data }
    if (res?.error) return { ok: false, error: res.error }
  } catch {
    /* 未注入则走方式2 */
  }

  // 方式2：主动注入脚本（解决安装插件前已打开的页面、SPA 等问题）
  try {
    const data = await scrapeViaInjection(tab.id)
    if (data?.error) return { ok: false, error: data.error }
    if (data?.jdRaw) return { ok: true, data }
    return { ok: false, error: '页面无岗位内容' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

async function scrapeActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.includes('zhipin.com')) {
    setStatus('请先打开 Boss 直聘网站')
    return
  }

  if (!isJobPage(tab.url)) {
    setStatus('请打开「岗位详情页」（URL 通常含 job_detail），不是搜索列表页')
    return
  }

  setStatus('正在抓取...')

  const res = await scrapeTab(tab)
  if (!res.ok) {
    setStatus(res.error || '抓取失败。请登录 Boss、刷新页面后重试')
    return
  }

  payload = res.data
  previewEl.hidden = false
  previewEl.innerHTML = `<strong>${payload.name || '未知公司'} · ${payload.position || '未知岗位'}</strong>${payload.salary ? `<div>${payload.salary}</div>` : ''}${payload.location ? `<div>${payload.location}</div>` : ''}`
  importBtn.hidden = false
  copyBtn.hidden = false
  setStatus('抓取成功')
}

importBtn.addEventListener('click', async () => {
  if (!payload) return
  setStatus('正在打开秋招助手...')
  const res = await chrome.runtime.sendMessage({ type: 'OPEN_APP_IMPORT', payload })
  if (res?.ok) {
    setStatus('已发送，请在秋招助手确认')
    if (res.mode === 'failed') {
      setStatus('网站未响应，请用「复制到剪贴板」导入')
    }
    window.close()
  } else {
    setStatus('打开失败，请检查设置中的地址')
  }
})

copyBtn.addEventListener('click', async () => {
  if (!payload) return
  await navigator.clipboard.writeText(MARKER + JSON.stringify(payload))
  setStatus('已复制！在秋招助手点「从剪贴板导入」')
})

scrapeActiveTab()
