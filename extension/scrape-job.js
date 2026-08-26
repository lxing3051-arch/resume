/* 通用职位页采集器：覆盖企业招聘官网及常见招聘平台。 */
function scrapeJobPage() {
  const clean = (value) => (value || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const textOf = (el) => clean(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ')
  const isCssNoise = (line) => line.length > 80 && /(?::where\(|\.css-[\w-]+|--[\w-]+:|font-family:|clip-path:|@media\s*\()/i.test(line)
  const blockOf = (el) => clean(el?.innerText || el?.textContent || '')
    .split('\n')
    .filter((line) => !isCssNoise(line.trim()))
    .join('\n')
    .trim()
  const pick = (...selectors) => {
    for (const selector of selectors) {
      const value = textOf(document.querySelector(selector))
      if (value && value.length < 180) return value
    }
    return ''
  }
  const pickBlock = (...selectors) => {
    for (const selector of selectors) {
      const value = blockOf(document.querySelector(selector))
      if (value.length > 60) return value
    }
    return ''
  }
  const htmlToText = (html) => {
    const el = document.createElement('div')
    el.innerHTML = html || ''
    return blockOf(el)
  }
  const first = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1]?.trim()) return match[1].trim()
    }
    return ''
  }
  const ROLE_WORD = /(?:工程师|开发|算法|产品|运营|设计|分析师|专员|顾问|实习生|管培生|经理|研究员|测试|销售|市场|商务|财务|法务|编辑|策划)/
  const ENGLISH_ROLE_WORD = /\b(?:advisory|technology|consult(?:ing|ant)|analyst|associate|intern(?:ship)?|graduate|risk|digital|enablement|audit|tax|finance|strategy|data|software|engineer|manager)\b/i
  // 仅拦截「校招」这类纯导航标签；真实职位名可以包含“校招”说明。
  const GENERIC_JOB_TITLE = /^(?:核心业务|校园(?:招聘|校招)?|校招|加入我们|相关职位|相关网站|联系我们|职位\s*ID|公司介绍|招聘首页|职位列表)$/
  const normalizeJobTitle = (value) => {
    const title = clean(value).split('\n')[0]
      .replace(/^(?:职位名称|岗位名称|招聘职位|职位|岗位)\s*[：:]?\s*/, '')
      .replace(/\s*(?:[-|｜]\s*)?(?:字节跳动|ByteDance|腾讯|Tencent|快手|Kuaishou)(?:招聘|校园招聘)?\s*$/i, '')
      .replace(/\s*(?:[-|｜]\s*)?(?:校园招聘|社会招聘|招聘官网)\s*$/i, '')
      .trim()
    const looksLikeEnglishRole = /[A-Za-z]{3}/.test(title) && ENGLISH_ROLE_WORD.test(title)
    return title.length >= 2 && title.length <= 100 && (ROLE_WORD.test(title) || looksLikeEnglishRole) && !GENERIC_JOB_TITLE.test(title)
      ? title
      : ''
  }
  const normalizeSalary = (value) => {
    const salary = clean(value).replace(/^(?:薪资|薪酬|待遇)\s*[：:]?\s*/i, '').trim()
    if (/^(?:面议|薪资面议)$/i.test(salary)) return '面议'
    // 必须含 K、元或货币符号；岗位 ID、年份、人数等纯数字不能作为薪资。
    if (/^(?:¥|￥|\$)?\s*\d+(?:\.\d+)?\s*(?:[-~－至]\s*\d+(?:\.\d+)?\s*)?[kK](?:\s*[·・x×]\s*\d+\s*薪)?$/.test(salary)) return salary
    if (/^(?:¥|￥)?\s*\d{3,7}\s*(?:[-~－至]\s*\d{3,7}\s*)?元(?:\s*\/\s*(?:月|天|年))?$/.test(salary)) return salary
    return ''
  }
  const sectionAfterHeading = (labels) => {
    const candidates = document.querySelectorAll('h2, h3, h4, strong, [class*="title"], [class*="Title"]')
    for (const heading of candidates) {
      if (!labels.includes(textOf(heading).replace(/[：:]$/, ''))) continue
      const sibling = heading.nextElementSibling
      const siblingText = blockOf(sibling)
      if (siblingText.length > 40) return siblingText
      const parent = heading.parentElement
      const parentText = blockOf(parent)
      if (parentText.length > 60) return parentText.replace(blockOf(heading), '').trim()
    }
    return ''
  }
  const trimRecruitingTail = (text) => {
    const normalized = clean(text)
    const tail = /(?:^|\n)\s*(?:[•·●▪◦-]\s*)?(?:相关职位|相关推荐|推荐职位|职位推荐|联系我们|相关网站|候选人反馈平台|官网使用体验反馈|字节跳动招聘|京公网安备|版权所有)\s*(?=\n|$)/im
    const match = normalized.match(tail)
    return (match?.index === undefined ? normalized : normalized.slice(0, match.index)).trim()
  }

  function jobPostingFromJsonLd() {
    const nodes = []
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || '')
        nodes.push(data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] || []))
      } catch {
        // 忽略页面内不完整的 JSON-LD。
      }
    }
    return nodes.find((node) => {
      const type = node?.['@type']
      return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))
    })
  }

  const url = location.href.split('?')[0]
  const host = location.hostname
  const jsonJob = jobPostingFromJsonLd()
  // ShadowRoot 的 textContent 会包含组件注入的 CSS；职位页正文已在主文档可见，不能把样式表混入 JD。
  const bodyText = trimRecruitingTail(blockOf(document.body))
  const source = host.includes('zhipin.com')
    ? 'boss-zhipin'
    : host.includes('bytedance.com')
      ? 'bytedance'
    : host.includes('qq.com')
      ? 'tencent'
      : 'generic-web'

  // 明确标注的「职位/岗位」字段优先级高于 H1 和 document.title；后两者常是导航文案。
  const labelledTitle = first(bodyText, [
    /(?:^|\n)\s*(?:职位名称|岗位名称|招聘职位|职位|岗位)\s*[：:]?\s*([^\n]{2,80})/i,
  ])
  const selectorTitle = pick(
    '.job-banner h1', '.job-primary h1', '.job-title',
    '[class*="job-title"]', '[class*="position-title"]',
    '[class*="jobName"]', '[class*="position-name"]', '[class*="positionName"]',
    '[class*="post-title"]', 'main h1', 'h1',
  )
  // 部分校招官网不用 h1，而是在普通 div 中展示职位名；从页面前部的标题候选中兜底。
  const headingTitle = Array.from(document.querySelectorAll('h1, h2, [class*="title" i], [class*="name" i]'))
    .map((element) => normalizeJobTitle(textOf(element)))
    .find(Boolean)
  const bodyTitle = bodyText
    .split('\n')
    .slice(0, 40)
    .map(normalizeJobTitle)
    .find(Boolean)
  const title = normalizeJobTitle(jsonJob?.title) || normalizeJobTitle(selectorTitle) || headingTitle || bodyTitle ||
    normalizeJobTitle(labelledTitle) || normalizeJobTitle(document.querySelector('meta[property="og:title"]')?.content) ||
    normalizeJobTitle(document.title)
  const company = jsonJob?.hiringOrganization?.name || pick(
    '.company-info h3', '.company-name', '[class*="company-name"]',
    '[class*="companyName"]', '[data-company-name]',
  ) || (
    host.includes('bytedance.com') ? '字节跳动'
      : host.includes('qq.com') ? '腾讯'
        : host.includes('kpmg') ? '毕马威'
          : ''
  )
  const locationText = jsonJob?.jobLocation?.address?.addressLocality || pick(
    '.text-city', '.location-address', '[class*="location"]', '[class*="city"]', '[data-location]',
  ) || first(bodyText, [/(?:工作地点|工作城市|地点|地址)\s*[：:]?\s*([^\n]+)/i])
  // 普通数字（职位 ID、届数、人数等）绝不能猜作薪资；只接受明确标注的薪资字段。
  const salary = normalizeSalary(first(bodyText, [
    /(?:^|\n)\s*(?:薪资|薪酬|待遇)\s*[：:]?\s*([^\n]+)/i,
  ]))
  const bytedanceDescription = host.includes('bytedance.com')
    ? [
        sectionAfterHeading(['职位描述', '岗位职责', '工作内容']),
        sectionAfterHeading(['职位要求', '任职要求', '岗位要求']),
      ].filter(Boolean).join('\n\n')
    : ''
  const description = htmlToText(jsonJob?.description) || bytedanceDescription || pickBlock(
    '.job-sec-text', '.job-detail-body', '.job-description', '.job-desc',
    '[class*="job-description"]', '[class*="jobDescription"]',
    '[class*="position-detail"]', '[class*="positionDetail"]',
    '[class*="job-content"]', '[class*="jobContent"]', '[class*="detail-content"]',
    '[class*="description"]', '[class*="requirement"]', 'main article',
  )

  // 局部容器有时只包含「职位描述」或只包含「职位要求」。
  // 合并整页正文后再分段，避免另一块在录入时直接丢失。
  const jdBody = trimRecruitingTail([description, bodyText].filter(Boolean).join('\n')).slice(0, 24000)
  // 有的官网连续两次使用“你需要：”：第一次是工作事项，第二次才是资格要求。
  // 不先拆开会导致第二段要求被一并塞进职责。
  const jobLines = jdBody
    .replace(/\s*(?=(?:职位描述|岗位描述|岗位职责|工作职责|任职要求|职位要求|岗位要求|你需要|我们希望你|我们期待你|你将负责)\s*[：:])/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const repeatedNeedIndexes = jobLines
    .map((line, index) => (/^(?:你需要|我们希望你|我们期待你|你将负责)\s*[：:]?$/.test(line) ? index : -1))
    .filter((index) => index >= 0)
  const repeatedNeeds = repeatedNeedIndexes.length >= 2
    ? {
        responsibilities: jobLines.slice(repeatedNeedIndexes[0] + 1, repeatedNeedIndexes[1]).join('\n'),
        requirements: jobLines.slice(repeatedNeedIndexes[1] + 1).join('\n'),
      }
    : null
  const requirements = repeatedNeeds?.requirements || first(jdBody, [
    /(?:任职要求|职位要求|岗位要求|任职资格|任职条件)\s*[：:]?\s*([\s\S]*?)(?=\n\s*(?:福利待遇|公司介绍|工作地点)\s*[：:]?|$)/i,
  ])
  const responsibilities = repeatedNeeds?.responsibilities || first(jdBody, [
    /(?:岗位职责|工作职责|工作内容|职位描述|岗位描述)\s*[：:]?\s*([\s\S]*?)(?=\n\s*(?:任职要求|职位要求|岗位要求|任职资格)\s*[：:]?|$)/i,
  ])

  if (!jsonJob && (!title || title.length < 2 || jdBody.length < 80)) {
    return { error: '未识别到职位详情。请打开具体岗位页面后重试。' }
  }

  const jdRaw = [
    company && `公司：${company}`,
    title && `职位：${title}`,
    salary && `薪资：${salary}`,
    locationText && `地点：${locationText}`,
    '',
    responsibilities && `岗位职责\n${responsibilities}`,
    requirements && `任职要求\n${requirements}`,
    !responsibilities && !requirements && jdBody,
  ].filter(Boolean).join('\n')

  return {
    source,
    name: company || '',
    position: title || '',
    location: locationText || '',
    salary: salary || '',
    jdRaw,
    bossUrl: url,
    requirements: requirements || '',
    responsibilities: responsibilities || '',
    scrapedAt: new Date().toISOString(),
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'SCRAPE_JOB') return undefined
    try {
      const data = scrapeJobPage()
      sendResponse(data.error ? { ok: false, error: data.error } : { ok: true, data })
    } catch (error) {
      sendResponse({ ok: false, error: String(error) })
    }
    return true
  })
}

window.__SCRAPE_JOB_PAGE__ = scrapeJobPage
