import { db } from '../db/database'
import type { Company, CompanyProjectLink, PortfolioProject } from '../types'

export interface LinkedProject {
  link: CompanyProjectLink
  project: PortfolioProject
}

export async function linkProjectToCompany(
  companyId: number,
  projectId: number,
  pitch?: string,
) {
  const existing = await db.companyProjectLinks
    .where({ companyId, projectId })
    .first()
  if (existing) {
    if (pitch !== undefined) {
      await db.companyProjectLinks.update(existing.id!, { pitch: pitch.trim() || undefined })
    }
    return existing.id!
  }

  return db.companyProjectLinks.add({
    companyId,
    projectId,
    pitch: pitch?.trim() || undefined,
    linkedAt: new Date().toISOString(),
  }) as Promise<number>
}

export async function unlinkProjectFromCompany(companyId: number, projectId: number) {
  await db.companyProjectLinks.where({ companyId, projectId }).delete()
}

export async function updateLinkPitch(companyId: number, projectId: number, pitch: string) {
  const link = await db.companyProjectLinks.where({ companyId, projectId }).first()
  if (!link?.id) return
  await db.companyProjectLinks.update(link.id, {
    pitch: pitch.trim() || undefined,
  })
}

export async function getLinkedProjects(companyId: number): Promise<LinkedProject[]> {
  const links = await db.companyProjectLinks.where('companyId').equals(companyId).toArray()
  const result: LinkedProject[] = []
  for (const link of links) {
    const project = await db.projects.get(link.projectId)
    if (project) result.push({ link, project })
  }
  return result.sort((a, b) => b.link.linkedAt.localeCompare(a.link.linkedAt))
}

export async function getLinkedCompanies(projectId: number): Promise<
  Array<{ link: CompanyProjectLink; company: Company }>
> {
  const links = await db.companyProjectLinks.where('projectId').equals(projectId).toArray()
  const result: Array<{ link: CompanyProjectLink; company: Company }> = []
  for (const link of links) {
    const company = await db.companies.get(link.companyId)
    if (company) result.push({ link, company })
  }
  return result.sort((a, b) => b.link.linkedAt.localeCompare(a.link.linkedAt))
}

export async function deleteLinksForCompany(companyId: number) {
  await db.companyProjectLinks.where('companyId').equals(companyId).delete()
}
