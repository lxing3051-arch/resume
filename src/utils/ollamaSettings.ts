import type { OllamaSettings } from '../types'

const KEY = 'job-tracker-ollama'

const DEFAULTS: OllamaSettings = {
  enabled: false,
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2',
  autoAnalyze: false,
}

export function getOllamaSettings(): OllamaSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULTS
}

export function saveOllamaSettings(settings: OllamaSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
