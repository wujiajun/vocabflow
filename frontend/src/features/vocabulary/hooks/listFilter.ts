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

export function filterQuery(filter: ListFilter, today: string) {
  if (filter === 'due') {
    return `&due=${today}`
  }
  const status = statuses[filter]
  return status ? `&status=${status}` : ''
}
