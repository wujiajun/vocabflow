import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { BigNumbers } from '../components/BigNumbers'
import { Heatmap } from '../components/Heatmap'
import { MilestoneBar } from '../components/MilestoneBar'
import { WeekCompare } from '../components/WeekCompare'
import { useProgress } from '../hooks/useProgress'

export function ProgressPage() {
  usePageTitle('My progress')
  const progress = useProgress(useUserToday())

  return (
    <div>
      <BackLink
        className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline underline-offset-4"
        fallback={{ path: '/app/study', label: 'Back to study' }}
      />
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">My progress</h1>
      {progress.isPending ? (
        <p className="mt-4 text-sm text-slate-600" role="status">
          Loading your progress…
        </p>
      ) : progress.isError ? (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(progress.error, 'Unable to load your progress.')}</p>
          <button className="mt-1 min-h-11 font-semibold underline underline-offset-4" onClick={() => void progress.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <BigNumbers summary={progress.data} />
          <MilestoneBar summary={progress.data} />
          <Heatmap days={progress.data.days} />
          <WeekCompare lastWeek={progress.data.lastWeek} thisWeek={progress.data.thisWeek} />
        </div>
      )}
    </div>
  )
}
