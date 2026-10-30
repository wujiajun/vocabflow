import { Link } from 'react-router'
import type { VocabularyEntry } from '../types/vocabulary'
import { EnrichmentBadge } from './EnrichmentBadge'
import { describeKind } from './formatVocabulary'

export function VocabularyListItem({ entry }: { entry: VocabularyEntry }) {
  const kind = describeKind(entry.type, entry.partOfSpeech)

  return (
    <li>
      <Link
        className="block rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        to={`/app/vocabulary/${entry.id}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base font-semibold text-slate-950">{entry.term}</span>
          {kind ? <span className="text-sm text-slate-500">{kind}</span> : null}
          <EnrichmentBadge status={entry.enrichmentStatus} />
        </div>
        {entry.definition ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{entry.definition}</p> : null}
      </Link>
    </li>
  )
}
