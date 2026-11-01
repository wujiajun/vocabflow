import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { useUserToday } from '../../auth/hooks/useUserToday'
import { authErrorMessage } from '../../auth/components/AuthError'
import { AddVocabularyForm } from '../components/AddVocabularyForm'
import { ListFilters } from '../components/ListFilters'
import { Pagination } from '../components/Pagination'
import { VocabularyListItem } from '../components/VocabularyListItem'
import { filterFromParam, filterQuery } from '../hooks/listFilter'
import { pageFromParam, paramFromPage } from '../hooks/pageParam'
import { useVocabularyList } from '../hooks/useVocabulary'

export function VocabularyPage() {
  usePageTitle('Your vocabulary')
  const resultsRef = useRef<HTMLElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromParam(searchParams.get('page'))
  const filter = filterFromParam(searchParams.get('show'))
  const list = useVocabularyList(page, filterQuery(filter, useUserToday()))

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
      <h1 className="text-3xl font-bold tracking-tight">Your vocabulary</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        Save words and phrases as you meet them. Newest first.
      </p>
      <div className="mt-6">
        {/* Back to the unfiltered first page, where the new word is sure to be visible. */}
        <AddVocabularyForm onAdded={() => setSearchParams({})} />
      </div>
      <section aria-label="Saved vocabulary" className="mt-8 outline-none" ref={resultsRef} tabIndex={-1}>
        <ListFilters current={filter} />
        {list.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading your vocabulary…
          </p>
        ) : list.isError ? (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <p>{authErrorMessage(list.error, 'Unable to load your vocabulary.')}</p>
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
            <p>There is no page {page + 1} of your vocabulary.</p>
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
            {filter === 'all' ? 'No words yet. Add your first word or phrase above.' : 'No words in this list.'}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              {list.data.totalElements} {list.data.totalElements === 1 ? 'entry' : 'entries'}
            </p>
            <ul className={`space-y-3 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
              {list.data.content.map((entry) => (
                <VocabularyListItem entry={entry} key={entry.id} />
              ))}
            </ul>
            <Pagination
              isLoading={list.isPlaceholderData}
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
