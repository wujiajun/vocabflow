import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import type { ProgressSummary } from '../types/progress'

// How far the learner has come with the Life in Canada scenarios, reading and speaking.
export function CanadaScenes({ scenes }: { scenes: ProgressSummary['scenes'] }) {
  if (scenes.total === 0) return null
  return (
    <section aria-labelledby="scenes-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold tracking-tight" id="scenes-heading">
        Life in Canada
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-600">Scenarios finished</dt>
          <dd className="text-xl font-bold" data-testid="scenes-finished">
            {scenes.finished} of {scenes.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Scenes spoken</dt>
          <dd className="text-xl font-bold" data-testid="scenes-spoken">
            {scenes.spoken}{' '}
            {scenes.averageSpeaking !== null ? <span className="text-sm font-semibold text-slate-600">· {scenes.averageSpeaking}% on average</span> : null}
          </dd>
        </div>
      </dl>
      <Link
        className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline underline-offset-4"
        state={backState('/app/progress', 'Back to My progress')}
        to="/app/reading/scenarios"
      >
        {scenes.finished < scenes.total ? 'Open the next scenario' : 'Practise a scene again'}
      </Link>
    </section>
  )
}
