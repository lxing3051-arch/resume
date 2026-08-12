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
  if (!url || !/^https?:/i.test(url)) return false
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname.endsWith('join.qq.com') || hostname.endsWith('jobs.bytedance.com')) return true
    return /job|jobs|position|career|recruit|zhipin/i.test(pathname)
  } catch {
    return false
  }
}

async function scrapeViaInjection(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['scrape-job.js'],
  })
  const [{ result: data }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof window.__SCRAPE_JOB_PAGE__ === 'function') {
        return window.__SCRAPE_JOB_PAGE__()
      }
      return { error: '抓取脚本未加载，请刷新职位页面后重试' }
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
  if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
    setStatus('请先打开招聘网站或企业官网的职位页面')
    return
  }

  if (!isJobPage(tab.url)) {
    setStatus('请打开具体职位详情页，而不是招聘首页或搜索列表')
    return
  }

  setStatus('正在抓取...')

  const res = await scrapeTab(tab)
  if (!res.ok) {
    setStatus(res.error || '抓取失败。请刷新职位页面后重试')
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
      setStatus(`网站未响应。请检查插件地址是否为 ${res.target || '完整网址（含仓库名）'}，或用「复制到剪贴板」导入`)
    }
    window.close()
  } else {
    setStatus('打开失败，请检查插件设置中的秋招助手地址')
  }
})

copyBtn.addEventListener('click', async () => {
  if (!payload) return
  await navigator.clipboard.writeText(MARKER + JSON.stringify(payload))
  setStatus('已复制！在秋招助手点「从剪贴板导入」')
})

scrapeActiveTab()
