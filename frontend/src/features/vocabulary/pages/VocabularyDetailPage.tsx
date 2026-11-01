import { Link, useLocation, useParams } from 'react-router'
import { ApiClientError } from '../../../shared/api/apiClient'
import { readBackTarget } from '../../../shared/navigation'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import { usePageTitle } from '../../../shared/usePageTitle'
import { useVoiceAccent } from '../../../shared/speech/usePronunciation'
import { authErrorMessage } from '../../auth/components/AuthError'
import { EnrichmentPanel } from '../components/EnrichmentPanel'
import { BaseFormNote } from '../components/BaseFormNote'
import { SenseTabs } from '../components/SenseTabs'
import { describeKind, formatLearningStatus } from '../components/formatVocabulary'
import { useVocabularyDetail } from '../hooks/useVocabulary'

const defaultBackTarget = { path: '/app/vocabulary', label: 'Back to vocabulary' }

export function VocabularyDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId !== undefined && /^\d+$/.test(rawId) ? Number(rawId) : undefined
  const detail = useVocabularyDetail(id)
  const accent = useVoiceAccent()
  const back = readBackTarget(useLocation().state, defaultBackTarget)
  usePageTitle(detail.data?.term ?? 'Vocabulary')

  return (
    <div>
      <Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" to={back.path}>
        ← {back.label}
      </Link>
      <div className="mt-5">{renderBody()}</div>
    </div>
  )

  function renderBody() {
    if (id === undefined || isNotFound(detail.error)) {
      return (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">We couldn’t find that word</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been mistyped, or it isn’t in your vocabulary.</p>
        </div>
      )
    }

    if (detail.isPending) {
      return (
        <p className="text-sm text-slate-600" role="status">
          Loading…
        </p>
      )
    }

    if (detail.isError) {
      return (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(detail.error, 'Unable to load this word.')}</p>
          <button
            className="mt-2 font-semibold underline underline-offset-4"
            disabled={detail.isFetching}
            onClick={() => void detail.refetch()}
            type="button"
          >
            {detail.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )
    }

    const entry = detail.data
    const kind = describeKind(entry.type, entry.senses.length > 1 ? null : entry.partOfSpeech)

    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{entry.term}</h1>
          <PronounceButton term={entry.term} />
        </div>
        <BaseFormNote baseForm={entry.baseForm} className="mt-1" />
        <EnrichmentPanel entry={entry} onCheckAgain={() => void detail.refetch()} />
        <p className="mt-2 text-sm text-slate-500">
          {[kind, `Status: ${formatLearningStatus(entry.learningStatus)}`].filter(Boolean).join(' · ')}
        </p>
        {accent === 'other' ? (
          <p className="mt-1 text-xs text-amber-800">
            No American English voice was found on this device, so another English voice is used.
          </p>
        ) : null}
        <div className="mt-6">
          {entry.senses.length > 0 ? (
            <SenseTabs headingLevel="h2" key={entry.id} senses={entry.senses} />
          ) : (
            <p className="leading-7 text-slate-800">Definition not available yet.</p>
          )}
        </div>
        <p className="mt-8 text-xs text-slate-500">
          Added {new Date(entry.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </p>
      </article>
    )
  }
}

function isNotFound(error: unknown) {
  return error instanceof ApiClientError && (error.status === 404 || error.status === 400)
}
