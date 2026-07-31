import { isSameDay, parseISO } from 'date-fns'
import { db } from '../db/database'
import type { ApplicationStatus, Company, SkillLevel, Stage } from '../types'

export interface RecruitStats {
  total: number
  byStatus: Record<ApplicationStatus, number>
  applied: number
  writtenTest: number
  interviewed: number
  oc: number
  rejected: number
  applyRate: number
  writtenRate: number
  interviewRate: number
  ocRate: number
}

export interface TodoItem {
  id: string
  type: 'apply' | 'deadline' | 'schedule' | 'skill'
  priority: 'high' | 'medium' | 'low'
  title: string
  subtitle: string
  companyId?: number
  link?: string
}

function hasStageProgress(stages: Stage[], types: Stage['type'][]) {
  return stages.some((s) => types.includes(s.type) && s.status !== '未开始')
}

function hasStageDone(stages: Stage[], types: Stage['type'][]) {
  return stages.some((s) => types.includes(s.type) && s.status === '已完成')
}

export async function computeStats(): Promise<RecruitStats> {
  const [companies, stages] = await Promise.all([db.companies.toArray(), db.stages.toArray()])
  const stagesByCompany = new Map<number, Stage[]>()
  for (const stage of stages) {
    const list = stagesByCompany.get(stage.companyId) ?? []
    list.push(stage)
    stagesByCompany.set(stage.companyId, list)
  }

  const byStatus = {
    待投递: 0,
    已投递: 0,
    笔试中: 0,
    面试中: 0,
    已OC: 0,
    已结束: 0,
  } satisfies Record<ApplicationStatus, number>

  let applied = 0
  let writtenTest = 0
  let interviewed = 0
  let oc = 0
  let rejected = 0

  for (const company of companies) {
    byStatus[company.status]++
    const cs = stagesByCompany.get(company.id!) ?? []
    if (hasStageDone(cs, ['网申', '简历投递']) || company.status !== '待投递') applied++
    if (hasStageProgress(cs, ['笔试']) || ['笔试中', '面试中', '已OC'].includes(company.status))
      writtenTest++
    if (
      hasStageProgress(cs, ['一面', '二面', '三面', 'HR面']) ||
      ['面试中', '已OC'].includes(company.status)
    )
      interviewed++
    if (company.status === '已OC' || hasStageDone(cs, ['OC'])) oc++
    if (company.status === '已结束' || hasStageDone(cs, ['拒信'])) rejected++
  }

  const total = companies.length || 1
  return {
    total: companies.length,
    byStatus,
    applied,
    writtenTest,
    interviewed,
    oc,
    rejected,
    applyRate: Math.round((applied / total) * 100),
    writtenRate: applied ? Math.round((writtenTest / applied) * 100) : 0,
    interviewRate: writtenTest ? Math.round((interviewed / writtenTest) * 100) : 0,
    ocRate: interviewed ? Math.round((oc / interviewed) * 100) : 0,
  }
}

export async function computeTodos(): Promise<TodoItem[]> {
  const today = new Date()
  const [companies, stages] = await Promise.all([db.companies.toArray(), db.stages.toArray()])
  const todos: TodoItem[] = []

  for (const company of companies) {
    if (company.status === '待投递') {
      const urgent = company.deadline && isSameDay(parseISO(company.deadline), today)
      todos.push({
        id: `apply-${company.id}`,
        type: 'apply',
        priority: urgent ? 'high' : 'medium',
        title: `投递：${company.name}`,
        subtitle: company.position,
        companyId: company.id,
        link: `/company/${company.id}`,
      })
    }

    if (
      company.deadline &&
      isSameDay(parseISO(company.deadline), today) &&
      !['已OC', '已结束'].includes(company.status)
    ) {
      todos.push({
        id: `deadline-${company.id}`,
        type: 'deadline',
        priority: 'high',
        title: `今日截止：${company.name}`,
        subtitle: company.position,
        companyId: company.id,
        link: `/company/${company.id}`,
      })
    }

    for (const skill of company.skills) {
      const level = company.skillRatings?.[skill]
      if (level === '需复习' || level === '不会') {
        if (!['已OC', '已结束'].includes(company.status)) {
          todos.push({
            id: `skill-${company.id}-${skill}`,
            type: 'skill',
            priority: level === '不会' ? 'high' : 'medium',
            title: `复习 ${skill}`,
            subtitle: `${company.name} · ${company.position}`,
            companyId: company.id,
            link: `/company/${company.id}/edit`,
          })
        }
      }
    }
  }

  for (const stage of stages) {
    if (!stage.scheduledAt || stage.status === '已完成' || stage.status === '已跳过') continue
    const date = parseISO(stage.scheduledAt)
    if (!isSameDay(date, today)) continue
    const company = companies.find((c) => c.id === stage.companyId)
    if (!company) continue
    todos.push({
      id: `schedule-${stage.id}`,
      type: 'schedule',
      priority: 'high',
      title: `今日${stage.type}：${company.name}`,
      subtitle: stage.scheduledAt.slice(11, 16) + (stage.notes ? ` · ${stage.notes}` : ''),
      companyId: company.id,
      link: `/company/${company.id}`,
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return todos.sort((a, b) => order[a.priority] - order[b.priority])
}

export function skillSummary(companies: Company[]) {
  const map = new Map<string, { 会: number; 不会: number; 需复习: number; companies: string[] }>()
  for (const company of companies) {
    for (const skill of company.skills) {
      const level = company.skillRatings?.[skill] ?? '需复习'
      const entry = map.get(skill) ?? { 会: 0, 不会: 0, 需复习: 0, companies: [] }
      entry[level]++
      if (!entry.companies.includes(company.name)) entry.companies.push(company.name)
      map.set(skill, entry)
    }
  }
  return [...map.entries()]
    .map(([skill, data]) => ({ skill, ...data }))
    .sort((a, b) => b.不会 + b.需复习 - (a.不会 + a.需复习))
}

export type { SkillLevel }
