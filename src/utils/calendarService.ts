import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { db } from '../db/database'
import type { Company, Stage } from '../types'

export type CalendarEventType = 'stage' | 'deadline'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  date: Date
  time?: string
  title: string
  subtitle: string
  companyId: number
  stageType?: Stage['type']
}

export function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export async function getCalendarEvents(weekStart: Date): Promise<CalendarEvent[]> {
  const weekEnd = addDays(weekStart, 7)
  const [companies, stages] = await Promise.all([db.companies.toArray(), db.stages.toArray()])
  const companyMap = new Map(companies.map((c) => [c.id!, c]))
  const events: CalendarEvent[] = []

  for (const stage of stages) {
    if (!stage.scheduledAt) continue
    const date = parseISO(stage.scheduledAt)
    if (date < weekStart || date >= weekEnd) continue
    const company = companyMap.get(stage.companyId)
    if (!company) continue
    events.push({
      id: `stage-${stage.id}`,
      type: 'stage',
      date,
      time: format(date, 'HH:mm'),
      title: `${company.name} · ${stage.type}`,
      subtitle: company.position,
      companyId: stage.companyId,
      stageType: stage.type,
    })
  }

  for (const company of companies) {
    if (!company.deadline || ['已OC', '已结束'].includes(company.status)) continue
    const date = parseISO(company.deadline)
    if (date < weekStart || date >= weekEnd) continue
    events.push({
      id: `deadline-${company.id}`,
      type: 'deadline',
      date,
      title: `${company.name} 截止`,
      subtitle: company.position,
      companyId: company.id!,
    })
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function eventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((e) => isSameDay(e.date, day))
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  return `${format(weekStart, 'M月d日', { locale: zhCN })} - ${format(weekEnd, 'M月d日', { locale: zhCN })}`
}

export function shiftWeek(weekStart: Date, delta: number) {
  return addDays(weekStart, delta * 7)
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function isPastWeek(weekStart: Date) {
  return addDays(weekStart, 6) < subDays(new Date(), 0)
}

export type { Company }
