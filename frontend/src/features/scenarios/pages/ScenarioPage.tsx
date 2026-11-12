import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ApiClientError } from '../../../shared/api/apiClient'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { articleTimings } from '../../articles/articleLengths'
import { GlossaryList } from '../../articles/components/GlossaryList'
import { authErrorMessage } from '../../auth/components/AuthError'
import { PassageReader } from '../../reading/components/PassageReader'
import { ReadStatus } from '../../reading/components/ReadStatus'
import { QuizBlock } from '../components/QuizBlock'
import { dialogueFromText } from '../speaking/dialogueFromText'
import { SpeakScene } from '../speaking/SpeakScene'
import { useCompleteScenario, useSaveSpeakingScore, useScenario } from '../hooks/useScenarios'

const fallbackBack = { path: '/app/reading/scenarios', label: 'Back to Canada' }

// One scenario in the reader: tap a word to add it, listen to it, learn its keywords, take the quiz.
// Reaching the end of the page, or checking the quiz, marks it finished.
export function ScenarioPage() {
  const { scenarioId } = useParams()
  const scenario = useScenario(scenarioId)
  const complete = useCompleteScenario(scenarioId)
  const endRef = useRef<HTMLDivElement>(null)
  const completed = scenario.data?.completed
  usePageTitle(scenario.data?.title ?? 'Life in Canada')

  useEffect(() => {
    const end = endRef.current
    if (completed !== false || !end || typeof IntersectionObserver === 'undefined') {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting)
      clearTimeout(timer)
      if (visible) {
        timer = setTimeout(() => complete.mutate(undefined), articleTimings.endDwellMs)
      }
    })
    observer.observe(end)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `complete.mutate` is stable enough; only a change of scenario matters.
  }, [completed, scenarioId])

  return (
    <div>
      <BackLink fallback={fallbackBack} />
      <div className="mt-5">{renderBody()}</div>
    </div>
  )

  function renderBody() {
    if (scenarioId === undefined || (scenario.error instanceof ApiClientError && scenario.error.status === 404)) {
      return (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">We couldn’t find that scenario</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been mistyped, or it is no longer offered.</p>
        </div>
      )
    }
    if (scenario.isPending) {
      return (
        <p className="text-sm text-slate-600" role="status">
          Loading…
        </p>
      )
    }
    if (scenario.isError) {
      return (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(scenario.error, 'Unable to load this scenario.')}</p>
          <button className="mt-2 font-semibold underline underline-offset-4" disabled={scenario.isFetching} onClick={() => void scenario.refetch()} type="button">
            {scenario.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )
    }

    const current = scenario.data
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{current.title}</h1>
          <ReadStatus read={current.completed} />
        </div>
        <p className="mt-1 text-base text-slate-700">{current.titleZh}</p>
        <p className="mt-2 text-sm text-slate-600">
          CLB {current.clb} · {current.readingMinutes} min read
        </p>
        <p className="mt-1 text-sm text-slate-600">Tap any word to add it to your list.</p>
        <SpeakEntry scenarioId={current.id} speakingScore={current.speakingScore} spokenAt={current.spokenAt} text={current.text} />

        <PassageReader source={{ title: current.title, link: `/app/reading/scenarios/${current.id}` }} text={current.text} />

        {current.canadaNoteZh ? (
          <aside aria-label="Note about Canada" className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <p className="font-semibold">加拿大小贴士</p>
            <p>{current.canadaNoteZh}</p>
          </aside>
        ) : null}

        <GlossaryList title="Keywords" withAddAll words={current.keywords.map((keyword) => ({ word: keyword.word, zh: keyword.zh, definition: keyword.definition, example: keyword.example }))} />

        {current.quiz.length > 0 ? <QuizBlock onChecked={(score) => complete.mutate(score)} questions={current.quiz} /> : null}
        {/* The end of the page, quiz included: reaching it marks the scenario as finished. */}
        <div ref={endRef} />

        {complete.isError ? (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(complete.error, 'Unable to save that. Please try again.')}
          </p>
        ) : null}
        <p className="mt-6 text-sm text-slate-600" role="status">
          {current.completed && current.completedAt ? `Finished on ${new Date(current.completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.` : ''}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-600">Written for VocabFlow. Practical facts differ between provinces and change over time, so check official sources before you act.</p>
      </article>
    )
  }
}

// "Speak this scene" appears only when the text holds a conversation between two or more speakers.
// The latest speaking result is shown under the button and saved quietly when a round ends.
function SpeakEntry({ text, scenarioId, speakingScore, spokenAt }: { text: string; scenarioId: string; speakingScore: number | null; spokenAt: string | null }) {
  const lines = useMemo(() => dialogueFromText(text), [text])
  const [open, setOpen] = useState(false)
  const save = useSaveSpeakingScore(scenarioId)
  if (lines.length === 0) {
    return null
  }
  return (
    <>
      {open ? <SpeakScene lines={lines} onClose={() => setOpen(false)} onFinished={(score) => save.mutate(score)} /> : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button className="min-h-11 rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white" onClick={() => setOpen(true)} type="button">
          Speak this scene
        </button>
        {speakingScore !== null ? (
          <p className="text-sm text-slate-700" data-testid="last-speaking">
            Last time: <strong className="text-indigo-800">{speakingScore}%</strong>
            {spokenAt ? ` · ${new Date(spokenAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : ''}
          </p>
        ) : null}
      </div>
    </>
  )
}
