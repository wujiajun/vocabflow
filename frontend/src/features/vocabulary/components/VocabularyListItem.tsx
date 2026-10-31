import { Link, useLocation } from 'react-router'
import { backState } from '../../../shared/navigation'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import type { VocabularyEntry } from '../types/vocabulary'
import { EnrichmentBadge } from './EnrichmentBadge'
import { describeKind } from './formatVocabulary'

export function VocabularyListItem({ entry }: { entry: VocabularyEntry }) {
  const kind = describeKind(entry.type, entry.partOfSpeech)
  const location = useLocation()

  return (
    <li className="flex items-center rounded-xl border border-slate-200 bg-white pr-2 transition focus-within:border-indigo-300 hover:border-indigo-300 hover:bg-indigo-50/40">
      <Link
        className="block min-w-0 flex-1 rounded-xl px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        state={backState(`${location.pathname}${location.search}`, 'Back to vocabulary')}
        to={`/app/vocabulary/${entry.id}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base font-semibold text-slate-950 [overflow-wrap:anywhere]">{entry.term}</span>
          {kind ? <span className="text-sm text-slate-600">{kind}</span> : null}
          <EnrichmentBadge status={entry.enrichmentStatus} />
        </div>
        {entry.definition ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{entry.definition}</p> : null}
      </Link>
      <PronounceButton term={entry.term} />
    </li>
  )
}
