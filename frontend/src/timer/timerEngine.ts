import type { WorkoutConfig } from '../workoutConfig'
import { calculateTimerFrame, getTotalDurationMilliseconds, type TimerFrame } from './timerCalculations'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'
export type TimerSnapshot = TimerFrame & { status: TimerStatus }

type TimerListener = () => void

type TimerDependencies = {
  now: () => number
  setInterval: (callback: () => void, delayMilliseconds: number) => number
  clearInterval: (intervalId: number) => void
}

const defaultDependencies: TimerDependencies = {
  now: () => performance.now(),
  setInterval: (callback, delayMilliseconds) => window.setInterval(callback, delayMilliseconds),
  clearInterval: (intervalId) => window.clearInterval(intervalId),
}

const UPDATE_INTERVAL_MILLISECONDS = 100

export class TimerEngine {
  private status: TimerStatus = 'idle'
  private elapsedBeforeRunMilliseconds = 0
  private runStartedAtMilliseconds = 0
  private intervalId: number | null = null
  private disposed = false
  private readonly listeners = new Set<TimerListener>()
  private snapshot: TimerSnapshot

  constructor(
    private readonly config: WorkoutConfig,
    private readonly dependencies: TimerDependencies = defaultDependencies,
  ) {
    const values = config.mode === 'emom'
      ? [config.rounds, config.intervalSeconds]
      : [config.mode === 'forTime' ? config.timeCapSeconds : config.durationSeconds]

    const totalMilliseconds = getTotalDurationMilliseconds(config)
    if (values.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
        !Number.isSafeInteger(totalMilliseconds) || totalMilliseconds <= 0) {
      throw new Error('Timer configuration must contain positive whole numbers')
    }

    this.snapshot = { ...calculateTimerFrame(config, 0), status: 'idle' }
  }

  getSnapshot = (): TimerSnapshot => this.snapshot

  subscribe = (listener: TimerListener): (() => void) => {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.disposed || this.status !== 'idle') return

    this.status = 'running'
    this.runStartedAtMilliseconds = this.dependencies.now()
    this.startTicker()
    this.refresh()
  }

  pause(): void {
    if (this.disposed || this.status !== 'running') return

    const now = this.dependencies.now()
    // Only the current run is added; time spent paused is never included.
    this.elapsedBeforeRunMilliseconds += Math.max(0, now - this.runStartedAtMilliseconds)
    this.status = this.elapsedBeforeRunMilliseconds >= getTotalDurationMilliseconds(this.config)
      ? 'finished'
      : 'paused'
    this.stopTicker()
    this.publish(now)
  }

  resume(): void {
    if (this.disposed || this.status !== 'paused') return

    this.runStartedAtMilliseconds = this.dependencies.now()
    this.status = 'running'
    this.startTicker()
    this.refresh()
  }

  reset(): void {
    if (this.disposed) return

    this.stopTicker()
    this.status = 'idle'
    this.elapsedBeforeRunMilliseconds = 0
    this.runStartedAtMilliseconds = 0
    this.publish(this.dependencies.now())
  }

  refresh(): void {
    if (this.disposed) return
    this.publish(this.dependencies.now())
  }

  dispose(): void {
    if (this.disposed) return
    this.stopTicker()
    this.listeners.clear()
    this.disposed = true
  }

  private startTicker(): void {
    if (this.intervalId !== null) return
    this.intervalId = this.dependencies.setInterval(() => this.refresh(), UPDATE_INTERVAL_MILLISECONDS)
  }

  private stopTicker(): void {
    if (this.intervalId === null) return
    this.dependencies.clearInterval(this.intervalId)
    this.intervalId = null
  }

  private publish(now: number): void {
    const elapsed = this.status === 'running'
      ? this.elapsedBeforeRunMilliseconds + Math.max(0, now - this.runStartedAtMilliseconds)
      : this.elapsedBeforeRunMilliseconds
    const frame = calculateTimerFrame(this.config, elapsed)

    if (this.status === 'running' && frame.isComplete) {
      this.status = 'finished'
      this.elapsedBeforeRunMilliseconds = getTotalDurationMilliseconds(this.config)
      this.stopTicker()
    }

    const nextSnapshot: TimerSnapshot = { ...frame, status: this.status }
    if (nextSnapshot.status === this.snapshot.status &&
        nextSnapshot.displaySeconds === this.snapshot.displaySeconds &&
        nextSnapshot.currentRound === this.snapshot.currentRound) {
      return
    }

    this.snapshot = nextSnapshot
    this.listeners.forEach((listener) => listener())
  }
}
