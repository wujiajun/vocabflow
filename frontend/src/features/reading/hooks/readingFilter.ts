export type ReadFilter = 'all' | 'unread' | 'read'

export const readFilters: { value: ReadFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

// The URL carries the filter (`?show=unread`); anything unusable there means no filter.
export function filterFromParam(value: string | null): ReadFilter {
  return readFilters.find((filter) => filter.value === value)?.value ?? 'all'
}

export function filterQuery(filter: ReadFilter) {
  return filter === 'all' ? '' : `&read=${filter === 'read'}`
}
