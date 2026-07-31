/** 复制 JD 到 Cursor 对话用的提示模板 */
export function buildCursorProjectPrompt(opts: {
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
    '以下是 Boss 直聘岗位描述（JD）：',
    '---',
    jdRaw.trim(),
    '---',
  ]

  if (analysisSummary?.trim()) {
    parts.push('', '（网站已做的规则分类摘要，供参考）', analysisSummary.trim())
  }

  parts.push(
    '',
    '请帮我：',
    '1. 提炼这个岗位最看重的硬技能、项目经历要求',
    '2. 结合 JD 设计 1～2 个可以写进简历、能经得起面试追问的项目',
    '3. 从选题、技术栈、实现步骤开始，一步步带我做（我可以在 Cursor 里写代码）',
    '',
    '先从项目选题和整体方案开始，不要一次给太多。',
  )

  return parts.join('\n')
}

export function buildAnalysisSummary(analysis: {
  education: string[]
  experience: string[]
  hardSkills: string[]
  softSkills: string[]
  projectRequirements: string[]
  responsibilities: string[]
}): string {
  const lines: string[] = []
  const section = (title: string, items: string[]) => {
    if (!items.length) return
    lines.push(`${title}：${items.join('；')}`)
  }
  section('学历', analysis.education)
  section('经验', analysis.experience)
  section('硬技能', analysis.hardSkills)
  section('软性', analysis.softSkills)
  section('项目要求', analysis.projectRequirements)
  section('岗位职责', analysis.responsibilities)
  return lines.join('\n')
}
