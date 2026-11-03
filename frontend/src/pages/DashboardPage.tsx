import { useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatDuration, validateWorkoutConfig, type WorkoutConfig, type WorkoutMode } from '../workoutConfig'

const inputClassName = 'mt-2 w-full min-h-12 border border-rule bg-panel px-4 py-2.5 text-base font-semibold tabular-nums text-paper outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function DashboardPage() {
  const [mode, setMode] = useState<WorkoutMode>('forTime')
  // Strings preserve empty input while the coach edits a field.
  const [minutes, setMinutes] = useState('10')
  const [seconds, setSeconds] = useState('0')
  const [rounds, setRounds] = useState('10')
  const [intervalSeconds, setIntervalSeconds] = useState('60')
  const [workoutConfig, setWorkoutConfig] = useState<WorkoutConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const isLocalAddress = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateWorkoutConfig(mode, { minutes, seconds, rounds, intervalSeconds })
    setWorkoutConfig(null)
    setShareUrl(null)
    setError(result.error)
    setCopyStatus(null)
    if (!result.config) return

    setCreating(true)
    try {
      const response = await fetch('/api/workouts/share', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.config),
      })
      const data: { path?: string; error?: string } = await response.json()
      if (!response.ok || !data.path) throw new Error(data.error ?? 'Could not create workout.')
      const url = new URL(data.path, window.location.origin)
      if (url.origin !== window.location.origin || url.pathname !== '/timer') throw new Error('Invalid workout link returned by the server.')
      setWorkoutConfig(result.config)
      setShareUrl(url.toString())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create workout.')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyStatus('Link copied to clipboard.')
    } catch {
      setCopyStatus('Could not copy automatically. Select and copy the link below.')
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b border-rule pb-8">
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-paper sm:text-5xl">Create a workout</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Choose a workout format and set the clock for your session.</p>
      </header>

      <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,1fr)] lg:gap-12">
        <form noValidate onSubmit={handleSubmit}>
          <fieldset>
            <legend className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">01 / Workout mode</legend>
            <div className="mt-5 grid grid-cols-3 border-y border-rule">
              {([
                { value: 'forTime', label: 'For Time' },
                { value: 'amrap', label: 'AMRAP' },
                { value: 'emom', label: 'EMOM' },
              ] as const).map((option) => (
                <label key={option.value} className={`flex min-h-14 cursor-pointer items-center justify-center border-r border-rule px-2 py-3 text-center font-display text-lg font-bold uppercase tracking-[0.04em] last:border-r-0 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent sm:text-xl ${mode === option.value ? 'bg-accent text-paper' : 'bg-panel text-muted hover:text-paper'}`}>
                  <input
                    type="radio"
                    name="workoutMode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => {
                      setMode(option.value)
                      setWorkoutConfig(null)
                      setShareUrl(null)
                      setError(null)
                      setCopyStatus(null)
                    }}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'emom' ? (
            <fieldset className="mt-10">
              <legend className="font-display text-lg font-bold uppercase tracking-[0.04em] text-paper">EMOM <span className="font-body text-sm font-normal normal-case tracking-normal text-muted">(Every Minute on the Minute)</span></legend>
              <p className="mt-3 text-sm text-muted">1–100 rounds. Intervals of 1–600 seconds, up to 120 minutes total.</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-paper">
                  Rounds
                  <input type="number" inputMode="numeric" min="1" max="100" step="1" value={rounds} onChange={(event) => setRounds(event.target.value)} className={inputClassName} />
                </label>
                <label className="block text-sm font-semibold text-paper">
                  Interval (seconds)
                  <input type="number" inputMode="numeric" min="1" max="600" step="1" value={intervalSeconds} onChange={(event) => setIntervalSeconds(event.target.value)} className={inputClassName} />
                </label>
              </div>
            </fieldset>
          ) : (
            <fieldset className="mt-10">
              <legend className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">02 / {mode === 'forTime' ? 'Time cap' : 'Workout duration'}</legend>
              <p className="mt-3 text-sm text-muted">
                {mode === 'forTime' ? 'The timer will count up from zero.' : 'The timer will count down to zero.'} Set 1 second to 120 minutes.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-paper">
                  Minutes
                  <input type="number" inputMode="numeric" min="0" max="120" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} className={inputClassName} />
                </label>
                <label className="block text-sm font-semibold text-paper">
                  Seconds
                  <input type="number" inputMode="numeric" min="0" max="59" step="1" value={seconds} onChange={(event) => setSeconds(event.target.value)} className={inputClassName} />
                </label>
              </div>
            </fieldset>
          )}

          {error && <p role="alert" className="mt-8 border-l-2 border-red-400 pl-4 text-sm text-red-200">{error}</p>}
          <button type="submit" disabled={creating} className="mt-10 min-h-14 w-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-[0.06em] text-paper hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 sm:w-auto">
            {creating ? 'Creating…' : 'Create Workout'}
          </button>
        </form>

        <section aria-labelledby="summary-heading" aria-live="polite" className="h-fit border-t border-rule pt-7 lg:min-h-96 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
          {workoutConfig && <p className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-[0.08em] text-success"><span className="size-2 rounded-full bg-success" aria-hidden="true" />Ready to share</p>}
          <h2 id="summary-heading" className={`${workoutConfig ? 'mt-4' : ''} text-2xl font-bold text-paper`}>{workoutConfig ? 'Workout Created' : 'Workout preview'}</h2>
          {workoutConfig ? (
            <dl className="mt-6 space-y-4 text-sm">
              <div className="border-t border-rule pt-3">
                <dt className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">Mode</dt>
                <dd className="mt-1 font-display text-3xl font-extrabold text-paper">{workoutConfig.mode === 'forTime' ? 'For Time' : workoutConfig.mode.toUpperCase()}</dd>
              </div>
              {workoutConfig.mode === 'emom' ? (
                <>
                  <div className="border-t border-rule pt-3"><dt className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">Rounds</dt><dd className="mt-1 font-display text-3xl font-bold tabular-nums text-paper">{workoutConfig.rounds}</dd></div>
                  <div className="border-t border-rule pt-3"><dt className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">Interval</dt><dd className="mt-1 font-display text-3xl font-bold tabular-nums text-paper">{formatDuration(workoutConfig.intervalSeconds)}</dd></div>
                </>
              ) : (
                <div className="border-t border-rule pt-3">
                  <dt className="font-display text-base font-bold uppercase tracking-[0.08em] text-muted">{workoutConfig.mode === 'forTime' ? 'Time cap' : 'Duration'}</dt>
                  <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-paper">
                    {formatDuration(workoutConfig.mode === 'forTime' ? workoutConfig.timeCapSeconds : workoutConfig.durationSeconds)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-6 border-t border-rule pt-4 text-sm leading-6 text-muted">The workout details and sharing link will appear here.</p>
          )}

          {shareUrl && (
            <div className="mt-8 border-t border-rule pt-6">
              <h3 className="text-2xl font-bold text-paper">Share this workout</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Open the link on your timer phone, or scan the code below.</p>
              <label htmlFor="share-link" className="mt-5 block text-sm font-semibold text-paper">Workout link</label>
              <input id="share-link" type="text" readOnly value={shareUrl} onFocus={(event) => event.target.select()} className={inputClassName} />
              <button type="button" onClick={handleCopyLink} className="mt-4 min-h-11 border border-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-paper hover:bg-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Copy Link
              </button>
              {copyStatus && <p role="status" className="mt-3 text-sm text-paper">{copyStatus}</p>}
              <div className="mt-6 inline-block bg-white p-4">
                <QRCodeSVG value={shareUrl} size={192} marginSize={0} title="Scan to open this workout" />
              </div>
              {isLocalAddress && (
                <p className="mt-4 text-sm leading-6 text-amber-300">
                  This localhost link only works on this computer. To share with a phone, open the app on the desktop using its network address or deployed public URL, then create the workout again.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default DashboardPage
