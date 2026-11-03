import type { WorkoutConfig } from '../workoutConfig'
import type { TimerSnapshot } from './timerEngine'

export const COUNTDOWN_SECONDS = 3

export function getCountdownSeconds(elapsedMilliseconds: number): number {
  return Math.max(0, COUNTDOWN_SECONDS - Math.floor(Math.max(0, elapsedMilliseconds) / 1000))
}

export function getTimerSoundEvent(
  previous: TimerSnapshot,
  current: TimerSnapshot,
  mode: WorkoutConfig['mode'],
): 'round' | 'finish' | null {
  if (previous.status !== 'finished' && current.status === 'finished') return 'finish'

  if (mode === 'emom' && previous.status === 'running' && current.status === 'running' &&
      previous.currentRound !== null && current.currentRound !== null &&
      current.currentRound > previous.currentRound) {
    return 'round'
  }

  return null
}
