import { Link, useNavigate } from 'react-router'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useGeneratePassage, useReadingToday } from '../hooks/useReading'

// On the page shown when a day's study is complete. Writing is the learner's choice, once a day.
export function WriteReading({ date }: { date: string }) {
  const today = useReadingToday(date, true)
  const generate = useGeneratePassage()
  const navigate = useNavigate()

  // Until it is known whether today already has a passage, offer nothing rather than the wrong thing.
  if (!today.data) {
    return null
  }

  function write() {
    if (!generate.isPending) {
      generate.mutate(date, { onSuccess: (passage) => navigate(`/app/reading/${passage.id}`) })
    }
  }

  return (
    <section aria-label="Reading" className="mt-6 rounded-xl bg-indigo-50 px-4 py-4">
      <h3 className="text-sm font-semibold tracking-wide text-indigo-900 uppercase">Reinforce today’s words</h3>
      {today.data.passageId !== null ? (
        <>
          <p className="mt-2 text-sm text-slate-700">Today’s reading passage is ready.</p>
          <Link
            className="mt-3 inline-block rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            to={`/app/reading/${today.data.passageId}`}
          >
            Open today’s passage
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-700">
            Write a short passage that uses 10 to 15 of the words you studied today. You can write one a day.
          </p>
          {generate.isError ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {authErrorMessage(generate.error, 'Unable to write a passage. Please try again.')}
            </p>
          ) : null}
          <button
            aria-disabled={generate.isPending}
            className="mt-3 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={write}
            type="button"
          >
            {generate.isPending ? 'Writing your passage…' : 'Write a reading passage'}
          </button>
          <p className="mt-2 text-sm text-slate-600" role="status">
            {generate.isPending ? 'This takes about 15 seconds. If you leave, it will be in Reading when it is done.' : ''}
          </p>
        </>
      )}
    </section>
  )
}
