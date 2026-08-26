import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_STAGES, type Company, type CompanyProjectLink, type InterviewNote, type PortfolioProject, type ResumeVersion, type Stage } from '../types'

interface SyncMeta {
  key: string
  folderName: string
  handle: FileSystemDirectoryHandle
}

class JobTrackerDB extends Dexie {
  companies!: EntityTable<Company, 'id'>
  stages!: EntityTable<Stage, 'id'>
  resumes!: EntityTable<ResumeVersion, 'id'>
  interviewNotes!: EntityTable<InterviewNote, 'id'>
  meta!: EntityTable<SyncMeta, 'key'>
  projects!: EntityTable<PortfolioProject, 'id'>
  companyProjectLinks!: EntityTable<CompanyProjectLink, 'id'>

  constructor() {
    super('JobTrackerDB')
    this.version(1).stores({
      companies: '++id, name, season, year, status, deadline, updatedAt',
      stages: '++id, companyId, order',
      resumes: '++id, name, createdAt',
    })
    this.version(2).stores({
      companies: '++id, name, season, year, status, deadline, updatedAt',
      stages: '++id, companyId, order',
      resumes: '++id, name, createdAt',
      interviewNotes: '++id, companyId, createdAt, updatedAt',
    })
    this.version(3).stores({
      companies: '++id, name, season, year, status, deadline, updatedAt',
      stages: '++id, companyId, order',
      resumes: '++id, name, createdAt',
      interviewNotes: '++id, companyId, createdAt, updatedAt',
    })
    this.version(4).stores({
      companies: '++id, name, season, year, status, deadline, updatedAt',
      stages: '++id, companyId, order',
      resumes: '++id, name, createdAt',
      interviewNotes: '++id, companyId, createdAt, updatedAt',
      meta: 'key',
    })
    this.version(5).stores({
      companies: '++id, name, season, year, status, deadline, updatedAt',
      stages: '++id, companyId, order',
      resumes: '++id, name, createdAt',
      interviewNotes: '++id, companyId, createdAt, updatedAt',
      meta: 'key',
      projects: '++id, title, status, updatedAt',
      companyProjectLinks: '++id, companyId, projectId',
    })
    this.version(6)
      .stores({
        companies: '++id, name, season, year, status, deadline, updatedAt',
        stages: '++id, companyId, order',
        resumes: '++id, name, createdAt',
        interviewNotes: '++id, companyId, createdAt, updatedAt',
        meta: 'key',
        projects: '++id, title, status, updatedAt',
        companyProjectLinks: '++id, companyId, projectId',
      })
      .upgrade(async (tx) => {
        // 为已有记录补上“测评”，并按新的标准流程重排；已有状态不变。
        const companies = await tx.table('companies').toArray() as Company[]
        const stageTable = tx.table('stages')
        for (const company of companies) {
          if (!company.id) continue
          const existing = await stageTable.where('companyId').equals(company.id).toArray() as Stage[]
          const custom = existing.filter((stage) => !DEFAULT_STAGES.includes(stage.type))
          for (const [index, type] of DEFAULT_STAGES.entries()) {
            const stage = existing.find((item) => item.type === type)
            if (stage?.id) {
              await stageTable.update(stage.id, { order: index * 10 })
            } else {
              await stageTable.add({
                companyId: company.id,
                type,
                status: '未开始',
                order: index * 10,
              })
            }
          }
          for (const [index, stage] of custom.entries()) {
            if (stage.id) await stageTable.update(stage.id, { order: 100 + index })
          }
        }
      })
  }
}

export const db = new JobTrackerDB()
