import { validateWorkoutConfig, type WorkoutConfig } from './workoutConfig'

type ParseResult =
  | { config: WorkoutConfig; error: null }
  | { config: null; error: string }

const invalidLinkMessage = 'This workout link has invalid settings. Ask the coach to create a new link.'

export function serializeWorkoutConfig(config: WorkoutConfig): string {
  const parameters = new URLSearchParams({ mode: config.mode })

  if (config.mode === 'forTime') {
    parameters.set('timeCapSeconds', String(config.timeCapSeconds))
  } else if (config.mode === 'amrap') {
    parameters.set('durationSeconds', String(config.durationSeconds))
  } else {
    parameters.set('rounds', String(config.rounds))
    parameters.set('intervalSeconds', String(config.intervalSeconds))
  }

  return parameters.toString()
}

export function createWorkoutUrl(config: WorkoutConfig, origin: string): string {
  const url = new URL('/timer', origin)
  url.search = serializeWorkoutConfig(config)
  return url.toString()
}

export function parseWorkoutConfig(search: string): ParseResult {
  const parameters = new URLSearchParams(search)
  const mode = parameters.get('mode')
  const expectedKeys = mode === 'forTime'
    ? ['mode', 'timeCapSeconds']
    : mode === 'amrap'
      ? ['mode', 'durationSeconds']
      : mode === 'emom'
        ? ['mode', 'rounds', 'intervalSeconds']
        : null

  // Reject extra or repeated parameters so only the documented workout fields are accepted.
  if (!expectedKeys || [...parameters.keys()].length !== expectedKeys.length ||
      expectedKeys.some((key) => parameters.getAll(key).length !== 1)) {
    return { config: null, error: invalidLinkMessage }
  }

  if (mode === 'emom') {
    const result = validateWorkoutConfig(mode, {
      minutes: '0',
      seconds: '0',
      rounds: parameters.get('rounds') ?? '',
      intervalSeconds: parameters.get('intervalSeconds') ?? '',
    })
    return result.config ? result : { config: null, error: invalidLinkMessage }
  }

  if (mode !== 'forTime' && mode !== 'amrap') {
    return { config: null, error: invalidLinkMessage }
  }

  const secondsKey = mode === 'forTime' ? 'timeCapSeconds' : 'durationSeconds'
  const rawSeconds = parameters.get(secondsKey) ?? ''
  if (!/^\d+$/.test(rawSeconds)) {
    return { config: null, error: invalidLinkMessage }
  }

  const totalSeconds = Number(rawSeconds)
  if (!Number.isSafeInteger(totalSeconds)) {
    return { config: null, error: invalidLinkMessage }
  }

  const result = validateWorkoutConfig(mode, {
    minutes: String(Math.floor(totalSeconds / 60)),
    seconds: String(totalSeconds % 60),
    rounds: '',
    intervalSeconds: '',
  })
  return result.config ? result : { config: null, error: invalidLinkMessage }
}
