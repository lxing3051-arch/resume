import { db } from '../db/database'
import type { PortfolioProject, ProjectFile, ProjectStatus } from '../types'

export function createFileId() {
  return crypto.randomUUID()
}

export async function createProject(data: {
  title: string
  description?: string
  techStack?: string[]
  highlights?: string[]
  repoUrl?: string
  notes?: string
  status?: ProjectStatus
}) {
  const now = new Date().toISOString()
  return db.projects.add({
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    techStack: data.techStack ?? [],
    highlights: data.highlights ?? [],
    repoUrl: data.repoUrl?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    status: data.status ?? 'planned',
    files: [],
    createdAt: now,
    updatedAt: now,
  }) as Promise<number>
}

export async function updateProject(
  id: number,
  patch: Partial<
    Pick<
      PortfolioProject,
      'title' | 'description' | 'techStack' | 'highlights' | 'repoUrl' | 'notes' | 'status'
    >
  >,
) {
  await db.projects.update(id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteProject(id: number) {
  await db.transaction('rw', db.projects, db.companyProjectLinks, async () => {
    await db.companyProjectLinks.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

export async function addProjectFile(projectId: number, file: File) {
  const project = await db.projects.get(projectId)
  if (!project) return

  const entry: ProjectFile = {
    id: createFileId(),
    fileName: file.name,
    fileBlob: file,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }

  await db.projects.update(projectId, {
    files: [...project.files, entry],
    updatedAt: new Date().toISOString(),
  })
}

export async function removeProjectFile(projectId: number, fileId: string) {
  const project = await db.projects.get(projectId)
  if (!project) return

  await db.projects.update(projectId, {
    files: project.files.filter((f) => f.id !== fileId),
    updatedAt: new Date().toISOString(),
  })
}

export function downloadProjectFile(file: ProjectFile) {
  if (!file.fileBlob) return
  const url = URL.createObjectURL(file.fileBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function parseLines(text: string) {
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseCommaList(text: string) {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
