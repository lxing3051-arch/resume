import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Company, Stage } from '../types'
import { daysUntil } from './Layout'
import { deleteCompany } from '../utils/companyService'

interface Props {
  company: Company
}

const PIPELINE = [
  { label: '网申', types: ['网申'] },
  { label: '投递简历', types: ['简历投递'] },
  { label: '测评', types: ['测评'] },
  { label: '笔试', types: ['笔试'] },
  { label: '面试', types: ['一面', '二面', '三面', 'HR面'] },
] as const

type ProgressState = '未开始' | '进行中' | '已完成' | '已跳过'

function phaseState(stages: Stage[], types: readonly string[]): ProgressState {
  const matched = stages.filter((stage) => types.includes(stage.type))
  if (matched.some((stage) => stage.status === '进行中')) return '进行中'
  if (matched.some((stage) => stage.status === '已完成')) return '已完成'
  if (matched.some((stage) => stage.status === '已跳过')) return '已跳过'
  return '未开始'
}

function progressLabel(states: ProgressState[]): string {
  const active = states.findIndex((state) => state === '进行中')
  if (active >= 0) return `当前：${PIPELINE[active].label}进行中`
  const next = states.findIndex((state) => state === '未开始')
  if (next >= 0) return next === 0 ? '待开始：网申' : `下一步：${PIPELINE[next].label}`
  return '流程已完成'
}

function phaseBadgeLabel(company: Company, states: ProgressState[]): string {
  if (company.status === '已OC' || company.status === '已结束') return company.status
  const active = states.findIndex((state) => state === '进行中')
  if (active >= 0) return `${PIPELINE[active].label}进行中`
  const next = states.findIndex((state) => state === '未开始')
  if (next === 0) return '待网申'
  if (next >= 0) return `待${PIPELINE[next].label}`
  return '流程完成'
}

export function CompanyCard({ company }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const deadlineHint = daysUntil(company.deadline)
  const stages = useLiveQuery(
    () => (company.id ? db.stages.where('companyId').equals(company.id).sortBy('order') : []),
    [company.id],
  )
  const states = PIPELINE.map((phase) => phaseState(stages ?? [], phase.types))

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    const label = `${company.name || '未命名公司'} · ${company.position || '未填写岗位'}`
    if (!confirm(`确定删除「${label}」？`)) return
    if (company.id) await deleteCompany(company.id)
  }

  return (
    <div className="company-card">
      <div className="card-menu">
        <button
          type="button"
          className="card-menu-trigger"
          aria-label="更多操作"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen((open) => !open)
          }}
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="card-menu-backdrop"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            />
            <div className="card-menu-panel" role="menu">
              <button type="button" className="card-menu-item danger" role="menuitem" onClick={handleDelete}>
                删除
              </button>
            </div>
          </>
        )}
      </div>

      <Link to={`/company/${company.id}`} className="company-card-link">
        <div className="card-top">
          <div>
            <h3>{company.name || '未命名公司'}</h3>
            <p>{company.position || '未填写岗位'}</p>
          </div>
          <span className="card-phase-badge">{phaseBadgeLabel(company, states)}</span>
        </div>
        <div className="card-meta">
          <span>
            {company.season} · {company.year}
          </span>
          {company.location && <span>{company.location}</span>}
          <span>{company.salary || '暂无'}</span>
        </div>
        <div className="card-progress" aria-label={progressLabel(states)}>
          <div className="card-progress-head">
            <strong>{progressLabel(states)}</strong>
            <span>{states.filter((state) => state === '已完成').length}/{PIPELINE.length}</span>
          </div>
          <div className="card-stepper">
            {PIPELINE.map((phase, index) => (
              <div key={phase.label} className={`card-step ${states[index]}`}>
                <span className="card-step-dot">{states[index] === '已完成' ? '✓' : index + 1}</span>
                <span>{phase.label}</span>
              </div>
            ))}
          </div>
        </div>
        {deadlineHint && <div className="deadline">{deadlineHint}</div>}
      </Link>
    </div>
  )
}
