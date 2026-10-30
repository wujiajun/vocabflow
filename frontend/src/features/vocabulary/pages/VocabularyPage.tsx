import { useState } from 'react'
import { authErrorMessage } from '../../auth/components/AuthError'
import { AddVocabularyForm } from '../components/AddVocabularyForm'
import { Pagination } from '../components/Pagination'
import { VocabularyListItem } from '../components/VocabularyListItem'
import { useVocabularyList } from '../hooks/useVocabulary'

export function VocabularyPage() {
  const [page, setPage] = useState(0)
  const list = useVocabularyList(page)

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Your vocabulary</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        Save words and phrases as you meet them. Newest first.
      </p>
      <div className="mt-6">
        <AddVocabularyForm onAdded={() => setPage(0)} />
      </div>
      <section aria-label="Saved vocabulary" className="mt-8">
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
        ) : list.data.content.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            No words yet. Add your first word or phrase above.
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
              onPageChange={setPage}
              page={list.data.page}
              totalPages={list.data.totalPages}
            />
          </>
        )}
      </section>
    </div>
  )
}
