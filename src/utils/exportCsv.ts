import { db } from '../db/database'
import type { Company } from '../types'

function escapeCsv(value: unknown) {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function companyRow(c: Company) {
  return [
    c.name,
    c.position,
    c.season,
    c.year,
    c.status,
    c.location ?? '',
    c.salary ?? '',
    c.deadline ?? '',
    c.skills.join('、'),
    c.referrerName ?? '',
    c.referrerContact ?? '',
    c.hrName ?? '',
    c.hrContact ?? '',
    c.bossUrl ?? '',
    c.notes ?? '',
    c.createdAt.slice(0, 10),
    c.updatedAt.slice(0, 10),
  ]
}

const HEADERS = [
  '公司',
  '岗位',
  '赛季',
  '年份',
  '状态',
  '地点',
  '薪资',
  '截止日期',
  '技能',
  '内推人',
  '内推联系方式',
  'HR',
  'HR联系方式',
  'Boss链接',
  '备注',
  '创建日期',
  '更新日期',
]

export async function exportCompaniesCsv(): Promise<string> {
  const companies = await db.companies.orderBy('updatedAt').reverse().toArray()
  const lines = [HEADERS.map(escapeCsv).join(',')]
  for (const c of companies) {
    lines.push(companyRow(c).map(escapeCsv).join(','))
  }
  return '\uFEFF' + lines.join('\n')
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadCompaniesCsv() {
  const csv = await exportCompaniesCsv()
  downloadCsv(csv, `投递记录-${new Date().toISOString().slice(0, 10)}.csv`)
}
