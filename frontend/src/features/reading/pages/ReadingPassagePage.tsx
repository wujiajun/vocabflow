import { Link, useLocation, useParams } from 'react-router'
import { ApiClientError } from '../../../shared/api/apiClient'
import { readBackTarget } from '../../../shared/navigation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { formatWordCount, formatWritten } from '../components/formatReading'
import { PassageText } from '../components/PassageText'
import { ReadStatus } from '../components/ReadStatus'
import { useReadingPassage, useSetRead } from '../hooks/useReading'

const defaultBackTarget = { path: '/app/reading', label: 'Back to reading' }

export function ReadingPassagePage() {
  const { id: rawId } = useParams()
  const id = rawId !== undefined && /^\d+$/.test(rawId) ? Number(rawId) : undefined
  const passage = useReadingPassage(id)
  const setRead = useSetRead()
  const back = readBackTarget(useLocation().state, defaultBackTarget)
  usePageTitle(passage.data?.title ?? 'Reading')

  return (
    <div>
      <Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" to={back.path}>
        ← {back.label}
      </Link>
      <div className="mt-5">{renderBody()}</div>
    </div>
  )

  function renderBody() {
    if (id === undefined || isNotFound(passage.error)) {
      return (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">We couldn’t find that passage</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been mistyped, or it isn’t one of yours.</p>
        </div>
      )
    }

    if (passage.isPending) {
      return (
        <p className="text-sm text-slate-600" role="status">
          Loading…
        </p>
      )
    }

    if (passage.isError) {
      return (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(passage.error, 'Unable to load this passage.')}</p>
          <button
            className="mt-2 font-semibold underline underline-offset-4"
            disabled={passage.isFetching}
            onClick={() => void passage.refetch()}
            type="button"
          >
            {passage.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )
    }

    const current = passage.data

    function toggleRead() {
      if (!setRead.isPending) {
        setRead.mutate({ id: current.id, read: !current.read })
      }
    }

    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{current.title}</h1>
          <ReadStatus read={current.read} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {formatWritten(current.createdAt)} · {formatWordCount(current.words.length)} from your study
        </p>
        <p className="mt-1 text-sm text-slate-600">
          The <mark className="rounded-sm bg-amber-100 px-0.5 font-semibold text-slate-950">highlighted</mark> words are
          the ones you studied. Tap any other word to add it to your list.
        </p>

        <div className="mt-6">
          <PassageText text={current.text} />
        </div>

        <section aria-label="Words in this passage" className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Words in this passage</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {current.words.map((word) => (
              <li className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-slate-800" key={word}>
                {word}
              </li>
            ))}
          </ul>
        </section>

        {setRead.isError ? (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(setRead.error, 'Unable to save that. Please try again.')}
          </p>
        ) : null}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <button
            aria-disabled={setRead.isPending}
            className={
              current.read
                ? 'rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
                : 'rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
            }
            onClick={toggleRead}
            type="button"
          >
            {setRead.isPending ? 'Saving…' : current.read ? 'Mark as unread' : 'Mark as read'}
          </button>
          <p className="mt-2 text-sm text-slate-600" role="status">
            {current.read && current.readAt
              ? `Read on ${new Date(current.readAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.`
              : ''}
          </p>
        </div>
      </article>
    )
  }
}

function isNotFound(error: unknown) {
  return error instanceof ApiClientError && error.status === 404
}
