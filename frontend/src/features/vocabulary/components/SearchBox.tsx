import { useEffect, useRef, useState } from 'react'
import { maxSearchLength } from '../hooks/listFilter'

const debounceMs = 300

interface SearchBoxProps {
  /** The search now in the address. */
  search: string
  onSearch: (text: string) => void
}

// The text is kept here while typing and reaches the address (and so the server) only after a
// short pause, so a fast typist does not send one request per letter.
export function SearchBox({ search, onSearch }: SearchBoxProps) {
  const [text, setText] = useState(search)
  const [seen, setSeen] = useState(search)
  const inputRef = useRef<HTMLInputElement>(null)
  const latest = useRef({ search, onSearch })
  useEffect(() => {
    latest.current = { search, onSearch }
  })

  // The address can change by itself (a word was added, a list was chosen): follow it, but never
  // overwrite what is being typed when the address only caught up with it.
  if (search !== seen) {
    setSeen(search)
    if (search !== text.trim()) {
      setText(search)
    }
  }

  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === latest.current.search) {
      return
    }
    const timer = window.setTimeout(() => latest.current.onSearch(trimmed), debounceMs)
    return () => window.clearTimeout(timer)
  }, [text])

  function clear() {
    setText('')
    latest.current.onSearch('')
    inputRef.current?.focus()
  }

  return (
    <form
      className="relative mb-3 sm:mb-4"
      onSubmit={(event) => {
        // Enter does not wait for the pause; it also closes the phone's keyboard.
        event.preventDefault()
        latest.current.onSearch(text.trim())
        inputRef.current?.blur()
      }}
      role="search"
    >
      <label className="sr-only" htmlFor="vocabulary-search">
        Search your vocabulary
      </label>
      <input
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-12 text-base text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 [&::-webkit-search-cancel-button]:hidden"
        enterKeyHint="search"
        id="vocabulary-search"
        maxLength={maxSearchLength}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search your words"
        ref={inputRef}
        spellCheck={false}
        type="search"
        value={text}
      />
      {text ? (
        <button
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          onClick={clear}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </form>
  )
}
