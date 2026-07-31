import { db } from '../db/database'
import type { InterviewNote, StageType } from '../types'

export async function createInterviewNote(data: {
  companyId?: number
  companyName?: string
  stageType?: StageType
  title: string
  content: string
  tags?: string[]
}) {
  const now = new Date().toISOString()
  return db.interviewNotes.add({
    ...data,
    tags: data.tags ?? [],
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateInterviewNote(
  id: number,
  patch: Partial<Pick<InterviewNote, 'title' | 'content' | 'tags' | 'stageType'>>,
) {
  await db.interviewNotes.update(id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteInterviewNote(id: number) {
  await db.interviewNotes.delete(id)
}

export async function updateStageSchedule(
  stageId: number,
  patch: { scheduledAt?: string; notes?: string },
) {
  await db.stages.update(stageId, patch)
}
