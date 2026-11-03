import type { WorkoutConfig } from '../workoutConfig'

export type TimerFrame = {
  displaySeconds: number
  currentRound: number | null
  isComplete: boolean
}

export function getTotalDurationMilliseconds(config: WorkoutConfig): number {
  if (config.mode === 'forTime') return config.timeCapSeconds * 1000
  if (config.mode === 'amrap') return config.durationSeconds * 1000
  return config.rounds * config.intervalSeconds * 1000
}

export function calculateTimerFrame(config: WorkoutConfig, elapsedMilliseconds: number): TimerFrame {
  const totalMilliseconds = getTotalDurationMilliseconds(config)
  const elapsed = Math.min(Math.max(elapsedMilliseconds, 0), totalMilliseconds)
  const isComplete = elapsed >= totalMilliseconds

  if (config.mode === 'forTime') {
    return {
      displaySeconds: Math.floor(elapsed / 1000),
      currentRound: null,
      isComplete,
    }
  }

  if (config.mode === 'amrap') {
    return {
      // Round up so zero is shown only when the duration has actually ended.
      displaySeconds: Math.ceil((totalMilliseconds - elapsed) / 1000),
      currentRound: null,
      isComplete,
    }
  }

  const intervalMilliseconds = config.intervalSeconds * 1000
  if (isComplete) {
    return { displaySeconds: 0, currentRound: config.rounds, isComplete: true }
  }

  // An exact interval boundary starts the next round at its full duration.
  const currentRound = Math.floor(elapsed / intervalMilliseconds) + 1
  const elapsedInRound = elapsed % intervalMilliseconds

  return {
    displaySeconds: Math.ceil((intervalMilliseconds - elapsedInRound) / 1000),
    currentRound,
    isComplete: false,
  }
}
