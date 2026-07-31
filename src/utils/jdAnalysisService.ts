import type { JdAnalysis } from '../types'
import { db } from '../db/database'

export async function saveJdAnalysis(companyId: number, analysis: JdAnalysis) {
  await db.companies.update(companyId, {
    jdAnalysis: analysis,
    updatedAt: new Date().toISOString(),
  })
}
