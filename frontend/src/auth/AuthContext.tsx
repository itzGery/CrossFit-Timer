import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Coach = { sub: string; email: string }
type AuthContextValue = {
  coach: Coach | null
  loading: boolean
  error: string | null
  signIn: (credential: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function readAuthResponse(response: Response): Promise<{ coach?: Coach | null; error?: string } | null> {
  if (!response.headers.get('content-type')?.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadSession() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
        if (!response.ok) throw new Error('Unable to check your session.')
        const data = await readAuthResponse(response)
        if (!data || !('coach' in data)) throw new Error('Invalid session response.')
        if (active) setCoach(data.coach ?? null)
      } catch {
        if (active) setError('Unable to check your session. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSession()
    return () => { active = false }
  }, [])

  async function signIn(credential: string) {
    let response: Response
    try {
      response = await fetch('/api/auth/google', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
    } catch {
      throw new Error('Cannot reach the authentication server. Check that the backend is running.')
    }
    const data = await readAuthResponse(response)
    if (response.status === 403) {
      if (data?.error === 'Request origin is not allowed.') {
        throw new Error('This application address is not allowed for sign-in. Open the configured local URL and try again.')
      }
      throw new Error('Access denied. Please sign in with an authorized @yaqbot.com Google Workspace account.')
    }
    if (response.status === 401) throw new Error('Google sign-in is invalid or expired. Please try again.')
    if (!response.ok) throw new Error('Authentication is temporarily unavailable. Please try again.')
    if (!data?.coach) throw new Error('Authentication server returned an invalid response. Please try again.')
    setCoach(data.coach)
    setError(null)
  }

  async function signOut() {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('Could not sign out. Please try again.')
    setCoach(null)
  }

  return <AuthContext.Provider value={{ coach, loading, error, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
