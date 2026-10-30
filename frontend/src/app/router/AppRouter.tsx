import { Navigate, Route, Routes } from 'react-router'
import { AuthLoadingState, ProtectedRoute, PublicOnlyRoute } from '../../features/auth/components/AuthRoute'
import { AuthenticatedAppPage } from '../../features/auth/pages/AuthenticatedAppPage'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { RegisterPage } from '../../features/auth/pages/RegisterPage'
import { useAuth } from '../../features/auth/hooks/useAuth'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AuthenticatedAppPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RootRoute() {
  const auth = useAuth()
  if (auth.status === 'loading') {
    return <AuthLoadingState />
  }

  // A failed session check is recovered from on /app, where the stored token is still in use.
  return <Navigate to={auth.status === 'authenticated' || auth.status === 'error' ? '/app' : '/login'} replace />
}
