import { useContext } from 'react'
import { WordTapContext } from './wordTapContext'

// The way to add a word without tapping one in a text, which only a pointer can do.
export function AddWordButton() {
  const tap = useContext(WordTapContext)

  if (!tap) {
    return null
  }

  return (
    <button
      aria-label="Add a word"
      className="ml-auto pb-2.5 text-sm font-semibold whitespace-nowrap text-indigo-700 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      onClick={() => tap.open()}
      type="button"
    >
      {/* Short on a phone, where the navigation is crowded. */}
      <span aria-hidden="true" className="sm:hidden">
        + Add
      </span>
      <span aria-hidden="true" className="hidden sm:inline">
        Add a word
      </span>
    </button>
  )
}
