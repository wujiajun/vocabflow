import { type FormEvent, useRef, useState } from 'react'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useAddVocabulary } from '../hooks/useVocabulary'

const maxTermLength = 255

export function AddVocabularyForm({ onAdded }: { onAdded: () => void }) {
  const addVocabulary = useAddVocabulary()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [validationError, setValidationError] = useState<string>()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTerm = term.trim()

    if (!trimmedTerm) {
      setValidationError('Enter a word or phrase.')
      return
    }

    if (trimmedTerm.length > maxTermLength) {
      setValidationError(`Keep it to ${maxTermLength} characters or fewer.`)
      return
    }

    setValidationError(undefined)
    addVocabulary.mutate(
      { term: trimmedTerm },
      {
        onSuccess: () => {
          setTerm('')
          onAdded()
          inputRef.current?.focus()
        },
      },
    )
  }

  const error =
    validationError || (addVocabulary.isError ? authErrorMessage(addVocabulary.error, 'Unable to add that word.') : undefined)

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" noValidate onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-800" htmlFor="new-vocabulary-term">
        New word or phrase
      </label>
      <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
        <input
          autoComplete="off"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
          id="new-vocabulary-term"
          onChange={(event) => setTerm(event.target.value)}
          ref={inputRef}
          type="text"
          value={term}
        />
        <button
          className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={addVocabulary.isPending}
          type="submit"
        >
          {addVocabulary.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error ? (
        <p aria-live="polite" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
