import { useContext } from 'react'
import { splitWords } from './wordTokens'
import { WordTapContext } from './wordTapContext'

// Every word responds to a tap by offering to add it. The words are not buttons, so reading the text
// is unchanged for a keyboard or a screen reader; "Add a word" in the navigation is their way in.
export function TappableText({ text }: { text: string }) {
  const tap = useContext(WordTapContext)

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
        return (
          <span
            className="cursor-pointer rounded-sm hover:bg-indigo-50 active:bg-indigo-100"
            key={index}
            onClick={() => {
              // A drag to select some text also ends in a click on a word.
              if (!window.getSelection()?.toString()) {
                tap.open(word)
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
