import { useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useGeneratePassage } from '../hooks/useReading'

// Where the learner waits while the passage is written: the day comes from the address, so a
// refresh keeps working, and the server writes one passage a day, so asking again is safe.
export function ReadingWritingPage() {
  usePageTitle('Writing your passage')
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date')
  const valid = date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const generate = useGeneratePassage()
  const navigate = useNavigate()
  const started = useRef(false)

  function write() {
    if (valid && !generate.isPending) {
      generate.mutate(date, { onSuccess: (passage) => navigate(`/app/reading/${passage.id}`, { replace: true }) })
    }
  }

  // Once per visit, even where React runs effects twice while developing.
  useEffect(() => {
    if (!started.current) {
      started.current = true
      write()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!valid) {
    return <Navigate replace to="/app/study" />
  }

  return (
    <div>
      <Link className="text-sm font-semibold text-indigo-700 underline underline-offset-4" to="/app/study">
        ← Back to study
      </Link>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        {generate.isError ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">We couldn’t write your passage</h1>
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {authErrorMessage(generate.error, 'Unable to write a passage. Please try again.')}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                onClick={write}
                type="button"
              >
                Try again
              </button>
              <Link
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                to="/app/study"
              >
                Back to study
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Writing your passage…</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600" role="status">
              Using the words you studied today. This takes about 15 seconds. You can leave this page; the passage will
              be in Reading when it is done.
            </p>
            <div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full w-1/3 rounded-full bg-indigo-600 motion-safe:animate-pulse" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
