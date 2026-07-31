import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Layout, EmptyState } from '../components/Layout'
import { db } from '../db/database'
import { computeStats, computeTodos, skillSummary } from '../utils/statsService'
import { downloadCompaniesCsv } from '../utils/exportCsv'
import type { ApplicationStatus } from '../types'

const STATUS_ORDER: ApplicationStatus[] = [
  '待投递',
  '已投递',
  '笔试中',
  '面试中',
  '已OC',
  '已结束',
]

const TODO_LABELS = {
  apply: '待投递',
  deadline: '今日截止',
  schedule: '今日安排',
  skill: '技能复习',
}

export default function Stats() {
  const stats = useLiveQuery(() => computeStats())
  const todos = useLiveQuery(() => computeTodos())
  const companies = useLiveQuery(() => db.companies.toArray())
  const skills = companies ? skillSummary(companies) : []

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>数据中心</h1>
          <p className="muted">投递统计、转化漏斗、今日待办</p>
        </div>
        <Link to="/calendar" className="btn ghost">
          查看日历
        </Link>
        <button className="btn ghost" type="button" onClick={() => void downloadCompaniesCsv()}>
          导出 CSV
        </button>
      </div>

      {stats && (
        <>
          <div className="stats">
            <div className="stat-card">
              <span>投递总数</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="stat-card">
              <span>已 OC</span>
              <strong>{stats.oc}</strong>
            </div>
            <div className="stat-card">
              <span>已拒</span>
              <strong>{stats.rejected}</strong>
            </div>
            <div className="stat-card">
              <span>OC 率</span>
              <strong>{stats.ocRate}%</strong>
            </div>
          </div>

          <div className="two-col">
            <section className="panel">
              <h2>状态分布</h2>
              <div className="bar-chart">
                {STATUS_ORDER.map((status) => {
                  const count = stats.byStatus[status]
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={status} className="bar-row">
                      <span className="bar-label">{status}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="bar-value">{count}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="panel">
              <h2>转化漏斗</h2>
              <div className="funnel">
                <FunnelStep label="投递" count={stats.applied} rate={stats.applyRate} total={stats.total} />
                <FunnelStep label="笔试" count={stats.writtenTest} rate={stats.writtenRate} total={stats.applied} />
                <FunnelStep
                  label="面试"
                  count={stats.interviewed}
                  rate={stats.interviewRate}
                  total={stats.writtenTest}
                />
                <FunnelStep label="OC" count={stats.oc} rate={stats.ocRate} total={stats.interviewed} />
              </div>
            </section>
          </div>
        </>
      )}

      <section className="panel">
        <h2>今日待办</h2>
        {!todos?.length ? (
          <EmptyState title="今日暂无待办" hint="待投递、截止、面试安排和需复习技能会出现在这里" />
        ) : (
          <div className="todo-list">
            {todos.map((todo) => (
              <Link key={todo.id} to={todo.link ?? '/'} className={`todo-item ${todo.priority}`}>
                <span className="todo-type">{TODO_LABELS[todo.type]}</span>
                <div>
                  <strong>{todo.title}</strong>
                  <p className="muted small">{todo.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {skills.length > 0 && (
        <section className="panel">
          <h2>技能缺口（需复习 / 不会）</h2>
          <div className="skill-gap-list">
            {skills
              .filter((s) => s.不会 > 0 || s.需复习 > 0)
              .slice(0, 15)
              .map((s) => (
                <div key={s.skill} className="skill-gap-row">
                  <strong>{s.skill}</strong>
                  <span className="tag skill-gap">{s.不会} 不会</span>
                  <span className="tag skill-review">{s.需复习} 需复习</span>
                  <span className="tag skill-ok">{s.会} 会</span>
                  <span className="muted small">{s.companies.slice(0, 3).join('、')}</span>
                </div>
              ))}
          </div>
        </section>
      )}
    </Layout>
  )
}

function FunnelStep({
  label,
  count,
  rate,
  total,
}: {
  label: string
  count: number
  rate: number
  total: number
}) {
  return (
    <div className="funnel-step">
      <div className="funnel-head">
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      {total > 0 && <span className="muted small">转化率 {rate}%</span>}
    </div>
  )
}
