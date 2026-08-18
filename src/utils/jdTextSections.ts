import type { JdNumberedSection } from '../types'
import { dedupeBullets, isDuplicateText } from './jdDedupe'

const MAIN_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述|任职要求|职位要求|岗位要求|任职资格|任职条件|福利待遇|公司介绍|公司简介|关于我们)\s*[：:]?$/
const RESPONSIBILITY_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述)\s*[：:]?$/
const REQUIREMENT_HEADING = /^(?:任职要求|职位要求|岗位要求|任职资格|任职条件)\s*[：:]?$/
// 部分官网连续使用“你需要：”作为任务和资格的分隔标题，需结合出现顺序判断。
const AMBIGUOUS_NEED_HEADING = /^(?:你需要|我们希望你|我们期待你|你将负责)\s*[：:]?$/
// 页面底部、推荐职位等内容不属于当前 JD，不能继续混入职责卡片。
const END_OF_JD = /^(?:相关职位|相关推荐|推荐职位|职位推荐|联系我们|相关网站|职位\s*ID|公司地址|投递方式|立即投递|分享|举报)/i
const PAGE_NOISE = /(?::where\(|\.css-[\w-]+|--[\w-]+:|font-family:|clip-path:|@media\s*\()/i
const FOOTER_NOISE = /^(?:字节跳动(?:\s+Seed)?团队|关注我们获取最新动态|候选人反馈平台|官网使用体验反馈|京公网安备)/

function normalizedLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    // 某些官网/插件会把“你需要：”和前一条正文压到同一行；先强制还原标题边界。
    .replace(/\s*(?=(?:职位描述|岗位描述|岗位职责|工作职责|任职要求|职位要求|岗位要求|你需要|我们希望你|我们期待你|你将负责)\s*[：:])/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\u200b-\u200d\ufeff]/g, '').trim())
    .filter(Boolean)
    .filter((line) => !(line.length > 80 && PAGE_NOISE.test(line)) && !FOOTER_NOISE.test(line))
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
  const responsibilities = collect(RESPONSIBILITY_HEADING)
  const requirements = collect(REQUIREMENT_HEADING)

  // 例如：职位描述 → 你需要（工作事项）→ 你需要（任职资格）。
  // 不能把第二段要求继续塞进职责，否则会出现职责十几条、要求为空的情况。
  const responsibilityStart = lines.findIndex((line) => RESPONSIBILITY_HEADING.test(line))
  const needs = lines
    .map((line, index) => (AMBIGUOUS_NEED_HEADING.test(line) ? index : -1))
    .filter((index) => index >= 0)
  if (responsibilityStart >= 0 && needs.length >= 2) {
    const end = (start: number) => {
      const offset = lines.slice(start).findIndex((line) => END_OF_JD.test(cleanTitle(line)))
      return offset < 0 ? lines.length : start + offset
    }
    return {
      // 第一个“你需要”前通常是岗位/团队介绍，不属于职责条目。
      responsibilities: lines.slice(needs[0] + 1, needs[1]).join('\n').trim(),
      requirements: lines.slice(needs[1] + 1, end(needs[1] + 1)).join('\n').trim(),
    }
  }

  return { responsibilities, requirements }
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
  const allLines = normalizedLines(block)
  // “相关职位”之后是推荐岗位和网站页脚，必须连同后续内容一起截断。
  const tailIndex = allLines.findIndex((line) => END_OF_JD.test(cleanTitle(line)))
  const lines = (tailIndex >= 0 ? allLines.slice(0, tailIndex) : allLines)
    .filter((line) => !MAIN_HEADING.test(line) && !END_OF_JD.test(cleanTitle(line)))
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
    .map((group) => ({
      title: group.title,
      // 超过 10 条通常意味着推荐岗位或网页杂项泄漏；不继续展示可疑内容。
      items: sectionItems(group.lines, seen).slice(0, 10),
    }))
    .filter((group) => group.items.length)
    .slice(0, maxSections)
    .map((group, index) => ({ index: index + 1, ...group }))
}
