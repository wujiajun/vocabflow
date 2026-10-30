import type { EnrichmentStatus } from '../types/vocabulary'

export function EnrichmentBadge({ status }: { status: EnrichmentStatus }) {
  if (status === 'COMPLETED') {
    return null
  }

  const failed = status === 'FAILED'

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        failed ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'
      }`}
    >
      {failed ? 'Details unavailable' : 'Enriching…'}
    </span>
  )
}
