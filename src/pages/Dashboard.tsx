import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Layout, EmptyState } from '../components/Layout'
import { CompanyCard } from '../components/CompanyCard'
import { db } from '../db/database'
import { getCompaniesFiltered } from '../utils/companyService'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const rejectedOnly = searchParams.get('view') === 'rejected'

  const companies = useLiveQuery(
    () => getCompaniesFiltered({ season, status, year, query, rejectedOnly }),
    [season, status, year, query, rejectedOnly],
  )
  const totalCompanies = useLiveQuery(() => db.companies.count())
  const rejectedCompanies = useLiveQuery(() => getCompaniesFiltered({ rejectedOnly: true }))

  const stats = useMemo(() => {
    if (!companies || totalCompanies === undefined) return null
    return {
      total: totalCompanies,
      active: companies.filter((c) => !['已OC', '已结束'].includes(c.status)).length,
      interview: companies.filter((c) => c.status === '面试中').length,
      rejected: rejectedCompanies?.length ?? 0,
    }
  }, [companies, totalCompanies, rejectedCompanies])

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{rejectedOnly ? '已拒记录' : '投递看板'}</h1>
        </div>
      </div>

      {stats && (
        <div className="stats">
          <div className="stat-card stat-total">
            <span className="stat-icon">➤</span><div><span>总计</span>
            <strong>{stats.total}</strong></div>
          </div>
          <div className="stat-card stat-active">
            <span className="stat-icon">◉</span><div><span>进行中</span>
            <strong>{stats.active}</strong></div>
          </div>
          <div className="stat-card stat-interview">
            <span className="stat-icon">♥</span><div><span>面试中</span>
            <strong>{stats.interview}</strong></div>
          </div>
          <div className="stat-card stat-urgent warn">
            <span className="stat-icon">▤</span><div><span>已拒绝</span>
            <strong>{stats.rejected}</strong></div>
          </div>
        </div>
      )}

      <div className="status-tabs" aria-label="按投递状态筛选">
        {STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            key={option}
            className={!rejectedOnly && status === option ? 'active' : ''}
            onClick={() => {
              setSearchParams({})
              setStatus(option)
            }}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          className={rejectedOnly ? 'active rejected' : ''}
          onClick={() => setSearchParams({ view: 'rejected' })}
        >
          已拒绝 ({rejectedCompanies?.length ?? 0})
        </button>
      </div>

      <div className="filters">
        <input
          placeholder="搜索公司、岗位..."
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
      </div>

      {!companies?.length ? (
        <EmptyState
          title={rejectedOnly ? '没有已拒记录' : '还没有公司记录'}
          hint={
            rejectedOnly
              ? '标记为已拒的职位会集中显示在这里'
              : '上传 Boss 直聘截图，自动识别 JD 并跟踪进度'
          }
        />
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
