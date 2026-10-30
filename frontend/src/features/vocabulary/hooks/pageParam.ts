const maxPageNumber = 100_000

// The URL carries 1-based page numbers (`?page=2`); the API and the hooks use 0-based pages.
// Anything unusable in the URL means the first page.
export function pageFromParam(value: string | null) {
  if (value === null || !/^\d+$/.test(value)) {
    return 0
  }

  const pageNumber = Number(value)
  return pageNumber < 1 ? 0 : Math.min(pageNumber, maxPageNumber) - 1
}

export function paramFromPage(page: number) {
  return page <= 0 ? undefined : String(page + 1)
}
