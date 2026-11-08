import type { LearningStatus } from '../types/vocabulary'

export type ListFilter = 'all' | 'due' | 'new' | 'learning' | 'familiar' | 'mastered'

export const listFilters: { value: ListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due today' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'mastered', label: 'Mastered' },
]

const statuses: Partial<Record<ListFilter, LearningStatus>> = {
  new: 'NEW',
  learning: 'LEARNING',
  familiar: 'FAMILIAR',
  mastered: 'MASTERED',
}

// The URL carries the filter (`?show=due`); anything unusable there means no filter.
export function filterFromParam(value: string | null): ListFilter {
  return listFilters.find((filter) => filter.value === value)?.value ?? 'all'
}

// The URL carries the search text (`?q=cheese`). The server reads it as plain text, so only the
// surrounding spaces are cut here; a search of only spaces is no search.
export function searchFromParam(value: string | null) {
  return (value ?? '').trim().slice(0, maxSearchLength)
}

export const maxSearchLength = 100

export function filterQuery(filter: ListFilter, today: string, search = '') {
  const text = search ? `&q=${encodeURIComponent(search)}` : ''
  if (filter === 'due') {
    return `&due=${today}${text}`
  }
  const status = statuses[filter]
  return (status ? `&status=${status}` : '') + text
}

// The address of the list for a filter and a search; the first page, so no page number.
export function listPath(filter: ListFilter, search = '') {
  const params = new URLSearchParams()
  if (filter !== 'all') {
    params.set('show', filter)
  }
  if (search) {
    params.set('q', search)
  }
  const query = params.toString()
  return query ? `/app/vocabulary?${query}` : '/app/vocabulary'
}
