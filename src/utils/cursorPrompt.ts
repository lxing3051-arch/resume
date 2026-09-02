/** 复制原始 JD 给用户的简历 skill，由 skill 读取既有简历后生成针对性版本。 */
export function buildResumeMatchPrompt(opts: {
  companyName?: string
  position: string
  jdRaw: string
}): string {
  const { companyName, position, jdRaw } = opts
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

  parts.push(
    '',
    '请使用我的“简历 skill”处理这份 JD：',
    '1. 先读取我已有的简历、技能和项目经历；不要虚构项目、成果、数据或职责。',
    '2. 对照 JD 判断我的已有经历与岗位的匹配度，标出匹配点、关键缺口和需要我确认的信息。',
    '3. 明确判断：我是否真的需要补充项目才能投递该岗位，并说明判断依据。若不需要，说明应如何调整已有项目的表述与排序。',
    '4. 只有确实需要补项目时，给出 1 个项目建议：它补的具体缺口、业务场景、技术栈、可验证的交付物和 3 条简历亮点。不要虚构结果，不要给出从零开发教程。',
    '5. 我会先评估这份建议；只有我确认要做，才会把项目建议交给 resume_project 生成并学习。不要把项目视为已经完成。',
    '',
    '请严格基于 JD 和我的既有简历信息作答。',
  )

  return parts.join('\n')
}

/** @deprecated 请使用 buildResumeMatchPrompt。 */
export const buildCursorProjectPrompt = buildResumeMatchPrompt
