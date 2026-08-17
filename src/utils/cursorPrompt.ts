import type { PortfolioProject } from '../types'

/** 复制 JD 到 AI 对话的简历匹配提示模板。 */
export function buildResumeMatchPrompt(opts: {
  companyName?: string
  position: string
  jdRaw: string
  analysisSummary?: string
  projects?: PortfolioProject[]
}): string {
  const { companyName, position, jdRaw, analysisSummary, projects = [] } = opts
  const header = companyName ?
    `我在准备秋招，目标岗位：${position}（${companyName}）`
  : `我在准备秋招，目标岗位：${position}`

  const parts = [
    header,
    '',
    '以下是 Boss 直聘岗位描述（JD）：',
    '---',
    jdRaw.trim(),
    '---',
  ]

  if (analysisSummary?.trim()) {
    parts.push('', '（网站已做的结构分类摘要，供参考）', analysisSummary.trim())
  }

  parts.push('', '我已有的项目如下：')
  if (projects.length) {
    projects.forEach((project, index) => {
      parts.push(
        `${index + 1}. ${project.title}`,
        `- 描述：${project.description || '未填写'}`,
        `- 技术栈：${project.techStack.join('、') || '未填写'}`,
        `- 简历亮点：${project.highlights.join('；') || '未填写'}`,
      )
    })
  } else {
    parts.push('（项目库中暂未录入项目；请先向我询问已有项目的内容，不要直接虚构项目。）')
  }

  parts.push(
    '',
    '请按以下顺序帮我准备这份岗位的简历：',
    '1. 提炼 JD 中最重要的硬技能、业务场景和项目经历要求，并区分“必须具备”和“加分项”。',
    '2. 逐个评估我已有项目与 JD 的匹配度（高/中/低），说明匹配点、缺口和不能写进简历的部分。不要编造我没有做过的成果、数据或职责。',
    '3. 选出最适合投递该岗位的 1～2 个已有项目；为每个项目写 3 条可直接放进简历的表述，并说明需要我补充核实的信息。',
    '4. 只有当“必须具备”的能力无法由已有项目覆盖时，才提出一个最小的补充项目建议，并先说明它要补哪个缺口；不要默认生成新项目，也不要给出从零开发教程。',
    '5. 最后给出一版针对该岗位的“项目经历”简历段落草稿，保留需要我确认的数据为【待确认】。',
    '',
    '请优先复用已有项目，回答要具体、克制，并严格基于我提供的信息。',
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
