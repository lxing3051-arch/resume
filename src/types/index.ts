export type Season = '秋招' | '春招' | '实习' | '社招' | '其他'

export type StageType =
  | '网申'
  | '简历投递'
  | '笔试'
  | '一面'
  | '二面'
  | '三面'
  | 'HR面'
  | 'OC'
  | '拒信'
  | '其他'

export type StageStatus = '未开始' | '进行中' | '已完成' | '已跳过'

export type ApplicationStatus =
  | '待投递'
  | '已投递'
  | '笔试中'
  | '面试中'
  | '已OC'
  | '已结束'

export interface Company {
  id?: number
  name: string
  position: string
  season: Season
  year: number
  location?: string
  salary?: string
  deadline?: string
  jdRaw: string
  skills: string[]
  requirements?: string
  responsibilities?: string
  bossUrl?: string
  notes?: string
  referrerName?: string
  referrerContact?: string
  hrName?: string
  hrContact?: string
  resumeVersionId?: number
  jdAnalysis?: JdAnalysis
  resumeProjects?: ResumeProjectSuggestion[]
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id?: number
  companyId: number
  type: StageType
  status: StageStatus
  scheduledAt?: string
  completedAt?: string
  notes?: string
  order: number
}

export interface ResumeVersion {
  id?: number
  name: string
  fileName?: string
  fileBlob?: Blob
  fileSize?: number
  mimeType?: string
  notes?: string
  createdAt: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface InterviewNote {
  id?: number
  companyId?: number
  companyName?: string
  stageType?: StageType
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface NotificationSettings {
  enabled: boolean
  deadlineDays: number
  stageReminder: boolean
}

export interface OllamaSettings {
  enabled: boolean
  baseUrl: string
  model: string
  /** @deprecated 请使用 AiSettings.autoAnalyze */
  autoAnalyze: boolean
}

export type AiProvider = 'ollama' | 'gemini' | 'auto'

export interface GeminiSettings {
  apiKey: string
  model: string
}

/** AI/规则 结构化 JD 分析 */
export interface JdAnalysis {
  education: string[]
  experience: string[]
  hardSkills: string[]
  softSkills: string[]
  projectRequirements: string[]
  responsibilities: string[]
  requirements: string[]
  companySummary: string
  analyzedAt?: string
  source?: 'ai' | 'rules'
  /** 分析时对应的 JD 指纹，用于判断是否需要重新分析 */
  jdRawFingerprint?: string
}

export interface ProjectStep {
  id: string
  title: string
  description: string
  tasks: string[]
  done: boolean
}

export interface ProjectChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

/** @deprecated 旧版嵌在公司内的项目建议，请使用 PortfolioProject + CompanyProjectLink */
export interface ResumeProjectSuggestion {
  id: string
  title: string
  description: string
  techStack: string[]
  highlights: string[]
  createdAt: string
  steps?: ProjectStep[]
  currentStepIndex?: number
  chatHistory?: ProjectChatMessage[]
  status?: 'planned' | 'in_progress' | 'done'
}

export type ProjectStatus = 'planned' | 'in_progress' | 'done'

/** 项目附件（代码压缩包、文档、截图等） */
export interface ProjectFile {
  id: string
  fileName: string
  fileBlob?: Blob
  fileSize?: number
  mimeType?: string
  uploadedAt: string
}

/** 独立项目库条目，可关联多个岗位 */
export interface PortfolioProject {
  id?: number
  title: string
  description: string
  techStack: string[]
  highlights: string[]
  repoUrl?: string
  notes?: string
  status: ProjectStatus
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
}

/** 岗位 ↔ 项目 多对多关联 */
export interface CompanyProjectLink {
  id?: number
  companyId: number
  projectId: number
  /** 针对该岗位的简历表述（可选，不写则用项目默认描述） */
  pitch?: string
  linkedAt: string
}

export const DEFAULT_STAGES: StageType[] = [
  '网申',
  '简历投递',
  '笔试',
  '一面',
  '二面',
  'HR面',
  'OC',
]

export const SKILL_KEYWORDS = [
  'SQL',
  'Python',
  'R语言',
  'Excel',
  'Tableau',
  'Power BI',
  'Java',
  'C++',
  'Go',
  'JavaScript',
  'TypeScript',
  'React',
  'Vue',
  'Spring',
  'MySQL',
  'Redis',
  'Kafka',
  'Docker',
  'Kubernetes',
  '算法',
  '数据结构',
  '机器学习',
  '深度学习',
  'Linux',
  'Git',
  '微服务',
  '分布式',
  '高并发',
  'Node.js',
  'Flutter',
  'Android',
  'iOS',
  'AutoML',
  'Prompt Engineering',
]
