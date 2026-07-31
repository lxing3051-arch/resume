// 注入到页面 MAIN 世界，与 React 共享 window / localStorage
export function deliverImportToPage(data) {
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
}
