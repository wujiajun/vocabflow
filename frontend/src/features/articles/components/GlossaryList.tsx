import { ApiClientError } from '../../../shared/api/apiClient'
import { useAddVocabulary } from '../../vocabulary/hooks/useVocabulary'
import type { GlossaryWord } from '../types/articles'

// "Words in This Story": each word can be added to the learner's list with one tap.
export function GlossaryList({ words }: { words: GlossaryWord[] }) {
  return (
    <section aria-label="Words in this story" className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Words in this story</h2>
      <ul className="mt-2 space-y-2">
        {words.map((word) => (
          <GlossaryRow key={word.word} word={word} />
        ))}
      </ul>
    </section>
  )
}

function GlossaryRow({ word }: { word: GlossaryWord }) {
  const add = useAddVocabulary()
  const already = add.error instanceof ApiClientError && add.error.status === 409
  const done = add.isSuccess || already

  return (
    <li className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <p className="min-w-0 flex-1 text-sm leading-6 text-slate-800">
        <span className="font-semibold text-slate-950">{word.word}</span> <span className="text-slate-700">– {word.definition}</span>
        {add.isError && !already ? (
          <span className="block text-rose-800" role="alert">
            Couldn’t add “{word.word}”. Try again.
          </span>
        ) : null}
      </p>
      {done ? (
        <span className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-emerald-800" role="status">
          {already ? 'In your list' : 'Added ✓'}
        </span>
      ) : (
        <button
          aria-label={`Add ${word.word} to your list`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          // Not `disabled`: a disabled button that has focus drops it to the page while the request runs.
          onClick={() => !add.isPending && add.mutate({ term: word.word })}
          type="button"
        >
          {add.isPending ? 'Adding…' : '+ Add'}
        </button>
      )}
    </li>
  )
}
