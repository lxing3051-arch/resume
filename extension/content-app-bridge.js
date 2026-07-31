const POST_TYPE = 'JOB_TRACKER_IMPORT'

function deliverImport(payload) {
  // 从隔离环境通知页面主世界（React 能收到 postMessage）
  window.postMessage({ type: POST_TYPE, payload }, window.location.origin)
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'DELIVER_IMPORT') {
    deliverImport(msg.payload)
    sendResponse({ ok: true })
  }
  return true
})

// 页面加载时：若 background 写了 session 备份，转发到主世界
chrome.storage.session.get(['pendingImport'], (result) => {
  if (result.pendingImport) {
    deliverImport(result.pendingImport)
    chrome.storage.session.remove(['pendingImport'])
  }
})
