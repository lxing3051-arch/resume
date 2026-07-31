import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Layout, EmptyState, daysUntil } from '../components/Layout'
import { CompanyCard } from '../components/CompanyCard'
import { getCompaniesFiltered } from '../utils/companyService'
import { computeTodos } from '../utils/statsService'
import type { ApplicationStatus, Season } from '../types'

const STATUS_OPTIONS: (ApplicationStatus | '全部')[] = [
  '全部',
  '待投递',
  '已投递',
  '笔试中',
  '面试中',
  '已OC',
  '已结束',
]

const SEASON_OPTIONS: (Season | '全部')[] = ['全部', '秋招', '春招', '实习', '社招', '其他']

export default function Dashboard() {
  const [season, setSeason] = useState<Season | '全部'>('全部')
  const [status, setStatus] = useState<ApplicationStatus | '全部'>('全部')
  const [year, setYear] = useState<number | '全部'>(new Date().getFullYear())
  const [query, setQuery] = useState('')

  const companies = useLiveQuery(
    () => getCompaniesFiltered({ season, status, year, query }),
    [season, status, year, query],
  )

  const todos = useLiveQuery(() => computeTodos())

  const stats = useMemo(() => {
    if (!companies) return null
    return {
      total: companies.length,
      active: companies.filter((c) => !['已OC', '已结束'].includes(c.status)).length,
      interview: companies.filter((c) => c.status === '面试中').length,
      urgent: companies.filter((c) => daysUntil(c.deadline)).length,
    }
  }, [companies])

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>投递看板</h1>
          <p className="muted">数据保存在本机浏览器，零服务器费用</p>
        </div>
        <Link to="/stats" className="btn ghost">
          今日待办
        </Link>
        <Link to="/company/new" className="btn primary">
          + 添加公司
        </Link>
      </div>

      {stats && (
        <div className="stats">
          <div className="stat-card">
            <span>总计</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>进行中</span>
            <strong>{stats.active}</strong>
          </div>
          <div className="stat-card">
            <span>面试中</span>
            <strong>{stats.interview}</strong>
          </div>
          <div className="stat-card warn">
            <span>临近截止</span>
            <strong>{stats.urgent}</strong>
          </div>
        </div>
      )}

      {todos && todos.length > 0 && (
        <section className="panel todo-preview">
          <div className="panel-head">
            <h2>今日待办 ({todos.length})</h2>
            <Link to="/stats" className="muted small">
              查看全部 →
            </Link>
          </div>
          <div className="todo-list">
            {todos.slice(0, 3).map((todo) => (
              <Link key={todo.id} to={todo.link ?? '/'} className={`todo-item ${todo.priority}`}>
                <span className="todo-type">{todo.type === 'apply' ? '待投递' : todo.type === 'deadline' ? '截止' : todo.type === 'schedule' ? '安排' : '复习'}</span>
                <div>
                  <strong>{todo.title}</strong>
                  <p className="muted small">{todo.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="filters">
        <input
          placeholder="搜索公司、岗位、技能..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={season} onChange={(e) => setSeason(e.target.value as Season | '全部')}>
          {SEASON_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value === '全部' ? '全部' : Number(e.target.value))}>
          <option value="全部">全部年份</option>
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | '全部')}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!companies?.length ? (
        <EmptyState title="还没有公司记录" hint="上传 Boss 直聘截图，自动识别 JD 并跟踪进度" />
      ) : (
        <div className="card-grid">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </Layout>
  )
}
