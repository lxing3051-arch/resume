import Dexie, { type EntityTable } from 'dexie'
import type {
  Company,
  CompanyProjectLink,
  InterviewNote,
  PortfolioProject,
  ResumeVersion,
  Stage,
} from '../types'

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
  }
}

export const db = new JobTrackerDB()
