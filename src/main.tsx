import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')

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

void Promise.all([
  import('./utils/extensionBridge'),
  import('./App.tsx'),
  import('./utils/theme'),
])
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
