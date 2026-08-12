/* 通用职位页采集器：覆盖企业招聘官网及常见招聘平台。 */
function scrapeJobPage() {
  const clean = (value) => (value || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const textOf = (el) => clean(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ')
  const blockOf = (el) => clean(el?.innerText || el?.textContent || '')
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
  const shadowText = [...document.querySelectorAll('*')]
    .map((element) => element.shadowRoot ? blockOf(element.shadowRoot) : '')
    .filter((text) => text.length > 40)
    .join('\n')
  const bodyText = [blockOf(document.body), shadowText].filter(Boolean).join('\n')
  const source = host.includes('zhipin.com')
    ? 'boss-zhipin'
    : host.includes('bytedance.com')
      ? 'bytedance'
      : host.includes('qq.com')
        ? 'tencent'
        : 'generic-web'

  const title = jsonJob?.title || pick(
    '.job-banner h1', '.job-primary h1', '.job-title',
    '[class*="job-title"]', '[class*="position-title"]',
    '[class*="jobName"]', 'main h1', 'h1',
  ) || document.querySelector('meta[property="og:title"]')?.content || document.title
  const company = jsonJob?.hiringOrganization?.name || pick(
    '.company-info h3', '.company-name', '[class*="company-name"]',
    '[class*="companyName"]', '[data-company-name]',
  ) || (host.includes('bytedance.com') ? '字节跳动' : host.includes('qq.com') ? '腾讯' : '')
  const location = jsonJob?.jobLocation?.address?.addressLocality || pick(
    '.text-city', '.location-address', '[class*="location"]', '[class*="city"]', '[data-location]',
  ) || first(bodyText, [/(?:工作地点|工作城市|地点|地址)\s*[：:]?\s*([^\n]+)/i])
  const salary = pick('.salary', '[class*="salary"]', '[class*="compensation"]') || first(bodyText, [
    /(?:薪资|薪酬|待遇)\s*[：:]?\s*([^\n]+)/i,
    /\b((?:\d{1,3}\s*[-~－至]\s*\d{1,3}|\d{1,3})\s*[kK](?:\s*[·・]\s*\d{1,2}薪)?)\b/,
  ])
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

  const jdBody = description || bodyText.slice(0, 16000)
  const requirements = first(jdBody, [
    /(?:任职要求|职位要求|岗位要求|任职资格|任职条件)\s*[：:]?\s*([\s\S]*?)(?=\n\s*(?:福利待遇|公司介绍|工作地点)\s*[：:]?|$)/i,
  ])
  const responsibilities = first(jdBody, [
    /(?:岗位职责|工作职责|工作内容|职位描述|岗位描述)\s*[：:]?\s*([\s\S]*?)(?=\n\s*(?:任职要求|职位要求|岗位要求|任职资格)\s*[：:]?|$)/i,
  ])

  if (!jsonJob && (!title || title.length < 2 || jdBody.length < 80)) {
    return { error: '未识别到职位详情。请打开具体岗位页面后重试。' }
  }

  const jdRaw = [
    company && `公司：${company}`,
    title && `职位：${title}`,
    salary && `薪资：${salary}`,
    location && `地点：${location}`,
    '',
    responsibilities && `岗位职责\n${responsibilities}`,
    requirements && `任职要求\n${requirements}`,
    !responsibilities && !requirements && jdBody,
  ].filter(Boolean).join('\n')

  return {
    source,
    name: company || '',
    position: title || '',
    location: location || '',
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
