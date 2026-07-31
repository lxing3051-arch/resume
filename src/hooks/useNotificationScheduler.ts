import { useEffect } from 'react'
import { checkAndNotify } from '../utils/notifications'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

export function useNotificationScheduler() {
  useEffect(() => {
    void checkAndNotify()
    const timer = window.setInterval(() => void checkAndNotify(), CHECK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])
}
