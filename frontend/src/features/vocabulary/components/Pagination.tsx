interface PaginationProps {
  page: number
  totalPages: number
  isLoading: boolean
  onPageChange: (page: number) => void
  label?: string
}

const buttonClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50'

export function Pagination({ page, totalPages, isLoading, onPageChange, label = 'Vocabulary pages' }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav aria-label={label} className="mt-6 flex items-center justify-between gap-3">
      <button className={buttonClass} disabled={page === 0 || isLoading} onClick={() => onPageChange(page - 1)} type="button">
        Previous
      </button>
      <p className="text-sm text-slate-600" role="status">
        Page {page + 1} of {totalPages}
      </p>
      <button
        className={buttonClass}
        disabled={page + 1 >= totalPages || isLoading}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </nav>
  )
}
