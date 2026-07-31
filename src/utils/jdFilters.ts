/** 员工福利、待遇类 —— 不应进入技能/要求分类 */
const BENEFIT_RE =
  /福利|补贴|保险|年假|奖金|体检|聚餐|下午茶|旅游|五险|一金|全勤|工龄|餐补|通讯|高温|生日|节日|团建|零食|意外险|补充医疗|免费班车|住房补贴/

/** 学历/身份类页面标签 —— 归入学历栏，不是可评分技能 */
const EDUCATION_TAG_RE =
  /(?:相关)?专业$|^\d{4}届|在校|应届|统招|学历|本科|硕士|博士|大专|985|211|毕业/

/** 整段标题：跳过、不纳入 JD 正文 */
export const SKIP_SECTION_TITLES =
  /员工福利|福利待遇|公司地址|工作地址|工商信息|查看地图|融资阶段|公司规模/

export function isEmployeeBenefit(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return BENEFIT_RE.test(t)
}

export function isEducationMetaTag(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (EDUCATION_TAG_RE.test(t)) return true
  if (/^(深圳|北京|上海|广州|杭州|成都|武汉|南京|西安|苏州|重庆|天津|长沙|郑州|合肥|厦门|东莞|佛山|珠海|惠州|中山|青岛|大连|沈阳|哈尔滨|长春|济南|福州|昆明|贵阳|南宁|海口|石家庄|太原|南昌|兰州|银川|西宁|呼和浩特|乌鲁木齐|无锡|宁波|温州|嘉兴|金华|绍兴|台州|常州|南通|扬州|徐州|保定|唐山|洛阳|珠海)(·|$)/.test(t)) {
    return true
  }
  return false
}

/** Boss 职位描述区的小标签：去掉福利、地点、学历标签 */
export function filterJobDescTags(tags: string[]): string[] {
  return tags.filter((t) => {
    const s = t.trim()
    if (s.length < 2 || s.length > 24) return false
    if (isEmployeeBenefit(s)) return false
    if (isEducationMetaTag(s)) return false
    return true
  })
}

/** 硬技能列表最终过滤 */
export function filterHardSkills(skills: string[]): string[] {
  return [...new Set(skills.map((s) => s.trim()).filter(Boolean))].filter(
    (s) => !isEmployeeBenefit(s) && !isEducationMetaTag(s) && s.length >= 2 && s.length <= 28,
  )
}

/** 是否像技术/工具类技能（用于无「技能」小节时的兜底） */
export function looksLikeTechnicalSkill(text: string): boolean {
  const t = text.trim()
  if (!t || isEmployeeBenefit(t) || isEducationMetaTag(t)) return false
  if (/^[A-Za-z][A-Za-z0-9+#.\/\-]{0,20}$/.test(t)) return true
  if (/SQL|Python|Excel|Tableau|Power\s*BI|Java|Linux|Git|Docker|React|Vue|Spark|Hadoop|AutoML|LLM|RAG|Prompt/i.test(t)) {
    return true
  }
  if (/分析|建模|算法|机器学习|深度学习|数据挖掘/.test(t) && !/商业分析专员|数据分析岗/.test(t)) {
    return t.length <= 12
  }
  return false
}

export function shouldSkipSectionTitle(title: string): boolean {
  return SKIP_SECTION_TITLES.test(title.trim())
}
