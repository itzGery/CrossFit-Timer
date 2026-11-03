import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import TimerPage from './pages/TimerPage'
import RequireCoach from './auth/RequireCoach'
import { useAuth } from './auth/AuthContext'
import BrandMark from './BrandMark'

const navigation = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/timer', label: 'Timer' },
]

function App() {
  const { pathname } = useLocation()
  const { coach, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState<string | null>(null)

  async function handleSignOut() {
    try {
      await signOut()
      setLogoutError(null)
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Could not sign out.')
    }
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      {pathname !== '/timer' && pathname !== '/login' && (
        <header className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
          <NavLink to="/dashboard" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <BrandMark /> CrossFit Timer
          </NavLink>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 sm:ml-auto">
            {navigation.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `border-b-2 py-2 text-xs font-semibold uppercase tracking-[0.08em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${isActive ? 'border-accent text-paper' : 'border-transparent text-muted hover:text-paper'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          {coach && <div className="ml-auto flex items-center gap-4 sm:ml-0"><span className="max-w-36 truncate text-xs text-muted sm:max-w-48" title={coach.email}>{coach.email}</span><button type="button" onClick={() => void handleSignOut()} className="text-xs font-semibold uppercase tracking-[0.08em] text-muted underline-offset-4 hover:text-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Sign out</button></div>}
        </div>
        {logoutError && <p role="alert" className="mx-auto max-w-6xl px-5 pb-3 text-sm text-red-200">{logoutError}</p>}
        </header>
      )}

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireCoach><DashboardPage /></RequireCoach>} />
        <Route path="/timer" element={<TimerPage />} />
        <Route
          path="*"
          element={
            <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
              <p className="font-display text-base font-bold uppercase tracking-[0.08em] text-accent">Page not found</p>
              <h1 className="mt-4 text-3xl font-bold">This page does not exist.</h1>
              <NavLink to="/dashboard" className="mt-8 inline-block border-b border-accent pb-1 font-bold text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                Go to dashboard
              </NavLink>
            </main>
          }
        />
      </Routes>
    </div>
  )
}

export default App
