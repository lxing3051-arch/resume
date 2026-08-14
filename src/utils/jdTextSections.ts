import type { JdNumberedSection } from '../types'
import { dedupeBullets, isDuplicateText } from './jdDedupe'

const MAIN_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述|任职要求|职位要求|岗位要求|任职资格|任职条件|福利待遇|公司介绍|公司简介|关于我们)\s*[：:]?$/
const RESPONSIBILITY_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述)\s*[：:]?$/
const REQUIREMENT_HEADING = /^(?:任职要求|职位要求|岗位要求|任职资格|任职条件)\s*[：:]?$/
// 页面底部、推荐职位等内容不属于当前 JD，不能继续混入职责卡片。
const END_OF_JD = /^(?:相关职位|相关推荐|推荐职位|职位推荐|联系我们|相关网站|职位\s*ID|公司地址|投递方式|立即投递|分享|举报)/i

function normalizedLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\u200b-\u200d\ufeff]/g, '').trim())
    .filter(Boolean)
}

function stripListMarker(text: string): string {
  return text
    .replace(/^\s*(?:[-•·●▪◦]|\(?\d{1,2}[.、)）]|[一二三四五六七八九十]+[.、)）])\s*/, '')
    .trim()
}

function cleanTitle(text: string): string {
  return stripListMarker(text)
    .replace(/^[【\[（(]\s*/, '')
    .replace(/\s*[】\]）)]$/, '')
    .replace(/[：:]$/, '')
    .trim()
}

function isSubsectionHeading(line: string): boolean {
  const title = cleanTitle(line)
  if (!title || MAIN_HEADING.test(title)) return false
  return (
    (/^[【\[（(].+[】\]）)]$/.test(line) && title.length <= 36) ||
    (/^(?:加入我们|你将做什么|我们希望你|你需要具备|我们期待|你会负责)/.test(title) && title.length <= 36)
  )
}

export function extractJobBlocks(text: string): { responsibilities: string; requirements: string } {
  const lines = normalizedLines(text)
  const collect = (heading: RegExp) => {
    const start = lines.findIndex((line) => heading.test(line))
    if (start < 0) return ''
    const result: string[] = []
    for (const line of lines.slice(start + 1)) {
      if (MAIN_HEADING.test(line) || END_OF_JD.test(cleanTitle(line))) break
      result.push(line)
    }
    return result.join('\n').trim()
  }
  return { responsibilities: collect(RESPONSIBILITY_HEADING), requirements: collect(REQUIREMENT_HEADING) }
}

function sectionItems(lines: string[], seen: string[]): string[] {
  return dedupeBullets(
    lines
      .map(stripListMarker)
      .map((line) => line.replace(/^\s*[【\[（(]\s*|\s*[】\]）)]\s*$/g, '').trim())
      .filter((line) => line.length >= 4)
      .filter((line) => {
        if (seen.some((previous) => isDuplicateText(previous, line))) return false
        seen.push(line)
        return true
      }),
  )
}

/**
 * 将连续的职责句收在同一张卡片；只有网页明确给出「【小标题】」时才拆卡。
 * 这样不会把「加入我们，你将做什么？」误当作一条职责，也避免每个编号单独成卡。
 */
export function buildDedupedSections(block: string, baseTitle: string, maxSections = 10): JdNumberedSection[] {
  const lines = normalizedLines(block).filter((line) => !MAIN_HEADING.test(line) && !END_OF_JD.test(cleanTitle(line)))
  if (!lines.length) return []

  const groups: Array<{ title: string; lines: string[] }> = []
  let current = { title: baseTitle, lines: [] as string[] }
  for (const line of lines) {
    if (isSubsectionHeading(line)) {
      if (current.lines.length) groups.push(current)
      current = { title: cleanTitle(line), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.lines.length) groups.push(current)

  const seen: string[] = []
  return groups
    .map((group) => ({ title: group.title, items: sectionItems(group.lines, seen) }))
    .filter((group) => group.items.length)
    .slice(0, maxSections)
    .map((group, index) => ({ index: index + 1, ...group }))
}
