import type { Season, SkillLevel, JdAnalysis, ResumeProjectSuggestion } from '../types'

export interface CompanyFormData {
  name: string
  position: string
  season: Season
  year: number
  location: string
  salary: string
  deadline: string
  jdRaw: string
  requirements: string
  responsibilities: string
  skills: string[]
  skillRatings: Record<string, SkillLevel>
  bossUrl: string
  notes: string
  referrerName: string
  referrerContact: string
  hrName: string
  hrContact: string
  resumeVersionId: number | ''
  jdAnalysis?: JdAnalysis
  resumeProjects?: ResumeProjectSuggestion[]
}

export const emptyCompanyForm = (): CompanyFormData => ({
  name: '',
  position: '',
  season: '秋招',
  year: new Date().getFullYear(),
  location: '',
  salary: '',
  deadline: '',
  jdRaw: '',
  requirements: '',
  responsibilities: '',
  skills: [],
  skillRatings: {},
  bossUrl: '',
  notes: '',
  referrerName: '',
  referrerContact: '',
  hrName: '',
  hrContact: '',
  resumeVersionId: '',
})

export function companyToForm(company: {
  name: string
  position: string
  season: Season
  year: number
  location?: string
  salary?: string
  deadline?: string
  jdRaw: string
  requirements?: string
  responsibilities?: string
  skills: string[]
  skillRatings?: Record<string, SkillLevel>
  bossUrl?: string
  notes?: string
  referrerName?: string
  referrerContact?: string
  hrName?: string
  hrContact?: string
  resumeVersionId?: number
  jdAnalysis?: JdAnalysis
  resumeProjects?: ResumeProjectSuggestion[]
}): CompanyFormData {
  const ratings = company.skillRatings ?? {}
  for (const skill of company.skills) {
    if (!ratings[skill]) ratings[skill] = '需复习'
  }
  return {
    name: company.name,
    position: company.position,
    season: company.season,
    year: company.year,
    location: company.location ?? '',
    salary: company.salary ?? '',
    deadline: company.deadline ?? '',
    jdRaw: company.jdRaw,
    requirements: company.requirements ?? '',
    responsibilities: company.responsibilities ?? '',
    skills: company.skills,
    skillRatings: ratings,
    bossUrl: company.bossUrl ?? '',
    notes: company.notes ?? '',
    referrerName: company.referrerName ?? '',
    referrerContact: company.referrerContact ?? '',
    hrName: company.hrName ?? '',
    hrContact: company.hrContact ?? '',
    resumeVersionId: company.resumeVersionId ?? '',
    jdAnalysis: company.jdAnalysis,
    resumeProjects: company.resumeProjects,
  }
}

export function initSkillRatings(
  skills: string[],
  existing: Record<string, SkillLevel> = {},
): Record<string, SkillLevel> {
  const next = { ...existing }
  for (const skill of skills) {
    if (!next[skill]) next[skill] = '需复习'
  }
  for (const key of Object.keys(next)) {
    if (!skills.includes(key)) delete next[key]
  }
  return next
}
