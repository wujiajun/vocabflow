import { type FormEvent, type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from 'react'
import { ApiClientError } from '../../../shared/api/apiClient'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useAddVocabulary } from '../hooks/useVocabulary'

const maxTermLength = 255

// A small panel at the bottom of the screen, within reach of a thumb. It sits in the page after the
// content, stuck to the bottom of the window, so it adds room to scroll instead of covering the last
// controls. Remounted for every word, so it never shows the result for the previous one.
export function WordSheet({ initialWord, onClose }: { initialWord: string; onClose: () => void }) {
  const add = useAddVocabulary()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [term, setTerm] = useState(initialWord)
  const [validationError, setValidationError] = useState<string>()
  const [added, setAdded] = useState<string>()
  const typing = initialWord === ''

  // A tapped word is offered ready to add; an empty field is for typing into.
  useEffect(() => {
    ;(typing ? inputRef.current : submitRef.current)?.focus()
  }, [typing])

  // The button just pressed is gone once the word is added; without this, focus falls to the page
  // and Escape no longer reaches the panel.
  useEffect(() => {
    if (added !== undefined) {
      closeRef.current?.focus()
    }
  }, [added])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Not `disabled`: a disabled button that has focus drops it to the page while the request runs.
    if (add.isPending) {
      return
    }
    const trimmed = term.trim()
    if (!trimmed) {
      setValidationError('Enter a word or phrase.')
      inputRef.current?.focus()
      return
    }
    if (trimmed.length > maxTermLength) {
      setValidationError(`Keep it to ${maxTermLength} characters or fewer.`)
      inputRef.current?.focus()
      return
    }
    setValidationError(undefined)
    add.mutate({ term: trimmed }, { onSuccess: () => setAdded(trimmed) })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose()
    }
  }

  const error = validationError ?? (add.isError ? failureMessage(add.error, term.trim()) : undefined)

  return (
    <section
      aria-label="Add a word"
      className="sticky inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.12)] sm:px-8"
      onKeyDown={onKeyDown}
      role="dialog"
    >
      <div className="mx-auto max-w-5xl">
        {added !== undefined ? (
          <div className="flex items-center justify-between gap-4">
            <p role="status">Added “{added}” to your list.</p>
            <CloseButton onClose={onClose} ref={closeRef} />
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-800" htmlFor={`${id}-term`}>
              Add a word or phrase
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                aria-describedby={error ? `${id}-error` : undefined}
                aria-invalid={error ? true : undefined}
                autoComplete="off"
                className="block min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
                id={`${id}-term`}
                onChange={(event) => {
                  setTerm(event.target.value)
                  setValidationError(undefined)
                  add.reset()
                }}
                ref={inputRef}
                type="text"
                value={term}
              />
              <button
                className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-disabled:cursor-not-allowed aria-disabled:bg-indigo-300"
                aria-disabled={add.isPending}
                ref={submitRef}
                type="submit"
              >
                {add.isPending ? 'Adding…' : 'Add'}
              </button>
              <CloseButton onClose={onClose} />
            </div>
            {error ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" id={`${id}-error`} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  )
}

function CloseButton({ onClose, ref }: { onClose: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      onClick={onClose}
      type="button"
    >
      Close
    </button>
  )
}

function failureMessage(error: unknown, term: string) {
  if (error instanceof ApiClientError && error.status === 409) {
    return `“${term}” is already in your list.`
  }
  return authErrorMessage(error, 'Unable to add that word.')
}
