import { db } from '../db/database'
import type { ApplicationStatus, Company, Season, Stage, StageType } from '../types'
import { DEFAULT_STAGES } from '../types'
import { deleteLinksForCompany } from './companyProjectService'

export function inferStatus(stages: Stage[]): ApplicationStatus {
  if (stages.some((s) => s.type === '拒信' && s.status === '已完成')) return '已结束'
  if (stages.some((s) => s.type === 'OC' && s.status === '已完成')) return '已OC'
  if (stages.some((s) => ['一面', '二面', '三面', 'HR面'].includes(s.type) && s.status !== '未开始'))
    return '面试中'
  if (stages.some((s) => s.type === '笔试' && s.status !== '未开始')) return '笔试中'
  if (stages.some((s) => ['网申', '简历投递'].includes(s.type) && s.status === '已完成'))
    return '已投递'
  return '待投递'
}

export async function createCompany(
  data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
): Promise<number> {
  const now = new Date().toISOString()
  const companyId = (await db.companies.add({
    ...data,
    status: '待投递',
    createdAt: now,
    updatedAt: now,
  })) as number

  const stageRows: Omit<Stage, 'id'>[] = DEFAULT_STAGES.map((type, index) => ({
    companyId,
    type,
    status: '未开始',
    order: index,
  }))
  await db.stages.bulkAdd(stageRows)
  return companyId
}

export async function deleteCompany(companyId: number) {
  await db.transaction('rw', db.companies, db.stages, db.interviewNotes, db.companyProjectLinks, async () => {
    await db.stages.where('companyId').equals(companyId).delete()
    await db.interviewNotes.where('companyId').equals(companyId).delete()
    await deleteLinksForCompany(companyId)
    await db.companies.delete(companyId)
  })
}

export async function updateCompany(
  id: number,
  data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
) {
  await db.companies.update(id, {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export async function syncCompanyStatus(companyId: number) {
  const stages = await db.stages.where('companyId').equals(companyId).sortBy('order')
  const status = inferStatus(stages)
  await db.companies.update(companyId, { status, updatedAt: new Date().toISOString() })
}

export async function updateStageStatus(
  stageId: number,
  companyId: number,
  status: Stage['status'],
) {
  const patch: Partial<Stage> = { status }
  if (status === '已完成') patch.completedAt = new Date().toISOString()
  await db.stages.update(stageId, patch)
  await syncCompanyStatus(companyId)
}

export async function addCustomStage(companyId: number, type: StageType) {
  const existing = await db.stages.where('companyId').equals(companyId).sortBy('order')
  await db.stages.add({
    companyId,
    type,
    status: '未开始',
    order: existing.length,
  })
}

export async function getCompaniesFiltered(filters: {
  season?: Season | '全部'
  year?: number | '全部'
  status?: ApplicationStatus | '全部'
  query?: string
}) {
  let list = await db.companies.orderBy('updatedAt').reverse().toArray()

  if (filters.season && filters.season !== '全部') {
    list = list.filter((c) => c.season === filters.season)
  }
  if (filters.year && filters.year !== '全部') {
    list = list.filter((c) => c.year === filters.year)
  }
  if (filters.status && filters.status !== '全部') {
    list = list.filter((c) => c.status === filters.status)
  }
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase()
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q)),
    )
  }
  return list
}
