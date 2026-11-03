import { useEffect, useState } from 'react'
import type { TimerEngine } from './timerEngine'

export type WakeLockStatus = 'idle' | 'requesting' | 'active' | 'unavailable' | 'released'

export function useScreenWakeLock(engine: TimerEngine, isRunning: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('idle')

  useEffect(() => {
    if (!isRunning) return

    let active = true
    let sentinel: WakeLockSentinel | null = null
    let requestPending = false

    async function requestWakeLock() {
      if (!active || document.visibilityState !== 'visible' || requestPending || sentinel) return
      if (!('wakeLock' in navigator)) {
        setStatus('unavailable')
        return
      }

      requestPending = true
      setStatus('requesting')
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (!active || document.visibilityState !== 'visible' || engine.getSnapshot().status !== 'running') {
          await acquired.release()
          return
        }

        sentinel = acquired
        setStatus('active')
        acquired.addEventListener('release', () => {
          if (sentinel !== acquired) return
          sentinel = null
          if (active) setStatus('released')
        })
      } catch {
        if (active) setStatus('unavailable')
      } finally {
        requestPending = false
      }
    }

    function handleVisibilityChange() {
      // The engine recomputes from performance.now() after delayed browser updates.
      engine.refresh()
      if (document.visibilityState === 'visible') {
        if (engine.getSnapshot().status === 'running') void requestWakeLock()
      } else if (sentinel) {
        const current = sentinel
        sentinel = null
        setStatus('released')
        void current.release().catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    void requestWakeLock()

    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (sentinel) void sentinel.release().catch(() => undefined)
      sentinel = null
    }
  }, [engine, isRunning])

  return isRunning ? status : 'idle'
}
