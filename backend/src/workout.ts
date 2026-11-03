type WorkoutConfig =
  | { mode: 'forTime'; timeCapSeconds: number }
  | { mode: 'amrap'; durationSeconds: number }
  | { mode: 'emom'; rounds: number; intervalSeconds: number }

function isWholeNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

export function parseWorkoutConfig(value: unknown): WorkoutConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>

  if (data.mode === 'forTime' && Object.keys(data).length === 2 &&
      isWholeNumberInRange(data.timeCapSeconds, 1, 7200)) {
    return { mode: 'forTime', timeCapSeconds: data.timeCapSeconds }
  }
  if (data.mode === 'amrap' && Object.keys(data).length === 2 &&
      isWholeNumberInRange(data.durationSeconds, 1, 7200)) {
    return { mode: 'amrap', durationSeconds: data.durationSeconds }
  }
  if (data.mode === 'emom' && Object.keys(data).length === 3 &&
      isWholeNumberInRange(data.rounds, 1, 100) &&
      isWholeNumberInRange(data.intervalSeconds, 1, 600) &&
      data.rounds * data.intervalSeconds <= 7200) {
    return { mode: 'emom', rounds: data.rounds, intervalSeconds: data.intervalSeconds }
  }
  return null
}

export function workoutPath(config: WorkoutConfig): string {
  const query = new URLSearchParams({ mode: config.mode })
  if (config.mode === 'forTime') query.set('timeCapSeconds', String(config.timeCapSeconds))
  if (config.mode === 'amrap') query.set('durationSeconds', String(config.durationSeconds))
  if (config.mode === 'emom') {
    query.set('rounds', String(config.rounds))
    query.set('intervalSeconds', String(config.intervalSeconds))
  }
  return `/timer?${query.toString()}`
}
