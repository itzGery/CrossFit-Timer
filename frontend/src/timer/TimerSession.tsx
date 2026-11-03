import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { formatDuration, type WorkoutConfig } from '../workoutConfig'
import { TimerAudio } from './TimerAudio'
import { TimerEngine, type TimerStatus } from './timerEngine'
import { COUNTDOWN_SECONDS, getCountdownSeconds, getTimerSoundEvent } from './timerSoundEvents'
import { useScreenWakeLock } from './useScreenWakeLock'

const statusLabels: Record<TimerStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  finished: 'Finished',
}

const primaryButtonClassName = 'min-h-14 flex-1 bg-accent px-5 py-3 text-base font-semibold uppercase tracking-[0.06em] text-paper hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const AUDIO_UNLOCK_TIMEOUT_MILLISECONDS = 1000

function TimerDisplay({ config, engine, audio }: { config: WorkoutConfig; engine: TimerEngine; audio: TimerAudio }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const wakeLockStatus = useScreenWakeLock(engine, snapshot.status === 'running')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(true)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const soundEnabledRef = useRef(soundEnabled)
  const countdownIntervalId = useRef<number | null>(null)
  const startRequestId = useRef(0)
  const startPending = useRef(false)
  const active = useRef(true)
  soundEnabledRef.current = soundEnabled

  useEffect(() => {
    let previous = engine.getSnapshot()
    return engine.subscribe(() => {
      const current = engine.getSnapshot()
      const cue = getTimerSoundEvent(previous, current, config.mode)
      if (soundEnabledRef.current && cue) audio.play(cue)
      previous = current
    })
  }, [audio, config.mode, engine])

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      startRequestId.current += 1
      if (countdownIntervalId.current !== null) window.clearInterval(countdownIntervalId.current)
      audio.silence()
    }
  }, [audio])

  function beginWorkout() {
    if (!countdownEnabled) {
      if (soundEnabledRef.current) audio.play('start')
      engine.start()
      return
    }

    const startedAt = performance.now()
    const requestId = startRequestId.current
    let lastSecond = COUNTDOWN_SECONDS
    setCountdownSeconds(lastSecond)
    if (soundEnabledRef.current) audio.play('countdown')

    countdownIntervalId.current = window.setInterval(() => {
      if (requestId !== startRequestId.current) return
      const currentSecond = getCountdownSeconds(performance.now() - startedAt)
      if (currentSecond === lastSecond) return
      lastSecond = currentSecond

      if (currentSecond === 0) {
        window.clearInterval(countdownIntervalId.current!)
        countdownIntervalId.current = null
        setCountdownSeconds(null)
        if (soundEnabledRef.current) audio.play('start')
        engine.start()
      } else {
        // A late browser update plays only the current beep, never missed beeps.
        setCountdownSeconds(currentSecond)
        if (soundEnabledRef.current) audio.play('countdown')
      }
    }, 50)
  }

  async function handleStart() {
    if (engine.getSnapshot().status !== 'idle' || startPending.current || countdownIntervalId.current !== null) return
    startPending.current = true
    setIsPreparing(true)
    const requestId = ++startRequestId.current

    if (soundEnabledRef.current) {
      // A stalled mobile audio unlock must not prevent the workout from starting.
      let timeoutId: number | undefined
      const unlocked = await Promise.race([
        audio.unlock(),
        new Promise<boolean>((resolve) => {
          timeoutId = window.setTimeout(() => resolve(false), AUDIO_UNLOCK_TIMEOUT_MILLISECONDS)
        }),
      ])
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      if (requestId !== startRequestId.current) return
      setAudioError(unlocked ? null : 'Sound is unavailable in this browser. The timer will continue silently.')
    }

    if (requestId !== startRequestId.current) return
    startPending.current = false
    setIsPreparing(false)
    beginWorkout()
  }

  async function handleSoundToggle() {
    if (soundEnabled) {
      soundEnabledRef.current = false
      setSoundEnabled(false)
      setAudioError(null)
      audio.silence()
      return
    }

    const requestId = startRequestId.current
    const unlocked = await audio.unlock()
    if (!active.current || requestId !== startRequestId.current) return
    if (unlocked) {
      soundEnabledRef.current = true
      setSoundEnabled(true)
      setAudioError(null)
    } else {
      setAudioError('Sound is unavailable in this browser.')
    }
  }

  function handleReset() {
    startRequestId.current += 1
    startPending.current = false
    setIsPreparing(false)
    if (countdownIntervalId.current !== null) window.clearInterval(countdownIntervalId.current)
    countdownIntervalId.current = null
    setCountdownSeconds(null)
    audio.silence()
    engine.reset()
  }

  function handleResume() {
    if (soundEnabledRef.current) void audio.unlock()
    engine.resume()
  }

  const timeLabel = countdownSeconds !== null
    ? 'Starting in'
    : config.mode === 'forTime' ? 'Elapsed time' : config.mode === 'amrap' ? 'Time remaining' : 'Interval remaining'
  const modeLabel = config.mode === 'forTime' ? 'For Time' : config.mode.toUpperCase()
  const detail = config.mode === 'forTime'
    ? `Time cap ${formatDuration(config.timeCapSeconds)}`
    : config.mode === 'amrap'
      ? `Workout duration ${formatDuration(config.durationSeconds)}`
      : `${formatDuration(config.intervalSeconds)} intervals`
  const totalSeconds = config.mode === 'forTime'
    ? config.timeCapSeconds
    : config.mode === 'amrap' ? config.durationSeconds : config.rounds * config.intervalSeconds
  // EMOM progress combines completed rounds with elapsed time in the current interval.
  const elapsedSeconds = config.mode === 'forTime'
    ? snapshot.displaySeconds
    : config.mode === 'amrap'
      ? totalSeconds - snapshot.displaySeconds
      : ((snapshot.currentRound ?? 1) - 1) * config.intervalSeconds +
        (config.intervalSeconds - snapshot.displaySeconds)
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))

  return (
    <section aria-label={`${modeLabel} workout timer`} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <div className="flex w-full max-w-xs items-center gap-3"><span className="h-px flex-1 bg-accent" aria-hidden="true" /><h1 className="font-display text-2xl font-bold uppercase tracking-[0.08em] text-accent sm:text-3xl">{modeLabel}</h1><span className="h-px flex-1 bg-accent" aria-hidden="true" /></div>
        {config.mode === 'emom' && (
          <p className="mt-3 font-display text-2xl font-bold uppercase tracking-[0.04em] text-paper sm:text-3xl landscape:mt-1" aria-label={`Round ${snapshot.currentRound} of ${config.rounds}`}>
            Round <span className="text-accent">{snapshot.currentRound}</span> / {config.rounds}
          </p>
        )}
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted landscape:mt-1">{timeLabel}</p>
        <p role="timer" aria-live="off" aria-label={`${timeLabel}: ${countdownSeconds ?? formatDuration(snapshot.displaySeconds)}`} className="timer-digits w-full whitespace-nowrap text-[clamp(5rem,24vw,21rem)] font-extrabold text-paper landscape:text-[clamp(5rem,31vh,16rem)]">
          {countdownSeconds ?? formatDuration(snapshot.displaySeconds)}
        </p>
        <p role="status" className={`mt-3 font-display text-lg font-bold uppercase tracking-[0.08em] landscape:mt-1 ${snapshot.status === 'finished' ? 'text-accent' : snapshot.status === 'paused' ? 'text-amber-300' : 'text-muted'}`}>
          {countdownSeconds !== null ? 'Get ready' : statusLabels[snapshot.status]}
        </p>
        <p className="mt-3 text-xs text-muted landscape:hidden">{detail}</p>
      </div>

      <div role="progressbar" aria-label="Workout progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)} className="mx-auto mb-3 h-1 w-full max-w-2xl bg-rule landscape:mb-1">
        <div className="h-full bg-accent" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] landscape:py-1">
        <label className="flex min-h-10 items-center gap-2 text-muted">
          <input type="checkbox" checked={countdownEnabled} onChange={(event) => setCountdownEnabled(event.target.checked)} disabled={snapshot.status !== 'idle' || isPreparing || countdownSeconds !== null} className="size-4 accent-accent" />
          3-second countdown
        </label>
        <button type="button" aria-pressed={soundEnabled} onClick={() => void handleSoundToggle()} className="min-h-10 border-b border-rule px-1 py-2 text-paper hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Sound {soundEnabled ? 'on' : 'off'}
        </button>
      </div>
      {audioError && <p role="alert" className="mb-2 text-center text-sm text-amber-300">{audioError}</p>}
      {(wakeLockStatus === 'unavailable' || wakeLockStatus === 'released') && (
        <p role="status" className="mb-2 text-center text-sm text-amber-300">
          Screen wake protection is unavailable. Keep the phone active or adjust its screen timeout settings.
        </p>
      )}

      <div className="mx-auto flex w-full max-w-2xl gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:gap-3">
        {snapshot.status === 'idle' && <button type="button" onClick={() => void handleStart()} disabled={isPreparing || countdownSeconds !== null} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}>{isPreparing ? 'Preparing…' : countdownSeconds !== null ? 'Starting…' : 'Start'}</button>}
        {snapshot.status === 'running' && <button type="button" onClick={() => engine.pause()} className={primaryButtonClassName}>Pause</button>}
        {snapshot.status === 'paused' && <button type="button" onClick={handleResume} className={primaryButtonClassName}>Resume</button>}
        <button type="button" onClick={handleReset} disabled={snapshot.status === 'idle' && !isPreparing && countdownSeconds === null} className="min-h-14 flex-1 border border-rule px-5 py-3 text-base font-semibold uppercase tracking-[0.06em] text-paper hover:border-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40">
          Reset
        </button>
      </div>
    </section>
  )
}

export default function TimerSession({ config }: { config: WorkoutConfig }) {
  const [session, setSession] = useState<{ engine: TimerEngine; audio: TimerAudio } | null>(null)

  useEffect(() => {
    const engine = new TimerEngine(config)
    const audio = new TimerAudio()
    setSession({ engine, audio })

    return () => {
      engine.dispose()
      audio.dispose()
    }
  }, [config])

  if (!session) {
    return <p role="status" className="flex flex-1 items-center justify-center text-center text-muted">Preparing timer…</p>
  }

  return <TimerDisplay config={config} engine={session.engine} audio={session.audio} />
}
