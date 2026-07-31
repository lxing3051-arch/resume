import { getOllamaSettings } from './ollamaSettings'
import type { ParsedJD } from './jdParser'
import { parseStructuredJD } from './jdStructure'
import { SKILL_KEYWORDS } from '../types'

const PARSE_PROMPT = `你是招聘 JD 解析助手。从以下岗位描述中提取信息，只输出 JSON，不要其他文字。
字段：name(公司名), position(岗位), location(地点), salary(薪资), requirements(任职要求全文), responsibilities(岗位职责全文), skills(字符串数组，从 JD 提取技术技能)
若某字段无法确定则填空字符串或空数组。

岗位描述：
`

export async function checkOllamaAvailable(): Promise<boolean> {
  const { baseUrl } = getOllamaSettings()
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function listOllamaModels(): Promise<string[]> {
  const { baseUrl } = getOllamaSettings()
  const res = await fetch(`${baseUrl}/api/tags`)
  if (!res.ok) throw new Error('无法连接 Ollama')
  const data = (await res.json()) as { models: { name: string }[] }
  return data.models.map((m) => m.name)
}

export async function parseJDWithOllama(text: string): Promise<ParsedJD> {
  const { baseUrl, model } = getOllamaSettings()
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: PARSE_PROMPT + text.slice(0, 8000),
      stream: false,
      format: 'json',
    }),
  })
  if (!res.ok) throw new Error(`Ollama 请求失败 (${res.status})`)

  const data = (await res.json()) as { response: string }
  const parsed = JSON.parse(data.response) as Partial<ParsedJD & { skills: string[] }>

  const skills =
    parsed.skills?.length ?
      parsed.skills
    : SKILL_KEYWORDS.filter((s) => text.toLowerCase().includes(s.toLowerCase()))

  return {
    name: parsed.name?.trim() ?? '',
    position: parsed.position?.trim() ?? '',
    location: parsed.location?.trim() ?? '',
    salary: parsed.salary?.trim() ?? '',
    requirements: parsed.requirements?.trim() ?? '',
    responsibilities: parsed.responsibilities?.trim() ?? '',
    companyIntro: parsed.companyIntro?.trim() ?? '',
    skills,
    structured: parseStructuredJD(text, skills),
  }
}
