import { db } from '../db/database'
import type { Company, InterviewNote, Stage } from '../types'
import { exportToResume, resumeToExport, type ResumeExport } from './serialize'

interface BackupData {
  version: number
  exportedAt: string
  companies: Company[]
  stages: Stage[]
  resumes: ResumeExport[]
  interviewNotes?: InterviewNote[]
}

export async function exportBackup(): Promise<string> {
  const [companies, stages, resumes, interviewNotes] = await Promise.all([
    db.companies.toArray(),
    db.stages.toArray(),
    db.resumes.toArray(),
    db.interviewNotes.toArray(),
  ])
  const resumeExports = await Promise.all(resumes.map(resumeToExport))
  const data: BackupData = {
    version: 4,
    exportedAt: new Date().toISOString(),
    companies,
    stages,
    resumes: resumeExports,
    interviewNotes,
  }
  return JSON.stringify(data, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json) as BackupData

  await db.transaction(
    'rw',
    db.companies,
    db.stages,
    db.resumes,
    db.interviewNotes,
    async () => {
      await db.companies.clear()
      await db.stages.clear()
      await db.resumes.clear()
      await db.interviewNotes.clear()
      await db.companies.bulkAdd(data.companies)
      await db.stages.bulkAdd(data.stages)
      await db.resumes.bulkAdd(data.resumes.map(exportToResume))
      if (data.interviewNotes?.length) {
        await db.interviewNotes.bulkAdd(data.interviewNotes)
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
