/**
 * Boss 直聘 JD 抓取核心（可被 content script 注入或 scripting.executeScript 调用）
 */
function scrapeBossZhipinPage() {
  /** 单行标题等短文本 */
  function textOf(el) {
    if (!el) return ''
    return (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ')
  }

  /** 保留换行的区块文本（职位描述必须用这个） */
  function blockText(el) {
    if (!el) return ''
    return (el.innerText || el.textContent || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function pick(...selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        const t = textOf(el)
        if (t && t.length < 200) return t
      } catch {
        /* ignore invalid selector */
      }
    }
    return ''
  }

  function pickBlock(...selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        const t = blockText(el)
        if (t && t.length > 30) return t
      } catch {
        /* ignore */
      }
    }
    return ''
  }

  function extractBetween(text, startRe, endRe) {
    const m = text.match(startRe)
    if (!m) return ''
    const start = (m.index || 0) + m[0].length
    const rest = text.slice(start)
    const end = rest.match(endRe)
    return (end ? rest.slice(0, end.index) : rest).trim()
  }

  function splitMainBlocks(body) {
    let responsibilities = extractBetween(
      body,
      /(?:岗位职责|工作内容)[：:\s]*/i,
      /(?:任职要求|岗位要求|任职资格)/i,
    )
    let requirements = extractBetween(
      body,
      /(?:任职要求|岗位要求|任职资格)[：:\s]*/i,
      /(?:公司介绍|工作地址|员工福利|$)/i,
    )

    if (!responsibilities && !requirements) {
      const desc = extractBetween(body, /(?:职位描述)[：:\s]*/i, /(?:公司介绍|$)/i) || body
      responsibilities = extractBetween(
        desc,
        /(?:岗位职责|工作内容)[：:\s]*/i,
        /(?:任职要求|岗位要求)/i,
      )
      requirements = extractBetween(
        desc,
        /(?:任职要求|岗位要求|任职资格)[：:\s]*/i,
        /$/,
      )
      if (!responsibilities && !requirements) {
        const respM = desc.match(/(?:岗位职责|工作内容)[：:\s]*([\s\S]*?)(?=任职要求|岗位要求|$)/i)
        const reqM = desc.match(/(?:任职要求|岗位要求|任职资格)[：:\s]*([\s\S]*)$/i)
        if (respM) responsibilities = respM[1].trim()
        if (reqM) requirements = reqM[1].trim()
      }
    }

    return { responsibilities, requirements }
  }

  function parseRequirementParts(reqBlock) {
    const parts = { education: '', skills: '', softSkills: '', experience: '' }
    if (!reqBlock) return parts

    const chunks = reqBlock.split(/(?=^\s*\d+[.、．)\s]+)/m).filter(Boolean)
    const defs = [
      { key: 'education', re: /学历|专业/ },
      { key: 'skills', re: /^技能$|技能要求|硬技能/ },
      { key: 'softSkills', re: /软性|软技能|素质/ },
      { key: 'experience', re: /^经验$|经验要求|实习/ },
    ]

    for (const chunk of chunks) {
      const titleLine = (chunk.trim().split('\n')[0] || '').replace(/^\d+[.、．)\s]+/, '').trim()
      const body = chunk.trim().replace(/^[^\n]+\n?/, '').trim()
      for (const def of defs) {
        if (def.re.test(titleLine)) {
          parts[def.key] = body || titleLine
          break
        }
      }
    }
    return parts
  }

  function splitNumberedItems(text) {
    if (!text) return []
    return text
      .split(/(?=^\s*\d+[.、．)\s]+)/m)
      .map((c) =>
        c
          .trim()
          .replace(/^\d+[.、．)\s]+/, '')
          .replace(/\s*\(\d+\)\s*/g, '；')
          .replace(/\s*（\d+）\s*/g, '；')
          .replace(/\n+/g, ' ')
          .trim(),
      )
      .filter((s) => s.length >= 4)
  }

  const bodyText = blockText(document.body)
  if (/登录.*查看|请登录|安全验证|验证码/.test(bodyText.slice(0, 500))) {
    return { error: '需要登录 Boss 直聘，请先登录并刷新页面' }
  }

  const bossUrl = location.href.split('?')[0]

  const name = pick(
    '.company-info h3',
    '.sider-company .company-info h3',
    '.company-info a[href*="/gongsi/"]',
    'a.company-name',
    '.job-detail .company-name',
    '[class*="company-name"]',
    'div[class*="company"] a',
    '.boss-info-attr',
  )

  const position = pick(
    '.name h1',
    '.job-banner .name h1',
    '.job-title',
    'h1[class*="job"]',
    '.info-primary h1',
    'div.job-detail-header h1',
    'h1',
  )

  const salary = pick(
    '.salary',
    'span[class*="salary"]',
    '.job-primary .salary',
    '.job-primary .red',
    '[class*="salary"]',
  )

  const locationText = pick(
    '.job-primary .text-city',
    '.text-city',
    '.location-address',
    '[class*="job-address"]',
    '.job-primary p',
    'a[href*="city"]',
  )

  function isBenefitTag(t) {
    return /福利|补贴|保险|年假|奖金|体检|聚餐|下午茶|旅游|五险|一金|全勤|工龄|餐补|通讯|高温|生日|节日|团建|零食|意外险/.test(t)
  }

  function isJobDescTag(t) {
    if (!t || t.length < 2 || t.length > 24) return false
    if (isBenefitTag(t)) return false
    if (/(?:相关)?专业$|^\d{4}届|在校|应届|统招|本科|硕士|博士/.test(t)) return false
    return true
  }

  function shouldSkipSection(title) {
    return /员工福利|福利待遇|公司地址|工作地址|工商信息/.test(title)
  }

  // 仅从「职位描述」区块抓取岗位标签（不含员工福利区）
  const skillTags = []
  const tagSeen = new Set()
  const jobDescRoot =
    document.querySelector('.job-detail-section .job-sec-text')?.closest('.job-sec') ||
    document.querySelector('.job-detail-main') ||
    document.querySelector('.job-detail')

  if (jobDescRoot) {
    for (const el of jobDescRoot.querySelectorAll(
      '.job-tag, .tag-list .tag, .job-tags span, [class*="job-tag"]',
    )) {
      const t = textOf(el)
      if (t && isJobDescTag(t) && !tagSeen.has(t)) {
        tagSeen.add(t)
        skillTags.push(t)
      }
    }
  }

  let jobBody = ''
  const jdParts = []
  const seen = new Set()

  for (const sec of document.querySelectorAll(
    '.job-sec, .job-detail-section, div[class*="job-sec"]',
  )) {
    const title = textOf(sec.querySelector('h3, h2, .title, [class*="title"]'))
    if (shouldSkipSection(title)) continue
    const bodyEl =
      sec.querySelector('.job-sec-text, .text, .desc, [class*="description"]') || sec
    let body = blockText(bodyEl)
    if (title && body.startsWith(title)) body = body.slice(title.length).trim()
    if (!body || body.length < 8) continue
    const key = title + body.slice(0, 40)
    if (seen.has(key)) continue
    seen.add(key)
    jdParts.push(title ? `${title}\n${body}` : body)
    if (/职位描述|岗位描述/.test(title)) jobBody = body
  }

  if (!jobBody) {
    jobBody = pickBlock(
      '.job-sec-text',
      '.job-detail-body',
      '.detail-content',
      '[class*="job-description"]',
      '[class*="desc-content"]',
    )
    if (jobBody) jdParts.push(jobBody)
  }

  const { responsibilities, requirements } = splitMainBlocks(jobBody || bodyText)
  const requirementParts = parseRequirementParts(requirements)
  const responsibilityItems = splitNumberedItems(responsibilities)

  const jdRaw = [
    name && `公司：${name}`,
    position && `岗位：${position}`,
    salary && `薪资：${salary}`,
    locationText && `地点：${locationText}`,
    '',
    responsibilities && `岗位职责\n${responsibilities}`,
    requirements && `\n任职要求\n${requirements}`,
    !responsibilities && !requirements && jdParts.join('\n\n'),
  ]
    .filter((x) => x !== false && x !== '')
    .join('\n')

  const finalJd = jdRaw.length > 50 ? jdRaw : bodyText.slice(0, 12000)

  if (finalJd.length < 30 && !name && !position) {
    return {
      error: '未识别到岗位内容。请打开「岗位详情页」（URL 含 job_detail），刷新后重试',
    }
  }

  return {
    source: 'boss-zhipin',
    name: name || '',
    position: position || '',
    location: locationText || '',
    salary: salary || '',
    jdRaw: finalJd,
    bossUrl,
    requirements,
    responsibilities,
    responsibilityItems,
    requirementParts,
    skillTags,
    scrapedAt: new Date().toISOString(),
  }
}

// content script 消息监听
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SCRAPE_JOB') {
      try {
        const data = scrapeBossZhipinPage()
        if (data.error) sendResponse({ ok: false, error: data.error })
        else sendResponse({ ok: true, data })
      } catch (e) {
        sendResponse({ ok: false, error: String(e) })
      }
    }
    return true
  })
}

// scripting.executeScript 注入时直接返回结果
if (typeof window !== 'undefined') {
  window.__SCRAPE_BOSS_ZHIPIN__ = scrapeBossZhipinPage
}
