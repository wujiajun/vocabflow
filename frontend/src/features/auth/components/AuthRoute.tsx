import { type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { AuthSessionError } from './AuthSessionError'

interface AuthRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: AuthRouteProps) {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <AuthLoadingState />
  }

  if (auth.status === 'error') {
    return (
      <AuthSessionError
        error={auth.error}
        isRetrying={auth.isRetrying}
        onRetry={auth.retry}
        onSignOut={auth.discardSession}
      />
    )
  }

  return auth.status === 'authenticated' ? children : <Navigate to="/login" replace />
}

export function PublicOnlyRoute({ children }: AuthRouteProps) {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <AuthLoadingState />
  }

  if (auth.status === 'error') {
    return (
      <AuthSessionError
        error={auth.error}
        isRetrying={auth.isRetrying}
        onRetry={auth.retry}
        onSignOut={auth.discardSession}
      />
    )
  }

  return auth.status === 'authenticated' ? <Navigate to="/app" replace /> : children
}

export function AuthLoadingState() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-sm text-slate-600">
      Checking your session…
    </main>
  )
}
