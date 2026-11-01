import { useContext, useId } from 'react'
import { splitWords } from './wordTokens'
import { WordTapContext } from './wordTapContext'

// Every word responds to a tap by offering to add it. The words are not buttons, so reading the text
// is unchanged for a keyboard or a screen reader; "Add a word" in the navigation is their way in.
export function TappableText({ text }: { text: string }) {
  const tap = useContext(WordTapContext)
  const id = useId()

  if (!tap) {
    return <>{text}</>
  }

  return (
    <>
      {splitWords(text).map((part, index) => {
        const { word } = part
        if (word === undefined) {
          return part.text
        }
        const spot = `${id}-${index}`
        const selected = tap.spot === spot
        return (
          <span
            className={`cursor-pointer rounded-sm ${selected ? 'bg-indigo-200' : 'hover:bg-indigo-50 active:bg-indigo-100'}`}
            data-selected={selected ? true : undefined}
            key={index}
            onClick={() => {
              // A drag to select some text also ends in a click on a word.
              if (!window.getSelection()?.toString()) {
                tap.open(word, spot)
              }
            }}
          >
            {part.text}
          </span>
        )
      })}
    </>
  )
}
