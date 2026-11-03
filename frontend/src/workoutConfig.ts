export type WorkoutConfig =
  | { mode: 'forTime'; timeCapSeconds: number }
  | { mode: 'amrap'; durationSeconds: number }
  | { mode: 'emom'; rounds: number; intervalSeconds: number }

export type WorkoutMode = WorkoutConfig['mode']

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type WorkoutFormValues = {
  minutes: string
  seconds: string
  rounds: string
  intervalSeconds: string
}

type ValidationResult =
  | { config: WorkoutConfig; error: null }
  | { config: null; error: string }

const MAX_DURATION_SECONDS = 120 * 60
const MAX_MINUTES = 120
const MAX_SECONDS = 59
const MAX_ROUNDS = 100
const MAX_INTERVAL_SECONDS = 600

function parseWholeNumber(value: string, minimum: number, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null

  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null
}

export function validateWorkoutConfig(mode: WorkoutMode, values: WorkoutFormValues): ValidationResult {
  if (mode === 'emom') {
    const rounds = parseWholeNumber(values.rounds, 1, MAX_ROUNDS)
    const intervalSeconds = parseWholeNumber(values.intervalSeconds, 1, MAX_INTERVAL_SECONDS)

    if (rounds === null || intervalSeconds === null) {
      return { config: null, error: 'Enter 1–100 whole rounds and an interval of 1–600 whole seconds.' }
    }

    // The total EMOM length must fit the same two-hour workout limit.
    if (rounds * intervalSeconds > MAX_DURATION_SECONDS) {
      return { config: null, error: 'Total EMOM duration cannot exceed 120 minutes.' }
    }

    return { config: { mode, rounds, intervalSeconds }, error: null }
  }

  const minutes = parseWholeNumber(values.minutes, 0, MAX_MINUTES)
  const seconds = parseWholeNumber(values.seconds, 0, MAX_SECONDS)

  if (minutes === null || seconds === null) {
    return { config: null, error: 'Enter whole minutes from 0–120 and whole seconds from 0–59.' }
  }

  const durationSeconds = minutes * 60 + seconds
  if (durationSeconds < 1 || durationSeconds > MAX_DURATION_SECONDS) {
    return { config: null, error: 'Duration must be between 1 second and 120 minutes.' }
  }

  if (mode === 'forTime') {
    return { config: { mode, timeCapSeconds: durationSeconds }, error: null }
  }

  return { config: { mode, durationSeconds }, error: null }
}
