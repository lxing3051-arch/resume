import type { JdNumberedSection } from '../types'
import { dedupeBullets, isDuplicateText } from './jdDedupe'

const ANY_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述|任职要求|职位要求|岗位要求|任职资格|任职条件|福利待遇|公司介绍|公司简介|关于我们)\s*[：:]?$/
const RESPONSIBILITY_HEADING = /^(?:职位描述|岗位描述|工作内容|工作职责|岗位职责|职责描述)\s*[：:]?$/
const REQUIREMENT_HEADING = /^(?:任职要求|职位要求|岗位要求|任职资格|任职条件)\s*[：:]?$/

export function extractJobBlocks(text: string): { responsibilities: string; requirements: string } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const collect = (heading: RegExp) => {
    const start = lines.findIndex((line) => heading.test(line.trim()))
    if (start < 0) return ''
    const result: string[] = []
    for (const line of lines.slice(start + 1)) {
      if (ANY_HEADING.test(line.trim())) break
      result.push(line)
    }
    return result.join('\n').trim()
  }
  return {
    responsibilities: collect(RESPONSIBILITY_HEADING),
    requirements: collect(REQUIREMENT_HEADING),
  }
}

function splitItems(block: string): string[] {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
  const bullets = lines
    .map((line) => line.replace(/^\s*(?:[-•·]|[（(]?\d+[.、)）]|[一二三四五六七八九十]+[、.])\s*/, '').trim())
    .filter((line) => line.length >= 4)
  if (bullets.length > 1) return dedupeBullets(bullets)
  return dedupeBullets(
    block
      .split(/[；;]+/)
      .map((piece) => piece.trim())
      .filter((piece) => piece.length >= 4),
  )
}

/** 把职责/要求按原始编号或空行切成卡片，并移除卡片内及卡片间的重复句。 */
export function buildDedupedSections(
  block: string,
  baseTitle: string,
  maxSections = 10,
): JdNumberedSection[] {
  const normalized = block.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const numbered = normalized
    .split(/(?=^\s*(?:\d+|[一二三四五六七八九十]+)[.、)）]\s*)/m)
    .map((part) => part.trim())
    .filter(Boolean)
  const chunks = numbered.length > 1 ? numbered : normalized.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean)
  const seen: string[] = []
  const output: JdNumberedSection[] = []

  for (const chunk of chunks) {
    const cleanChunk = chunk.replace(/^\s*(?:\d+|[一二三四五六七八九十]+)[.、)）]\s*/, '').trim()
    const items = splitItems(cleanChunk).filter((item) => {
      if (seen.some((previous) => isDuplicateText(previous, item))) return false
      seen.push(item)
      return true
    })
    if (!items.length) continue
    const firstLine = cleanChunk.split('\n')[0]?.trim() ?? ''
    const hasShortTitle = firstLine.length >= 2 && firstLine.length <= 28 && cleanChunk.includes('\n')
    const title = hasShortTitle ? firstLine.replace(/[：:]$/, '') : `${baseTitle} ${output.length + 1}`
    const cardItems = hasShortTitle
      ? items.filter((item) => !isDuplicateText(item, firstLine))
      : items
    if (!cardItems.length && hasShortTitle) continue
    output.push({ index: output.length + 1, title, items: cardItems })
    if (output.length >= maxSections) break
  }
  return output
}
