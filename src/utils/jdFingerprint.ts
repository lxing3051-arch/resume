import type { JdAnalysis } from '../types'

export function jdRawFingerprint(jdRaw: string): string {
  const t = jdRaw.trim()
  return `${t.length}:${t.slice(0, 300)}`
}

export function needsJdReanalysis(jdRaw: string, analysis?: JdAnalysis): boolean {
  if (!jdRaw.trim()) return false
  if (!analysis) return true
  const fp = jdRawFingerprint(jdRaw)
  if (analysis.jdRawFingerprint !== fp) return true
  return analysis.source !== 'ai'
}

export function createProjectId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createStepId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
