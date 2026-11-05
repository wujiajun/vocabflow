import { useContext, useId } from 'react'
import { WordTapContext } from './wordTapContext'

// A whole phrase (a combination, a synonym) that responds to a tap by offering to add it as it is,
// where TappableText offers one word at a time. Like the words, it is not a button.
export function TappablePhrase({ text }: { text: string }) {
  const tap = useContext(WordTapContext)
  const spot = useId()

  if (!tap) {
    return <>{text}</>
  }

  const selected = tap.spot === spot
  return (
    <span
      className={`cursor-pointer rounded-sm ${selected ? 'bg-indigo-200' : 'hover:bg-indigo-50 active:bg-indigo-100'}`}
      data-selected={selected ? true : undefined}
      onClick={() => {
        // A drag to select some text also ends in a click.
        if (!window.getSelection()?.toString()) {
          tap.open(text, spot)
        }
      }}
    >
      {text}
    </span>
  )
}
