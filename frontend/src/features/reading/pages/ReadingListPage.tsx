import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { Pagination } from '../../vocabulary/components/Pagination'
import { pageFromParam, paramFromPage } from '../../vocabulary/hooks/pageParam'
import { ReadingFilters } from '../components/ReadingFilters'
import { ReadingListItem } from '../components/ReadingListItem'
import { filterFromParam, filterQuery } from '../hooks/readingFilter'
import { useReadingList } from '../hooks/useReading'

export function ReadingListPage() {
  usePageTitle('Reading')
  const resultsRef = useRef<HTMLElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromParam(searchParams.get('page'))
  const filter = filterFromParam(searchParams.get('show'))
  const list = useReadingList(page, filterQuery(filter))

  function goToPage(nextPage: number) {
    const param = paramFromPage(nextPage)
    setSearchParams({
      ...(filter === 'all' ? {} : { show: filter }),
      ...(param === undefined ? {} : { page: param }),
    })
  }

  // The button that was used is disabled while the next page loads, or for good on the last page,
  // and a disabled button cannot keep focus. Park focus on the results instead.
  function changePage(nextPage: number) {
    resultsRef.current?.focus()
    goToPage(nextPage)
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reading</h1>
      <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
        Passages from the words you studied. Write one from the Study page when a day’s study is complete.
      </p>
      <section aria-label="Reading passages" className="mt-4 outline-none sm:mt-6" ref={resultsRef} tabIndex={-1}>
        <ReadingFilters current={filter} />
        {list.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading your passages…
          </p>
        ) : list.isError ? (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <p>{authErrorMessage(list.error, 'Unable to load your passages.')}</p>
            <button
              className="mt-2 font-semibold underline underline-offset-4"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
              type="button"
            >
              {list.isFetching ? 'Trying again…' : 'Try again'}
            </button>
          </div>
        ) : list.data.content.length === 0 && page > 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            <p>There is no page {page + 1} of your passages.</p>
            <button
              className="mt-2 font-semibold text-indigo-700 underline underline-offset-4"
              onClick={() => goToPage(0)}
              type="button"
            >
              Go to the first page
            </button>
          </div>
        ) : list.data.content.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            {filter === 'all'
              ? 'No passages yet. Finish a day’s study, then write one from the Study page.'
              : filter === 'unread'
                ? 'No unread passages.'
                : 'No passages read yet.'}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              {list.data.totalElements} {list.data.totalElements === 1 ? 'passage' : 'passages'}
            </p>
            <ul className={`space-y-3 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
              {list.data.content.map((passage) => (
                <ReadingListItem key={passage.id} passage={passage} />
              ))}
            </ul>
            <Pagination
              isLoading={list.isPlaceholderData}
              label="Reading pages"
              onPageChange={changePage}
              page={list.data.page}
              totalPages={list.data.totalPages}
            />
          </>
        )}
      </section>
    </div>
  )
}
