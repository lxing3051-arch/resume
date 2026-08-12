import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')

/**
 * 旧版本曾注册 PWA Service Worker。它可能把 GitHub Pages 的新旧资源混用，
 * 从而造成模块加载失败和白屏；职位数据保存在 IndexedDB，不会被清除。
 */
async function removeLegacyServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  if (!registrations.length) return
  await Promise.all(registrations.map((registration) => registration.unregister()))
  if ('caches' in window) {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
  }
  window.location.reload()
  throw new Error('正在更新应用资源，请稍后重试')
}

function showStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!rootElement) return
  rootElement.innerHTML = `
    <main class="main" style="padding:24px">
      <h1>页面加载失败</h1>
      <p class="hint">应用资源加载异常。请刷新页面；若问题仍存在，可清除本站缓存后重试。</p>
      <pre class="text-block"></pre>
      <button class="btn primary" type="button">重新加载</button>
    </main>`
  const detail = rootElement.querySelector('pre')
  if (detail) detail.textContent = message
  rootElement.querySelector('button')?.addEventListener('click', () => window.location.reload())
}

void removeLegacyServiceWorker().then(() => Promise.all([
  import('./utils/extensionBridge'),
  import('./App.tsx'),
  import('./utils/theme'),
]))
  .then(([, appModule, themeModule]) => {
    if (!rootElement) throw new Error('找不到应用挂载节点')
    themeModule.initTheme()
    const App = appModule.default
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch(showStartupError)
