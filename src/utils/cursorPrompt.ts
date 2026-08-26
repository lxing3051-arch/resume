/** 复制原始 JD 给用户的简历 skill，由 skill 读取既有简历后生成针对性版本。 */
export function buildResumeMatchPrompt(opts: {
  companyName?: string
  position: string
  jdRaw: string
  analysisSummary?: string
}): string {
  const { companyName, position, jdRaw, analysisSummary } = opts
  const header = companyName ?
    `我在准备秋招，目标岗位：${position}（${companyName}）`
  : `我在准备秋招，目标岗位：${position}`

  const parts = [
    header,
    '',
    '以下是招聘网页原始 JD：',
    '---',
    jdRaw.trim(),
    '---',
  ]

  if (analysisSummary?.trim()) {
    parts.push('', '（网站已做的结构分类摘要，供参考）', analysisSummary.trim())
  }

  parts.push(
    '',
    '请使用我的“简历 skill”处理这份 JD：',
    '1. 先读取我已有的简历、技能和项目经历；不要在本提示中重复索取或虚构项目。',
    '2. 对照 JD 判断我的已有经历与岗位的匹配度，标出匹配点、缺口和需要我确认的信息。',
    '3. 基于真实已有经历，生成一版针对该岗位的简历内容：个人优势、技能排序和项目经历表述；没有依据的数据一律写【待确认】。',
    '4. 不要主动生成新项目、虚构项目成果，或给出从零开发项目方案。只有我明确追问补强方式时，再说明缺口。',
    '',
    '请严格基于 JD 和我的既有简历信息作答。',
  )

  return parts.join('\n')
}

/** @deprecated 请使用 buildResumeMatchPrompt。 */
export const buildCursorProjectPrompt = buildResumeMatchPrompt

export function buildAnalysisSummary(analysis: {
  responsibilitySections?: Array<{ index: number; title: string; items: string[] }>
  requirementSections?: Array<{ index: number; title: string; items: string[] }>
  hardSkills?: string[]
}): string {
  const lines: string[] = []

  for (const block of analysis.responsibilitySections ?? []) {
    lines.push(`【岗位职责 ${block.index}. ${block.title}】${block.items.join('；')}`)
  }
  for (const block of analysis.requirementSections ?? []) {
    lines.push(`【任职要求 ${block.index}. ${block.title}】${block.items.join('；')}`)
  }
  if (analysis.hardSkills?.length) {
    lines.push(`【技术栈】${analysis.hardSkills.join('、')}`)
  }

  return lines.join('\n')
}
