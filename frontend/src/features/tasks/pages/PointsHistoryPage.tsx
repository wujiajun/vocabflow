import { useNavigate, useSearchParams } from 'react-router'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { Pagination } from '../../vocabulary/components/Pagination'
import { pageFromParam, paramFromPage } from '../../vocabulary/hooks/pageParam'
import { useLedger } from '../hooks/useTasks'

export function PointsHistoryPage() {
  usePageTitle('Points')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const page = pageFromParam(params.get('page'))
  const ledger = useLedger(page)

  function changePage(next: number) {
    const value = paramFromPage(next)
    // Pages of one list replace each other, so swiping back leaves the list.
    navigate(value ? `?page=${value}` : '?', { replace: true })
  }

  return (
    <div>
      <BackLink
        className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline underline-offset-4"
        fallback={{ path: '/app/study', label: 'Back to study' }}
      />
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Points</h1>
      {ledger.isPending ? (
        <p className="mt-4 text-sm text-slate-600" role="status">
          Loading your points…
        </p>
      ) : ledger.isError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {authErrorMessage(ledger.error, 'Unable to load your points.')}
        </p>
      ) : ledger.data.entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No points yet. Finish today’s study plan to earn the first ones.</p>
      ) : (
        <>
          <ul className={`mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white ${ledger.isPlaceholderData ? 'opacity-60' : ''}`}>
            {ledger.data.entries.map((entry) => (
              <li className="flex min-h-11 items-center justify-between gap-3 px-4 py-2" key={`${entry.date}-${entry.key}`}>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{entry.reason}</span>
                  <span className="block text-xs text-slate-600">{entry.date}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-amber-800">+{entry.amount}</span>
              </li>
            ))}
          </ul>
          <Pagination
            isLoading={ledger.isPlaceholderData}
            label="Points pages"
            onPageChange={changePage}
            page={ledger.data.page}
            totalPages={ledger.data.totalPages}
          />
        </>
      )}
    </div>
  )
}
