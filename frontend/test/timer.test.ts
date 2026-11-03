import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateTimerFrame } from '../src/timer/timerCalculations'
import { TimerEngine } from '../src/timer/timerEngine'

class FakeTime {
  nowMilliseconds = 0
  private nextId = 1
  private callbacks = new Map<number, () => void>()

  now = () => this.nowMilliseconds

  setInterval = (callback: () => void): number => {
    const id = this.nextId++
    this.callbacks.set(id, callback)
    return id
  }

  clearInterval = (id: number): void => {
    this.callbacks.delete(id)
  }

  advance(milliseconds: number): void {
    this.nowMilliseconds += milliseconds
    for (const callback of [...this.callbacks.values()]) callback()
  }

  elapseWithoutTick(milliseconds: number): void {
    this.nowMilliseconds += milliseconds
  }

  get activeIntervals(): number {
    return this.callbacks.size
  }
}

test('For Time counts up and caps at its configured duration', () => {
  const config = { mode: 'forTime', timeCapSeconds: 3 } as const

  assert.deepEqual(calculateTimerFrame(config, 0), { displaySeconds: 0, currentRound: null, isComplete: false })
  assert.equal(calculateTimerFrame(config, 999).displaySeconds, 0)
  assert.equal(calculateTimerFrame(config, 1000).displaySeconds, 1)
  assert.deepEqual(calculateTimerFrame(config, 4000), { displaySeconds: 3, currentRound: null, isComplete: true })
})

test('AMRAP counts down and shows zero only at completion', () => {
  const config = { mode: 'amrap', durationSeconds: 2 } as const

  assert.equal(calculateTimerFrame(config, 0).displaySeconds, 2)
  assert.equal(calculateTimerFrame(config, 999).displaySeconds, 2)
  assert.equal(calculateTimerFrame(config, 1000).displaySeconds, 1)
  assert.deepEqual(calculateTimerFrame(config, 2000), { displaySeconds: 0, currentRound: null, isComplete: true })
})

test('EMOM transitions rounds at exact interval boundaries', () => {
  const config = { mode: 'emom', rounds: 3, intervalSeconds: 60 } as const

  assert.deepEqual(calculateTimerFrame(config, 0), { displaySeconds: 60, currentRound: 1, isComplete: false })
  assert.deepEqual(calculateTimerFrame(config, 59999), { displaySeconds: 1, currentRound: 1, isComplete: false })
  assert.deepEqual(calculateTimerFrame(config, 60000), { displaySeconds: 60, currentRound: 2, isComplete: false })
  assert.deepEqual(calculateTimerFrame(config, 120000), { displaySeconds: 60, currentRound: 3, isComplete: false })
  assert.deepEqual(calculateTimerFrame(config, 180000), { displaySeconds: 0, currentRound: 3, isComplete: true })
})

test('pause excludes paused time and resume continues from the saved elapsed time', () => {
  const clock = new FakeTime()
  const timer = new TimerEngine({ mode: 'forTime', timeCapSeconds: 5 }, clock)
  let notifications = 0
  timer.subscribe(() => { notifications += 1 })

  assert.equal(timer.getSnapshot().status, 'idle')
  timer.start()
  timer.start()
  assert.equal(clock.activeIntervals, 1)

  clock.advance(1500)
  assert.equal(timer.getSnapshot().displaySeconds, 1)
  timer.pause()
  assert.equal(timer.getSnapshot().status, 'paused')
  assert.equal(clock.activeIntervals, 0)

  clock.advance(10000)
  timer.refresh()
  assert.equal(timer.getSnapshot().displaySeconds, 1)

  timer.resume()
  timer.resume()
  assert.equal(clock.activeIntervals, 1)
  clock.advance(500)
  assert.equal(timer.getSnapshot().displaySeconds, 2)
  clock.advance(3000)
  assert.deepEqual(timer.getSnapshot(), { status: 'finished', displaySeconds: 5, currentRound: null, isComplete: true })
  assert.equal(clock.activeIntervals, 0)

  timer.reset()
  assert.deepEqual(timer.getSnapshot(), { status: 'idle', displaySeconds: 0, currentRound: null, isComplete: false })
  assert.ok(notifications > 0)
  timer.dispose()
})

test('late scheduler callbacks still use real elapsed time and stop AMRAP', () => {
  const clock = new FakeTime()
  const timer = new TimerEngine({ mode: 'amrap', durationSeconds: 2 }, clock)
  let notifications = 0
  timer.subscribe(() => { notifications += 1 })

  timer.start()
  clock.advance(400)
  assert.equal(notifications, 1)
  clock.advance(2100)
  assert.deepEqual(timer.getSnapshot(), { status: 'finished', displaySeconds: 0, currentRound: null, isComplete: true })
  assert.equal(clock.activeIntervals, 0)
  timer.dispose()
})

test('refresh catches up after rendering was delayed', () => {
  const clock = new FakeTime()
  const timer = new TimerEngine({ mode: 'forTime', timeCapSeconds: 5 }, clock)

  timer.start()
  clock.elapseWithoutTick(4200)
  timer.refresh()
  assert.equal(timer.getSnapshot().displaySeconds, 4)
  clock.elapseWithoutTick(800)
  timer.refresh()
  assert.equal(timer.getSnapshot().status, 'finished')
  assert.equal(clock.activeIntervals, 0)
  timer.dispose()
})

test('EMOM engine advances rounds and stops after the final interval', () => {
  const clock = new FakeTime()
  const timer = new TimerEngine({ mode: 'emom', rounds: 2, intervalSeconds: 5 }, clock)

  timer.start()
  clock.advance(5000)
  assert.deepEqual(timer.getSnapshot(), { status: 'running', displaySeconds: 5, currentRound: 2, isComplete: false })
  clock.advance(5000)
  assert.deepEqual(timer.getSnapshot(), { status: 'finished', displaySeconds: 0, currentRound: 2, isComplete: true })
  assert.equal(clock.activeIntervals, 0)
  timer.reset()
  timer.start()
  timer.dispose()
  assert.equal(clock.activeIntervals, 0)
  clock.advance(5000)
  assert.equal(timer.getSnapshot().status, 'running')
})

test('invalid timer configurations are rejected before scheduling', () => {
  const clock = new FakeTime()
  assert.throws(() => new TimerEngine({ mode: 'amrap', durationSeconds: 0 }, clock))
  assert.throws(() => new TimerEngine({ mode: 'emom', rounds: 2, intervalSeconds: -5 }, clock))
  assert.equal(clock.activeIntervals, 0)
})
