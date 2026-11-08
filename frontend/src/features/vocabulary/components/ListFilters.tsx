import { Link } from 'react-router'
import { type ListFilter, listFilters, listPath } from '../hooks/listFilter'

export function ListFilters({ current, search = '' }: { current: ListFilter; search?: string }) {
  return (
    <nav aria-label="Filter vocabulary" className="mb-3 flex flex-wrap gap-1.5 sm:mb-4 sm:gap-2">
      {listFilters.map(({ value, label }) => (
        <Link
          aria-current={value === current ? 'true' : undefined}
          className="rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:px-3 font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-[current]:border-indigo-700 aria-[current]:bg-indigo-700 aria-[current]:text-white"
          key={value}
          replace
          to={listPath(value, search)}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
