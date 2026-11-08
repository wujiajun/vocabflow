import { Navigate, Route, Routes } from 'react-router'
import { AuthLoadingState, ProtectedRoute, PublicOnlyRoute } from '../../features/auth/components/AuthRoute'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { RegisterPage } from '../../features/auth/pages/RegisterPage'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { ArticleAlbumPage } from '../../features/articles/pages/ArticleAlbumPage'
import { ArticlePage } from '../../features/articles/pages/ArticlePage'
import { ArticlesPage } from '../../features/articles/pages/ArticlesPage'
import { AlbumPage } from '../../features/videos/pages/AlbumPage'
import { VideosPage } from '../../features/videos/pages/VideosPage'
import { ReadingListPage } from '../../features/reading/pages/ReadingListPage'
import { ReadingPassagePage } from '../../features/reading/pages/ReadingPassagePage'
import { ReadingWritingPage } from '../../features/reading/pages/ReadingWritingPage'
import { FillBlankPage } from '../../features/learning/pages/FillBlankPage'
import { SpellItPage } from '../../features/learning/pages/SpellItPage'
import { ListenChoosePage } from '../../features/learning/pages/ListenChoosePage'
import { QuickReviewPage } from '../../features/learning/pages/QuickReviewPage'
import { StudyPage } from '../../features/learning/pages/StudyPage'
import { ProgressPage } from '../../features/progress/pages/ProgressPage'
import { PointsHistoryPage } from '../../features/tasks/pages/PointsHistoryPage'
import { SettingsPage } from '../../features/settings/pages/SettingsPage'
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
        <Route path="reading" element={<ReadingListPage />} />
        <Route path="reading/articles" element={<ArticlesPage />} />
        <Route path="reading/articles/albums/:albumId" element={<ArticleAlbumPage />} />
        <Route path="reading/articles/a/:articleId" element={<ArticlePage />} />
        <Route path="reading/videos" element={<VideosPage />} />
        <Route path="reading/videos/:albumId" element={<AlbumPage />} />
        <Route path="reading/writing" element={<ReadingWritingPage />} />
        <Route path="reading/:id" element={<ReadingPassagePage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="study/review" element={<QuickReviewPage />} />
        <Route path="study/fill" element={<FillBlankPage />} />
        <Route path="study/listen" element={<ListenChoosePage />} />
        <Route path="study/spell" element={<SpellItPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="points" element={<PointsHistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
