const MARKER = 'JOB_TRACKER_IMPORT:'
const statusEl = document.getElementById('status')
const previewEl = document.getElementById('preview')
const importBtn = document.getElementById('importBtn')
const copyBtn = document.getElementById('copyBtn')

let payload = null

// 字节招聘职位页的正文后面会拼接“相关职位”推荐和整站页脚。
// 仅保留这些尾部区域开始前的内容，避免推荐岗位、联系方式等无关内容进入 JD。
function trimRecruitingTail(text) {
  const normalized = (text || '').replace(/\n{3,}/g, '\n\n').trim()
  const tailStart = /(?:^|\n)\s*(?:[•·●▪◦-]\s*)?(?:相关职位|职位\s*ID\s*[：:]|关注我们获取最新动态|联系我们|相关网站|候选人反馈平台|官网使用体验反馈|字节跳动招聘|京公网安备|版权所有)\s*(?:\n|$)/im
  const match = normalized.match(tailStart)
  return (match?.index === undefined ? normalized : normalized.slice(0, match.index)).trim()
}

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
    func: async () => {
      if (typeof window.__SCRAPE_JOB_PAGE__ === 'function') {
        let data = window.__SCRAPE_JOB_PAGE__()
        // 字节等官网采用异步渲染；在内容尚未出现时最多等待 2 秒后重试。
        for (let attempt = 0; attempt < 4 && (!data?.jdRaw || data.jdRaw.length < 180); attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          data = window.__SCRAPE_JOB_PAGE__()
        }
        return data
      }
      return { error: '抓取脚本未加载，请刷新职位页面后重试' }
    },
  })
  return data
}

async function capturePageText(tabId, source) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      const rawText = (document.body?.innerText || document.documentElement?.innerText || '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const tailStart = /(?:^|\n)\s*(?:[•·●▪◦-]\s*)?(?:相关职位|职位\s*ID\s*[：:]|关注我们获取最新动态|联系我们|相关网站|候选人反馈平台|官网使用体验反馈|字节跳动招聘|京公网安备|版权所有)\s*(?:\n|$)/im
      const match = rawText.match(tailStart)
      const text = (match?.index === undefined ? rawText : rawText.slice(0, match.index)).trim()
      const title = document.querySelector('h1')?.innerText?.trim() || document.title
      return { text, title, url: location.href }
    },
  })
  const best = results
    .map((item) => item.result)
    .filter((item) => item?.text?.length > 80)
    .sort((a, b) => b.text.length - a.text.length)[0]
  if (!best) return { ok: false, error: '页面职位内容尚未加载，请等待 2 秒后重试' }

  const company = source === 'bytedance' ? '字节跳动' : source === 'tencent' ? '腾讯' : ''
  return {
    ok: true,
    data: {
      source,
      name: company,
      position: best.title || '',
      location: '',
      salary: '',
      jdRaw: [`公司：${company}`, `职位：${best.title || ''}`, '', best.text].filter(Boolean).join('\n'),
      bossUrl: best.url.split('?')[0],
      requirements: '',
      responsibilities: '',
      scrapedAt: new Date().toISOString(),
    },
  }
}

async function scrapeTab(tab) {
  // 字节职位页常以异步组件或 frame 呈现。直接读取所有 frame 的可见文本最可靠。
  if (tab.url?.includes('jobs.bytedance.com')) return capturePageText(tab.id, 'bytedance')

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
    return capturePageText(tab.id, tab.url?.includes('join.qq.com') ? 'tencent' : 'generic-web')
  } catch (e) {
    try {
      return await capturePageText(tab.id, tab.url?.includes('join.qq.com') ? 'tencent' : 'generic-web')
    } catch {
      return { ok: false, error: String(e) }
    }
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
