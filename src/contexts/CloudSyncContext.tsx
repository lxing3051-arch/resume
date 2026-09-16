import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { exportBackup, importBackup } from '../utils/backup'
import { supabase } from '../utils/supabase'

type SyncStatus = '未登录' | '正在同步' | '已同步' | '需要选择' | '同步失败'

interface CloudSyncValue {
  session: Session | null
  status: SyncStatus
  message: string
  lastSyncedAt?: string
  signIn: (email: string, password: string) => Promise<string>
  signUp: (email: string, password: string) => Promise<string>
  signOut: () => Promise<void>
  uploadLocal: () => Promise<void>
  restoreCloud: () => Promise<void>
}

const CloudSyncContext = createContext<CloudSyncValue | null>(null)
const LAST_HASH = 'job-tracker-cloud-last-hash'
const LAST_USER = 'job-tracker-cloud-user'

function stableSnapshot(json: string) {
  const payload = JSON.parse(json) as Record<string, unknown>
  delete payload.exportedAt
  return payload
}

function snapshotHash(payload: unknown) {
  return JSON.stringify(payload)
}

function hasLocalData(payload: Record<string, unknown>) {
  return ['companies', 'stages', 'resumes', 'interviewNotes', 'projects'].some(
    (key) => Array.isArray(payload[key]) && payload[key].length > 0,
  )
}

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SyncStatus>('未登录')
  const [message, setMessage] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<string>()
  const busy = useRef(false)

  const uploadLocal = useCallback(async () => {
    const current = (await supabase.auth.getSession()).data.session
    if (!current || busy.current) return
    busy.current = true
    setStatus('正在同步')
    try {
      const payload = stableSnapshot(await exportBackup())
      const { error } = await supabase.from('user_backups').upsert({
        user_id: current.user.id,
        payload,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      localStorage.setItem(LAST_USER, current.user.id)
      localStorage.setItem(LAST_HASH, snapshotHash(payload))
      setLastSyncedAt(new Date().toISOString())
      setStatus('已同步')
      setMessage('本地数据已保存到云端')
    } catch (error) {
      setStatus('同步失败')
      setMessage(error instanceof Error ? error.message : '云端同步失败')
    } finally {
      busy.current = false
    }
  }, [])

  const restoreCloud = useCallback(async () => {
    const current = (await supabase.auth.getSession()).data.session
    if (!current || busy.current) return
    busy.current = true
    setStatus('正在同步')
    try {
      const { data, error } = await supabase
        .from('user_backups')
        .select('payload, updated_at')
        .eq('user_id', current.user.id)
        .maybeSingle()
      if (error) throw error
      if (!data?.payload) {
        setMessage('云端还没有数据，已保留当前浏览器数据')
        setStatus('已同步')
        return
      }
      const payload = data.payload as Record<string, unknown>
      await importBackup(JSON.stringify({ ...payload, exportedAt: data.updated_at }))
      localStorage.setItem(LAST_USER, current.user.id)
      localStorage.setItem(LAST_HASH, snapshotHash(payload))
      setLastSyncedAt(data.updated_at)
      setStatus('已同步')
      setMessage('已从云端恢复数据')
    } catch (error) {
      setStatus('同步失败')
      setMessage(error instanceof Error ? error.message : '云端恢复失败')
    } finally {
      busy.current = false
    }
  }, [])

  const syncAfterLogin = useCallback(async (current: Session) => {
    if (busy.current) return
    busy.current = true
    setStatus('正在同步')
    try {
      const localPayload = stableSnapshot(await exportBackup())
      const localHash = snapshotHash(localPayload)
      const { data, error } = await supabase
        .from('user_backups')
        .select('payload, updated_at')
        .eq('user_id', current.user.id)
        .maybeSingle()
      if (error) throw error
      if (!data?.payload) {
        const { error: uploadError } = await supabase.from('user_backups').insert({
          user_id: current.user.id,
          payload: localPayload,
          updated_at: new Date().toISOString(),
        })
        if (uploadError) throw uploadError
        localStorage.setItem(LAST_USER, current.user.id)
        localStorage.setItem(LAST_HASH, localHash)
        setStatus('已同步')
        setMessage('首次登录：当前浏览器数据已上传云端')
        return
      }
      const cloudPayload = data.payload as Record<string, unknown>
      const cloudHash = snapshotHash(cloudPayload)
      const knownUser = localStorage.getItem(LAST_USER) === current.user.id
      const lastHash = localStorage.getItem(LAST_HASH)
      if (!knownUser && hasLocalData(localPayload) && localHash !== cloudHash) {
        setStatus('需要选择')
        setMessage('当前浏览器和云端都有数据，请选择保留哪一份')
        return
      }
      if (!knownUser || localHash === lastHash) {
        await importBackup(JSON.stringify({ ...cloudPayload, exportedAt: data.updated_at }))
        localStorage.setItem(LAST_USER, current.user.id)
        localStorage.setItem(LAST_HASH, cloudHash)
        setLastSyncedAt(data.updated_at)
        setStatus('已同步')
        setMessage('已载入云端数据')
      } else {
        setStatus('已同步')
        setMessage('检测到本地更新，将自动上传')
      }
    } catch (error) {
      setStatus('同步失败')
      setMessage(error instanceof Error ? error.message : '云端同步失败')
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setStatus('未登录')
      return
    }
    void syncAfterLogin(session)
  }, [session, syncAfterLogin])

  useEffect(() => {
    if (!session || status === '需要选择') return
    const timer = window.setInterval(async () => {
      if (busy.current) return
      const payload = stableSnapshot(await exportBackup())
      if (snapshotHash(payload) !== localStorage.getItem(LAST_HASH)) void uploadLocal()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [session, status, uploadLocal])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : '登录成功，正在同步数据'
  }

  async function signUp(email: string, password: string) {
    const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    })
    if (error) return error.message
    return data.session ? '注册并登录成功' : '注册成功，请查收验证邮件后登录'
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setMessage('已退出登录，本地数据仍保留')
  }

  return (
    <CloudSyncContext.Provider
      value={{ session, status, message, lastSyncedAt, signIn, signUp, signOut, uploadLocal, restoreCloud }}
    >
      {children}
    </CloudSyncContext.Provider>
  )
}

export function useCloudSync() {
  const value = useContext(CloudSyncContext)
  if (!value) throw new Error('useCloudSync must be used inside CloudSyncProvider')
  return value
}
