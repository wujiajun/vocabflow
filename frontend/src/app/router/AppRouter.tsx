import { Navigate, Route, Routes } from 'react-router'
import { AuthLoadingState, ProtectedRoute, PublicOnlyRoute } from '../../features/auth/components/AuthRoute'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { RegisterPage } from '../../features/auth/pages/RegisterPage'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { StudyPage } from '../../features/learning/pages/StudyPage'
import { VocabularyDetailPage } from '../../features/vocabulary/pages/VocabularyDetailPage'
import { VocabularyPage } from '../../features/vocabulary/pages/VocabularyPage'
import { AppShell } from '../layout/AppShell'

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
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="study" replace />} />
        <Route path="vocabulary" element={<VocabularyPage />} />
        <Route path="vocabulary/:id" element={<VocabularyDetailPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="*" element={<Navigate to="/app/study" replace />} />
      </Route>
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
