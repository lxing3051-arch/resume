import type { JdAnalysis, ResumeProjectSuggestion } from '../types'
import { db } from '../db/database'
import { analyzeJD, generateResumeProjects } from './jdAnalysis'
import { getAiSettings } from './aiSettings'
import { needsJdReanalysis } from './jdFingerprint'
import { isAiAvailable, isAiConfigured } from './aiProvider'
import { normalizeLegacyProject } from './projectCoach'

export async function saveJdAnalysis(companyId: number, analysis: JdAnalysis) {
  await db.companies.update(companyId, {
    jdAnalysis: analysis,
    updatedAt: new Date().toISOString(),
  })
}

export async function runAndSaveJdAnalysis(companyId: number, jdRaw: string) {
  const analysis = await analyzeJD(jdRaw)
  await saveJdAnalysis(companyId, analysis)
  return analysis
}

export async function saveResumeProjects(companyId: number, projects: ResumeProjectSuggestion[]) {
  await db.companies.update(companyId, {
    resumeProjects: projects,
    updatedAt: new Date().toISOString(),
  })
}

export async function runAndSaveResumeProjects(
  companyId: number,
  analysis: JdAnalysis,
  position: string,
) {
  const projects = await generateResumeProjects(analysis, position)
  await saveResumeProjects(companyId, projects)
  return projects
}

export async function copyProjectToClipboard(project: ResumeProjectSuggestion) {
  const lines = [
    `【${project.title}】`,
    project.description,
    `技术栈：${project.techStack.join('、')}`,
    ...project.highlights.map((h) => `· ${h}`),
  ]
  await navigator.clipboard.writeText(lines.join('\n'))
}

/** AI 已配置且需重新分析时，自动跑 AI 分析 */
export async function autoAnalyzeIfNeeded(
  jdRaw: string,
  current?: JdAnalysis,
): Promise<JdAnalysis | null> {
  if (!isAiConfigured() || getAiSettings().autoAnalyze === false) return null
  if (!needsJdReanalysis(jdRaw, current)) return null
  if (!(await isAiAvailable())) return null
  try {
    return await analyzeJD(jdRaw)
  } catch {
    return null
  }
}

export async function updateResumeProject(
  companyId: number,
  projectId: string,
  patch: Partial<ResumeProjectSuggestion>,
) {
  const company = await db.companies.get(companyId)
  if (!company?.resumeProjects) return
  const projects = company.resumeProjects.map((p) =>
    (p.id === projectId ? normalizeLegacyProject({ ...p, ...patch }) : normalizeLegacyProject(p)),
  )
  await saveResumeProjects(companyId, projects)
}

export async function getResumeProject(companyId: number, projectId: string) {
  const company = await db.companies.get(companyId)
  const project = company?.resumeProjects?.find((p) => p.id === projectId)
  return project ? normalizeLegacyProject(project) : undefined
}
