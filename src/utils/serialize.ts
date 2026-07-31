import type { CompanyFormData } from './companyForm'
import type { Company } from '../types'

export function formToCompanyPayload(
  form: CompanyFormData,
): Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'status'> {
  return {
    name: form.name,
    position: form.position,
    season: form.season,
    year: form.year,
    location: form.location || undefined,
    salary: form.salary || undefined,
    deadline: form.deadline || undefined,
    jdRaw: form.jdRaw,
    skills: form.skills,
    skillRatings: form.skillRatings,
    requirements: form.requirements || undefined,
    responsibilities: form.responsibilities || undefined,
    bossUrl: form.bossUrl || undefined,
    notes: form.notes || undefined,
    referrerName: form.referrerName || undefined,
    referrerContact: form.referrerContact || undefined,
    hrName: form.hrName || undefined,
    hrContact: form.hrContact || undefined,
    resumeVersionId:
      form.resumeVersionId === '' ? undefined : form.resumeVersionId,
    jdAnalysis: form.jdAnalysis,
    resumeProjects: form.resumeProjects,
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export interface ResumeExport {
  id?: number
  name: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  notes?: string
  createdAt: string
  fileBase64?: string
}

export async function resumeToExport(resume: import('../types').ResumeVersion): Promise<ResumeExport> {
  const { fileBlob, ...rest } = resume
  if (!fileBlob) return rest
  return {
    ...rest,
    fileBase64: await blobToBase64(fileBlob),
  }
}

export function exportToResume(stored: ResumeExport): import('../types').ResumeVersion {
  const { fileBase64, mimeType, ...rest } = stored
  if (!fileBase64) return rest
  return {
    ...rest,
    fileBlob: base64ToBlob(fileBase64, mimeType ?? 'application/pdf'),
  }
}
