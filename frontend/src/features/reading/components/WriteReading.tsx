import { Link, useNavigate } from 'react-router'
import { useReadingToday } from '../hooks/useReading'

// On the page shown when a day's study is complete. Writing is the learner's choice, once a day.
export function WriteReading({ date }: { date: string }) {
  const today = useReadingToday(date, true)
  const navigate = useNavigate()

  // Until it is known whether today already has a passage, offer nothing rather than the wrong thing.
  if (!today.data) {
    return null
  }

  const written = today.data.passageId !== null

  // The two states look different at a glance: green and finished, or blue and still to do.
  return (
    <section
      aria-label="Reading"
      className={`mt-6 rounded-xl px-4 py-4 ${written ? 'bg-emerald-50' : 'bg-indigo-50'}`}
    >
      {today.data.passageId !== null ? (
        <>
          <h3 className="text-sm font-semibold tracking-wide text-emerald-900 uppercase">✓ Today’s passage is ready</h3>
          <p className="mt-2 text-sm text-slate-700">You have already written today’s reading passage.</p>
          <Link
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to={`/app/reading/${today.data.passageId}`}
          >
            Open today’s passage →
          </Link>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold tracking-wide text-indigo-900 uppercase">Reinforce today’s words</h3>
          <p className="mt-2 text-sm text-slate-700">
            Write a short passage that uses 10 to 15 of the words you studied today. You can write one a day.
          </p>
          {/* The writing happens on its own page, so the wait is spent where the passage will appear. */}
          <button
            className="mt-3 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={() => navigate(`/app/reading/writing?date=${date}`)}
            type="button"
          >
            ✎ Write a reading passage
          </button>
        </>
      )}
    </section>
  )
}
