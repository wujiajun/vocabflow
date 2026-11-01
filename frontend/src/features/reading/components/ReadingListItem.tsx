import { Link, useLocation } from 'react-router'
import { backState } from '../../../shared/navigation'
import type { ReadingSummary } from '../types/reading'
import { formatWordCount, formatWritten } from './formatReading'
import { ReadStatus } from './ReadStatus'

export function ReadingListItem({ passage }: { passage: ReadingSummary }) {
  const location = useLocation()

  return (
    <li
      className={`rounded-xl border bg-white transition focus-within:border-indigo-300 hover:border-indigo-300 hover:bg-indigo-50/40 ${
        passage.read ? 'border-slate-200' : 'border-slate-200 border-l-4 border-l-indigo-700'
      }`}
    >
      <Link
        className="block rounded-xl px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        state={backState(`${location.pathname}${location.search}`, 'Back to reading')}
        to={`/app/reading/${passage.id}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`text-base [overflow-wrap:anywhere] ${passage.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-950'}`}
          >
            {passage.title}
          </span>
          <ReadStatus read={passage.read} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {formatWritten(passage.createdAt)} · {formatWordCount(passage.wordCount)} studied
        </p>
      </Link>
    </li>
  )
}
