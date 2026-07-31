import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { CompanyForm } from '../components/CompanyForm'
import { db } from '../db/database'
import { updateCompany } from '../utils/companyService'
import { companyToForm, emptyCompanyForm } from '../utils/companyForm'
import { formToCompanyPayload } from '../utils/serialize'

export default function CompanyEdit() {
  const { id } = useParams()
  const companyId = Number(id)
  const navigate = useNavigate()
  const company = useLiveQuery(() => db.companies.get(companyId), [companyId])
  const resumes = useLiveQuery(() => db.resumes.toArray())
  const [form, setForm] = useState(emptyCompanyForm())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (company && !loaded) {
      setForm(companyToForm(company))
      setLoaded(true)
    }
  }, [company, loaded])

  if (company === undefined) return <Layout>加载中...</Layout>
  if (!company) return <Layout>未找到该公司</Layout>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await updateCompany(companyId, formToCompanyPayload(form))
    navigate(`/company/${companyId}`)
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to={`/company/${companyId}`} className="back-link">
            ← 返回详情
          </Link>
          <h1>编辑 · {company.name}</h1>
          <p className="muted">修改岗位信息、联系人</p>
        </div>
      </div>
      <CompanyForm
        form={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        submitLabel="保存修改"
        onSubmit={handleSubmit}
        showOcr={false}
        resumeVersions={resumes ?? []}
      />
    </Layout>
  )
}
