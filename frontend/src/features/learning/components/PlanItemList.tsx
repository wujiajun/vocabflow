import { Link } from 'react-router'
import { formatVocabularyType } from '../../vocabulary/components/formatVocabulary'
import type { DailyPlanItem } from '../types/dailyPlan'

export function PlanItemList({ items, label }: { items: DailyPlanItem[]; label: string }) {
  return (
    <ol aria-label={label} className="space-y-3">
      {items.map((item, index) => {
        const type = formatVocabularyType(item.type)

        return (
          <li key={item.userVocabularyId}>
            <Link
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
              to={`/app/vocabulary/${item.userVocabularyId}`}
            >
              <span aria-hidden="true" className="w-6 shrink-0 text-sm font-semibold text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0 text-base font-semibold text-slate-950 [overflow-wrap:anywhere]">
                {item.term}
              </span>
              {type ? <span className="ml-auto shrink-0 text-sm text-slate-500">{type}</span> : null}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
