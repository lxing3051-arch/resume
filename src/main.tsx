import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/extensionBridge'
import App from './App.tsx'
import { initTheme } from './utils/theme'

// 不阻塞页面渲染地注销旧版 PWA 缓存；职位数据存于 IndexedDB，不受影响。
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    void Promise.all(registrations.map((registration) => registration.unregister()))
  }).catch(() => {
    /* 浏览器不支持或权限受限时，应用仍可正常启动。 */
  })
}

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
