export type SoundCue = 'countdown' | 'start' | 'round' | 'finish'

type Tone = {
  frequency: number
  offsetSeconds: number
  durationSeconds: number
}

const cueTones: Record<SoundCue, Tone[]> = {
  countdown: [{ frequency: 660, offsetSeconds: 0, durationSeconds: 0.12 }],
  start: [
    { frequency: 880, offsetSeconds: 0, durationSeconds: 0.12 },
    { frequency: 1100, offsetSeconds: 0.15, durationSeconds: 0.25 },
  ],
  round: [
    { frequency: 740, offsetSeconds: 0, durationSeconds: 0.1 },
    { frequency: 740, offsetSeconds: 0.15, durationSeconds: 0.1 },
  ],
  finish: [
    { frequency: 1047, offsetSeconds: 0, durationSeconds: 0.18 },
    { frequency: 784, offsetSeconds: 0.2, durationSeconds: 0.18 },
    { frequency: 523, offsetSeconds: 0.4, durationSeconds: 0.3 },
  ],
}

type ActiveTone = { oscillator: OscillatorNode; gain: GainNode }

export class TimerAudio {
  private context: AudioContext | null = null
  private readonly activeTones = new Set<ActiveTone>()
  private disposed = false

  async unlock(): Promise<boolean> {
    if (this.disposed || typeof AudioContext === 'undefined') return false

    try {
      // Create and resume inside a button handler to satisfy mobile autoplay rules.
      this.context ??= new AudioContext()
      const context = this.context
      if (context.state !== 'running') await context.resume()
      return !this.disposed && this.context === context && context.state === 'running'
    } catch {
      return false
    }
  }

  play(cue: SoundCue): void {
    const context = this.context
    if (this.disposed || !context || context.state !== 'running') return

    try {
      for (const tone of cueTones[cue]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const activeTone = { oscillator, gain }
        const startsAt = context.currentTime + tone.offsetSeconds
        const endsAt = startsAt + tone.durationSeconds

        oscillator.type = cue === 'finish' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(tone.frequency, startsAt)
        gain.gain.setValueAtTime(0.0001, startsAt)
        gain.gain.exponentialRampToValueAtTime(0.2, startsAt + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, endsAt)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
          this.activeTones.delete(activeTone)
        }
        this.activeTones.add(activeTone)
        oscillator.start(startsAt)
        oscillator.stop(endsAt)
      }
    } catch {
      // Audio device failures must not interrupt the workout timer.
      this.silence()
    }
  }

  silence(): void {
    for (const { oscillator, gain } of this.activeTones) {
      oscillator.onended = null
      try {
        oscillator.stop()
      } catch {
        // A tone may already have stopped before its end event runs.
      }
      oscillator.disconnect()
      gain.disconnect()
    }
    this.activeTones.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.silence()
    const context = this.context
    this.context = null
    if (context) void context.close().catch(() => undefined)
  }
}
