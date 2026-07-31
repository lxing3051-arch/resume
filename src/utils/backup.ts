import { db } from '../db/database'
import type { Company, CompanyProjectLink, InterviewNote, Stage } from '../types'
import {
  exportToProject,
  exportToResume,
  projectToExport,
  resumeToExport,
  type PortfolioProjectExport,
  type ResumeExport,
} from './serialize'

interface BackupData {
  version: number
  exportedAt: string
  companies: Company[]
  stages: Stage[]
  resumes: ResumeExport[]
  interviewNotes?: InterviewNote[]
  projects?: PortfolioProjectExport[]
  companyProjectLinks?: CompanyProjectLink[]
}

export async function exportBackup(): Promise<string> {
  const [companies, stages, resumes, interviewNotes, projects, companyProjectLinks] =
    await Promise.all([
      db.companies.toArray(),
      db.stages.toArray(),
      db.resumes.toArray(),
      db.interviewNotes.toArray(),
      db.projects.toArray(),
      db.companyProjectLinks.toArray(),
    ])
  const resumeExports = await Promise.all(resumes.map(resumeToExport))
  const projectExports = await Promise.all(projects.map(projectToExport))
  const data: BackupData = {
    version: 5,
    exportedAt: new Date().toISOString(),
    companies,
    stages,
    resumes: resumeExports,
    interviewNotes,
    projects: projectExports,
    companyProjectLinks,
  }
  return JSON.stringify(data, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json) as BackupData

  await db.transaction(
    'rw',
    [db.companies, db.stages, db.resumes, db.interviewNotes, db.projects, db.companyProjectLinks],
    async () => {
      await db.companies.clear()
      await db.stages.clear()
      await db.resumes.clear()
      await db.interviewNotes.clear()
      await db.projects.clear()
      await db.companyProjectLinks.clear()
      await db.companies.bulkAdd(data.companies)
      await db.stages.bulkAdd(data.stages)
      await db.resumes.bulkAdd(data.resumes.map(exportToResume))
      if (data.interviewNotes?.length) {
        await db.interviewNotes.bulkAdd(data.interviewNotes)
      }
      if (data.projects?.length) {
        await db.projects.bulkAdd(data.projects.map(exportToProject))
      }
      if (data.companyProjectLinks?.length) {
        await db.companyProjectLinks.bulkAdd(data.companyProjectLinks)
      }
    },
  )
}

export function downloadBackup(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
