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
      className="ml-auto pb-2.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      onClick={() => tap.open()}
      type="button"
    >
      Add a word
    </button>
  )
}
