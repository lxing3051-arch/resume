import { Link } from 'react-router-dom'
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
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          秋招助手
        </Link>
        <nav>
          <Link to="/">看板</Link>
          <Link to="/calendar">日历</Link>
          <Link to="/stats">数据</Link>
          <Link to="/company/new">添加</Link>
          <Link to="/resumes">简历</Link>
          <Link to="/notes">面经</Link>
          <Link to="/settings">设置</Link>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty">
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
