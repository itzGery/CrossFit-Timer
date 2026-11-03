import { GoogleLogin } from '@react-oauth/google'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import BrandMark from '../BrandMark'

function LoginPage() {
  const { coach, signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleGoogleSuccess(credential: string) {
    setSubmitting(true)
    setError(null)
    try {
      await signIn(credential)
      navigate('/dashboard', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <section aria-labelledby="login-heading" className="flex w-full max-w-sm flex-col items-center text-center">
        <BrandMark className="h-12 w-20" />
        <h1 id="login-heading" className="mt-7 text-5xl font-extrabold tracking-tight text-paper sm:text-6xl">CrossFit Timer</h1>
        <p className="mt-3 text-base leading-6 text-muted">Workout timer for CrossFit coaches.</p>
        {coach ? (
          <div className="mt-10">
            <p className="break-all text-sm text-paper">Signed in as {coach.email}</p>
            <Link to="/dashboard" className="mt-6 inline-block bg-accent px-6 py-3 text-sm font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Go to dashboard</Link>
          </div>
        ) : (
          <div className="mt-10">
            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                theme="outline"
                size="large"
                text="signin_with"
                onSuccess={(response) => {
                  if (response.credential) void handleGoogleSuccess(response.credential)
                  else setError('Google did not return a sign-in credential.')
                }}
                onError={() => setError('Google sign-in was cancelled or unavailable.')}
              />
            ) : <p role="alert" className="text-amber-200">Google sign-in is not configured for this frontend.</p>}
            {submitting && <p role="status" className="mt-4 text-sm text-muted">Verifying your account…</p>}
          </div>
        )}
        <p className="mt-8 text-sm leading-6 text-muted">Coach access is limited to verified @yaqbot.com accounts.</p>
        {error && <p role="alert" className="mt-5 border-l-2 border-accent pl-3 text-left text-sm leading-6 text-paper">{error}</p>}
      </section>
    </main>
  )
}

export default LoginPage
