import { useEffect, useState } from 'react'
import { ApiClientError } from '../../../shared/api/apiClient'
import { useAddVocabulary } from '../../vocabulary/hooks/useVocabulary'
import type { GlossaryWord } from '../types/articles'

// "Words in This Story": each word can be added to the learner's list with one tap. With `withAddAll`
// a button adds every word at once; a word already in the list is skipped.
export function GlossaryList({ words, title = 'Words in this story', withAddAll = false }: { words: GlossaryWord[]; title?: string; withAddAll?: boolean }) {
  // Each press of "Add all" raises the signal, and every row that is not yet in the list adds itself.
  const [signal, setSignal] = useState(0)

  return (
    <section aria-label={title} className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{title}</h2>
        {withAddAll && words.length > 1 ? (
          <button
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={() => setSignal((value) => value + 1)}
            type="button"
          >
            Add all {words.length} words
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-2">
        {words.map((word) => (
          <GlossaryRow key={word.word} signal={signal} word={word} />
        ))}
      </ul>
    </section>
  )
}

function GlossaryRow({ word, signal }: { word: GlossaryWord; signal: number }) {
  const add = useAddVocabulary()
  const already = add.error instanceof ApiClientError && add.error.status === 409
  const done = add.isSuccess || already
  const idle = !add.isPending && !done && !add.isError

  useEffect(() => {
    if (signal > 0 && idle) {
      add.mutate({ term: word.word })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new press of "Add all" matters.
  }, [signal])

  return (
    <li className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <p className="min-w-0 flex-1 text-sm leading-6 text-slate-800">
        <span className="font-semibold text-slate-950">{word.word}</span>
        {word.zh ? <span className="text-slate-900"> – {word.zh}</span> : null} <span className="text-slate-700">{word.zh ? `· ${word.definition}` : `– ${word.definition}`}</span>
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
