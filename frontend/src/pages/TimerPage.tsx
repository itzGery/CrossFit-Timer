import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import TimerSession from '../timer/TimerSession'
import { parseWorkoutConfig } from '../workoutUrl'
import BrandMark from '../BrandMark'

function TimerPage() {
  const { search } = useLocation()
  const parsedWorkout = useMemo(() => search ? parseWorkoutConfig(search) : null, [search])
  const workoutConfig = parsedWorkout?.config
  const timerRoot = useRef<HTMLElement | null>(null)
  const [fullscreenSupported] = useState(() => typeof document !== 'undefined' && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === timerRoot.current)
      setFullscreenError(null)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function handleFullscreen() {
    const element = timerRoot.current
    if (!element || !fullscreenSupported) return

    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen()
      } else {
        // Fullscreen requests must run directly from the button interaction.
        await element.requestFullscreen()
      }
    } catch {
      setFullscreenError('Fullscreen was blocked. Use your browser display controls if available.')
    }
  }

  return (
    <main ref={timerRoot} className="flex min-h-svh flex-col bg-ink px-4 py-3 text-paper sm:px-8 sm:py-5 landscape:py-2">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2 sm:pb-3 landscape:pb-1">
        <p className="flex items-center gap-2 font-display text-xl font-bold text-paper"><BrandMark className="h-5 w-8" />CrossFit Timer</p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => void handleFullscreen()} disabled={!fullscreenSupported} aria-pressed={isFullscreen} className="min-h-10 text-xs font-semibold uppercase tracking-[0.06em] text-muted hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
            {fullscreenSupported ? isFullscreen ? 'Exit fullscreen' : 'Fullscreen' : 'Fullscreen unavailable'}
          </button>
          <Link to="/dashboard" className="min-h-10 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Setup
          </Link>
        </div>
      </header>
      {fullscreenError && <p role="alert" className="mt-2 text-sm text-amber-300">{fullscreenError}</p>}

      {parsedWorkout?.error ? (
        <section role="alert" className="my-auto mx-auto w-full max-w-xl border-t-4 border-red-400 py-8">
          <h1 className="text-2xl font-bold text-paper">Invalid workout link</h1>
          <p className="mt-3 text-red-100">{parsedWorkout.error}</p>
        </section>
      ) : workoutConfig ? (
        <TimerSession key={search} config={workoutConfig} />
      ) : (
        <section className="my-auto mx-auto w-full max-w-xl border-t-4 border-accent py-8">
          <h1 className="text-2xl font-bold text-paper">No workout loaded</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">Create a workout on the dashboard and open its share link to view it here.</p>
        </section>
      )}
    </main>
  )
}

export default TimerPage
