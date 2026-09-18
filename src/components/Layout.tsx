import { Link, NavLink } from 'react-router-dom'
import type { ApplicationStatus } from '../types'

const statusColors: Record<ApplicationStatus, string> = {
  待投递: '#94a3b8',
  已投递: '#3b82f6',
  笔试中: '#f59e0b',
  面试中: '#8b5cf6',
  已OC: '#22c55e',
  已结束: '#ef4444',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className="badge" style={{ background: statusColors[status] }}>
      {status}
    </span>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { to: '/', icon: '⌂', label: '投递看板', end: true },
    { to: '/calendar', icon: '▣', label: '求职日历' },
    { to: '/stats', icon: '≡', label: '数据分析' },
    { to: '/resumes', icon: '▤', label: '简历管理' },
    { to: '/projects', icon: '◈', label: '项目管理' },
    { to: '/notes', icon: '◰', label: '面经笔记' },
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden="true">🌱</span>
          <span>秋招助手</span>
        </Link>
        <nav className="side-nav" aria-label="主导航">
          {navItems.slice(0, 3).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
          <div className="nav-divider"><span>求职资料</span></div>
          {navItems.slice(3).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/settings" className={({ isActive }) => `side-settings${isActive ? ' active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">⚙</span>设置
        </NavLink>
      </aside>
      <div className="app-body">
        <header className="header">
          <div className="topbar-search" aria-hidden="true">
            <span>⌕</span><span>搜索公司、岗位、标签...</span>
          </div>
          <div className="topbar-actions">
            <Link to="/company/new" className="btn primary topbar-add">＋ 新增投递</Link>
            <span className="topbar-bell" aria-hidden="true">♢<i /></span>
            <span className="user-avatar">LX</span>
            <strong>李星</strong>
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}

export function EmptyState({ title, hint, compact = false }: { title: string; hint: string; compact?: boolean }) {
  return (
    <div className={`empty${compact ? ' empty-tile' : ''}`}>
      <h3>{title}</h3>
      <p>{hint}</p>
    </div>
  )
}

export function daysUntil(deadline?: string): string | null {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0) return '已截止'
  if (diff === 0) return '今天截止'
  if (diff <= 7) return `${diff} 天后截止`
  return null
}
