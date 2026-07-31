const DEFAULT_APP_URL = 'http://localhost:5173'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_APP_IMPORT') {
    openAppWithImport(msg.payload).then(sendResponse)
    return true
  }
})

async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL })
  return appUrl.trim().replace(/\/$/, '')
}

function isAppTab(url) {
  if (!url) return false
  return (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('github.io') ||
    url.includes('vercel.app') ||
    url.includes('netlify.app')
  )
}

function isCompanyNewPage(url) {
  return url && url.includes('/company/new')
}

function buildNewCompanyUrl(appUrl) {
  return `${appUrl}/company/new`
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }, 12000)

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 500)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function deliverViaContentScript(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'DELIVER_IMPORT', payload })
    return true
  } catch {
    return false
  }
}

async function deliverViaMainWorld(tabId, payload) {
  for (let i = 0; i < 12; i++) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (data) => {
          const KEY = 'job-tracker-pending-import'
          try {
            localStorage.setItem(KEY, JSON.stringify(data))
          } catch {
            /* ignore */
          }
          window.postMessage({ type: 'JOB_TRACKER_IMPORT', payload: data }, window.location.origin)
          window.dispatchEvent(new CustomEvent('job-tracker-import', { detail: data }))
          if (window.__JOB_TRACKER__?.dispatchImport) {
            window.__JOB_TRACKER__.dispatchImport(data)
          }
        },
        args: [payload],
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return false
}

async function deliverImport(tabId, payload) {
  await deliverViaContentScript(tabId, payload)
  return deliverViaMainWorld(tabId, payload)
}

async function openAppWithImport(payload) {
  const appUrl = await getAppUrl()
  const target = buildNewCompanyUrl(appUrl)

  await chrome.storage.session.set({ pendingImport: payload })

  const allTabs = await chrome.tabs.query({ currentWindow: true })
  const appTab = allTabs.find((t) => isAppTab(t.url))

  let tabId

  if (appTab?.id != null) {
    tabId = appTab.id
    await chrome.tabs.update(tabId, { active: true })
    if (!isCompanyNewPage(appTab.url)) {
      await chrome.tabs.update(tabId, { url: target })
      await waitForTabComplete(tabId)
    } else {
      await new Promise((r) => setTimeout(r, 300))
    }
  } else {
    const created = await chrome.tabs.create({ url: target, active: true })
    tabId = created.id
    await waitForTabComplete(tabId)
  }

  const ok = await deliverImport(tabId, payload)
  return { ok, mode: ok ? 'delivered' : 'failed', target }
}
