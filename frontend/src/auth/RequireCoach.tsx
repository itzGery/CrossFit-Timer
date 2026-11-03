import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import type { ReactNode } from 'react'

export default function RequireCoach({ children }: { children: ReactNode }) {
  const { coach, loading, error } = useAuth()

  if (loading) return <main role="status" className="mx-auto max-w-6xl px-5 py-16 text-muted">Checking your session…</main>
  if (error) return <main role="alert" className="mx-auto max-w-6xl px-5 py-16 text-red-200">{error}</main>
  if (!coach) return <Navigate to="/login" replace />
  return children
}
