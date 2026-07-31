import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Company } from '../types'
import { StatusBadge, daysUntil } from './Layout'
import { deleteCompany } from '../utils/companyService'

interface Props {
  company: Company
}

export function CompanyCard({ company }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const deadlineHint = daysUntil(company.deadline)

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
          <StatusBadge status={company.status} />
        </div>
        <div className="card-meta">
          <span>
            {company.season} · {company.year}
          </span>
          {company.location && <span>{company.location}</span>}
          {company.salary && <span>{company.salary}</span>}
        </div>
        {company.skills.length > 0 && (
          <div className="tags">
            {company.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))}
          </div>
        )}
        {deadlineHint && <div className="deadline">{deadlineHint}</div>}
      </Link>
    </div>
  )
}
