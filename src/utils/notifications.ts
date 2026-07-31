import { db } from '../db/database'
import type { NotificationSettings } from '../types'

const SETTINGS_KEY = 'job-tracker-notification-settings'
const NOTIFIED_KEY = 'job-tracker-notified'

interface NotifiedRecord {
  date: string
  keys: string[]
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...{ enabled: false, deadlineDays: 3, stageReminder: true }, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { enabled: false, deadlineDays: 3, stageReminder: true }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadNotified(): NotifiedRecord {
  const raw = localStorage.getItem(NOTIFIED_KEY)
  if (!raw) return { date: todayKey(), keys: [] }
  const record = JSON.parse(raw) as NotifiedRecord
  if (record.date !== todayKey()) return { date: todayKey(), keys: [] }
  return record
}

function markNotified(key: string) {
  const record = loadNotified()
  if (!record.keys.includes(key)) record.keys.push(key)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(record))
}

function wasNotified(key: string) {
  return loadNotified().keys.includes(key)
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

function sendNotification(title: string, body: string, key: string) {
  if (wasNotified(key)) return
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, tag: key })
  markNotified(key)
}

export async function checkAndNotify() {
  const settings = getNotificationSettings()
  if (!settings.enabled || Notification.permission !== 'granted') return

  const companies = await db.companies.toArray()
  const active = companies.filter((c) => !['已OC', '已结束'].includes(c.status))

  for (const company of active) {
    if (company.deadline) {
      const diff = Math.ceil((new Date(company.deadline).getTime() - Date.now()) / 86400000)
      if (diff >= 0 && diff <= settings.deadlineDays) {
        const label =
          diff === 0 ? '今天截止' : diff === 1 ? '明天截止' : `${diff} 天后截止`
        sendNotification(
          `【截止提醒】${company.name}`,
          `${company.position} · ${label}`,
          `deadline-${company.id}-${todayKey()}`,
        )
      }
    }
  }

  if (!settings.stageReminder) return

  const stages = await db.stages.toArray()
  for (const stage of stages) {
    if (!stage.scheduledAt || stage.status === '已完成' || stage.status === '已跳过') continue
    const scheduled = new Date(stage.scheduledAt)
    const diff = Math.ceil((scheduled.getTime() - Date.now()) / 86400000)
    if (diff >= 0 && diff <= 1) {
      const company = companies.find((c) => c.id === stage.companyId)
      if (!company) continue
      const label = diff === 0 ? '今天' : '明天'
      sendNotification(
        `【日程提醒】${company.name} · ${stage.type}`,
        `${label} ${stage.scheduledAt.slice(0, 16).replace('T', ' ')}`,
        `stage-${stage.id}-${todayKey()}`,
      )
    }
  }
}
