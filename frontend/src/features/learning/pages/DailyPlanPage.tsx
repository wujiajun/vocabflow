import { Link } from 'react-router'
import { parseLocalDate } from '../../../shared/date'
import { useToday } from '../../../shared/useToday'
import { authErrorMessage } from '../../auth/components/AuthError'
import { PlanItemList } from '../components/PlanItemList'
import { useDailyPlan } from '../hooks/useDailyPlan'

export function DailyPlanPage() {
  const plan = useDailyPlan(useToday())

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Today’s plan</h1>
      {plan.isPending ? (
        <p className="mt-6 text-sm text-slate-600" role="status">
          Loading today’s plan…
        </p>
      ) : plan.isError ? (
        <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(plan.error, 'Unable to load today’s plan.')}</p>
          <button
            className="mt-2 font-semibold underline underline-offset-4"
            disabled={plan.isFetching}
            onClick={() => void plan.refetch()}
            type="button"
          >
            {plan.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      ) : (
        <PlanContent plan={plan.data} />
      )}
    </div>
  )
}

function PlanContent({ plan }: { plan: NonNullable<ReturnType<typeof useDailyPlan>['data']> }) {
  const count = plan.newItems.length
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(parseLocalDate(plan.date))

  return (
    <>
      <p className="mt-2 text-sm text-slate-600">{date}</p>
      <p className="mt-1 text-sm text-slate-600">
        {count} new {count === 1 ? 'word' : 'words'} · daily goal {plan.newVocabularyGoal}
      </p>

      <section aria-label="New words" className="mt-6">
        {count === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            <p>There are no new words in today’s plan.</p>
            <p className="mt-1">
              Today’s plan is saved once created, so words you add now can only join a later plan.{' '}
              <Link className="font-semibold text-indigo-700 underline underline-offset-4" to="/app/vocabulary">
                Go to your vocabulary
              </Link>
            </p>
          </div>
        ) : (
          <>
            <PlanItemList items={plan.newItems} label="New words" />
            {count < plan.newVocabularyGoal ? (
              <p className="mt-4 text-sm text-slate-600">
                Today’s plan is saved once created, so words you add now won’t appear in it.
              </p>
            ) : null}
          </>
        )}
      </section>

      {plan.reviewItems.length > 0 ? (
        <section aria-label="Review" className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Review</h2>
          <PlanItemList items={plan.reviewItems} label="Words to review" />
        </section>
      ) : null}
    </>
  )
}
