import { Link, useLocation } from 'react-router'
import { backState } from '../../../shared/navigation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { ReadingSwitch } from '../../reading/components/ReadingSwitch'
import { useScenarios } from '../hooks/useScenarios'

// Scenes of everyday life in Canada: a dialogue or a short text, its words with Chinese meanings, and a small quiz.
export function ScenariosPage() {
  usePageTitle('Life in Canada')
  const scenarios = useScenarios()
  const location = useLocation()
  const backPath = `${location.pathname}${location.search}`
  const done = scenarios.data?.filter((scenario) => scenario.completed).length ?? 0

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reading</h1>
      <ReadingSwitch current="scenarios" />
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
        Everyday situations in Canada: renting, banking, school, work and taxes. Read the scene, learn its words, then take the quiz. Tap any word to add it.
      </p>
      <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">日常生活场景:读对话、学关键词、做小测验。点任何单词即可加入词库。</p>

      <section aria-label="Scenarios" className="mt-4 sm:mt-6">
        {scenarios.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading…
          </p>
        ) : scenarios.isError ? (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <p>{authErrorMessage(scenarios.error, 'Unable to load the scenarios.')}</p>
            <button className="mt-2 font-semibold underline underline-offset-4" disabled={scenarios.isFetching} onClick={() => void scenarios.refetch()} type="button">
              {scenarios.isFetching ? 'Trying again…' : 'Try again'}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-slate-700">
              {done} of {scenarios.data.length} finished
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {scenarios.data.map((scenario) => (
                <li key={scenario.id}>
                  <Link
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                    state={backState(backPath, 'Back to Canada')}
                    to={`/app/reading/scenarios/${scenario.id}`}
                  >
                    <h2 className="text-base leading-6 font-bold tracking-tight text-slate-900">{scenario.title}</h2>
                    <p className="text-sm text-slate-600">{scenario.titleZh}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-900">CLB {scenario.clb}</span>
                      <span className="text-slate-700">{scenario.readingMinutes} min</span>
                      {scenario.completed ? (
                        <span className="font-semibold text-emerald-800">
                          ✓ Finished{scenario.bestScore !== null ? ` · ${scenario.bestScore}/${scenario.quizSize}` : ''}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">{scenario.summary}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{scenario.summaryZh}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
