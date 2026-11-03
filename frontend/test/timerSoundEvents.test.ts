import assert from 'node:assert/strict'
import test from 'node:test'
import { getCountdownSeconds, getTimerSoundEvent } from '../src/timer/timerSoundEvents'
import type { TimerSnapshot } from '../src/timer/timerEngine'

function snapshot(status: TimerSnapshot['status'], currentRound: number | null): TimerSnapshot {
  return { status, currentRound, displaySeconds: 5, isComplete: status === 'finished' }
}

test('countdown derives its current second from elapsed time', () => {
  assert.equal(getCountdownSeconds(0), 3)
  assert.equal(getCountdownSeconds(999), 3)
  assert.equal(getCountdownSeconds(1000), 2)
  assert.equal(getCountdownSeconds(2000), 1)
  assert.equal(getCountdownSeconds(3000), 0)
  assert.equal(getCountdownSeconds(5500), 0)
})

test('EMOM round cue occurs once on a forward running transition', () => {
  const first = snapshot('running', 1)
  const second = snapshot('running', 2)
  assert.equal(getTimerSoundEvent(first, second, 'emom'), 'round')
  assert.equal(getTimerSoundEvent(second, second, 'emom'), null)
  assert.equal(getTimerSoundEvent(snapshot('paused', 1), second, 'emom'), null)
  assert.equal(getTimerSoundEvent(first, second, 'amrap'), null)
  // A delayed update skips missed rounds instead of queuing one cue per round.
  assert.equal(getTimerSoundEvent(first, snapshot('running', 4), 'emom'), 'round')
})

test('finish cue occurs only when entering the finished state', () => {
  const running = snapshot('running', 2)
  const finished = snapshot('finished', 2)
  assert.equal(getTimerSoundEvent(running, finished, 'emom'), 'finish')
  assert.equal(getTimerSoundEvent(finished, finished, 'emom'), null)
  assert.equal(getTimerSoundEvent(snapshot('idle', null), snapshot('running', 1), 'emom'), null)
})
