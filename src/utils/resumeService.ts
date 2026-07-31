import { db } from '../db/database'
import type { ResumeVersion } from '../types'

export async function createResumeVersion(name: string, notes?: string) {
  return db.resumes.add({
    name,
    notes,
    createdAt: new Date().toISOString(),
  }) as Promise<number>
}

export async function updateResumeNotes(id: number, notes: string) {
  await db.resumes.update(id, { notes })
}

export async function uploadResumeFile(id: number, file: File) {
  await db.resumes.update(id, {
    fileName: file.name,
    fileBlob: file,
    fileSize: file.size,
    mimeType: file.type || 'application/pdf',
  })
}

export async function removeResumeFile(id: number) {
  await db.resumes.update(id, {
    fileName: undefined,
    fileBlob: undefined,
    fileSize: undefined,
    mimeType: undefined,
  })
}

export async function deleteResumeVersion(id: number) {
  await db.companies.where('resumeVersionId').equals(id).modify({ resumeVersionId: undefined })
  await db.resumes.delete(id)
}

export function downloadResumeFile(resume: ResumeVersion) {
  if (!resume.fileBlob) return
  const url = URL.createObjectURL(resume.fileBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = resume.fileName ?? `${resume.name}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
