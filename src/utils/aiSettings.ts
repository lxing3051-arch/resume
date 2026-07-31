import type { AiProvider } from '../types'

const KEY = 'job-tracker-ai'

export interface AiSettings {
  provider: AiProvider
  autoAnalyze: boolean
}

const DEFAULTS: AiSettings = {
  provider: 'auto',
  autoAnalyze: false,
}

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function getProviderLabel(provider: AiProvider): string {
  switch (provider) {
    case 'gemini':
      return 'Gemini Pro'
    case 'ollama':
      return 'Ollama 本地'
    case 'auto':
      return '自动（优先 Gemini）'
  }
}
