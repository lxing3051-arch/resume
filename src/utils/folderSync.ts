import { db } from '../db/database'
import { exportBackup } from './backup'

const META_KEY = 'syncFolder'

export function supportsFolderSync() {
  return 'showDirectoryPicker' in window
}

export async function getSyncFolderName(): Promise<string | null> {
  const meta = await db.meta.get(META_KEY)
  return meta?.folderName ?? null
}

export async function pickSyncFolder(): Promise<string> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await db.meta.put({ key: META_KEY, folderName: handle.name, handle })
  return handle.name
}

export async function clearSyncFolder() {
  await db.meta.delete(META_KEY)
}

async function getSyncHandle(): Promise<FileSystemDirectoryHandle | null> {
  const meta = await db.meta.get(META_KEY)
  if (!meta?.handle) return null
  const perm = await meta.handle.queryPermission({ mode: 'readwrite' })
  if (perm === 'granted') return meta.handle
  const req = await meta.handle.requestPermission({ mode: 'readwrite' })
  return req === 'granted' ? meta.handle : null
}

export async function syncBackupToFolder(): Promise<void> {
  const handle = await getSyncHandle()
  if (!handle) throw new Error('请先选择同步文件夹')

  const content = await exportBackup()
  const filename = `job-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  const fileHandle = await handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function readLatestBackupFromFolder(): Promise<string | null> {
  const handle = await getSyncHandle()
  if (!handle) return null

  const files: { name: string; handle: FileSystemFileHandle }[] = []
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.startsWith('job-tracker-backup') && entry.name.endsWith('.json')) {
      files.push({ name: entry.name, handle: entry as FileSystemFileHandle })
    }
  }
  if (!files.length) return null
  files.sort((a, b) => b.name.localeCompare(a.name))
  const file = await files[0]!.handle.getFile()
  return file.text()
}
