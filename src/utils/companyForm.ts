import type { Season, JdAnalysis, ResumeProjectSuggestion } from '../types'

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
  salary: '暂无',
  deadline: '',
  jdRaw: '',
  requirements: '',
  responsibilities: '',
  skills: [],
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
  return {
    name: company.name,
    position: company.position,
    season: company.season,
    year: company.year,
    location: company.location ?? '',
    salary: company.salary ?? '暂无',
    deadline: company.deadline ?? '',
    jdRaw: company.jdRaw,
    requirements: company.requirements ?? '',
    responsibilities: company.responsibilities ?? '',
    skills: company.skills,
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
