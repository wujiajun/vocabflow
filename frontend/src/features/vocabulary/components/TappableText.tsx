import { useContext, useId } from 'react'
import { splitWords } from './wordTokens'
import { WordTapContext } from './wordTapContext'

// Every word responds to a tap by offering to add it. The words are not buttons, so reading the text
// is unchanged for a keyboard or a screen reader; "Add a word" in the navigation is their way in.
export function TappableText({
  text,
  sentence,
  source,
  emphasis,
}: {
  text: string
  // The whole sentence the text belongs to, when the text is only a piece of it. A tapped word then
  // keeps this sentence with it. Without it, a tap saves nothing but the word.
  sentence?: string
  // Where the sentence comes from: a title and an in-app path to go back to.
  source?: { title?: string; link?: string }
  // A word written in the text to show in bold (the form the learner tapped).
  emphasis?: string | null
}) {
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
        const bold = emphasis && part.text.toLowerCase() === emphasis.toLowerCase()
        return (
          <span
            className={`cursor-pointer rounded-sm ${bold ? 'font-semibold text-slate-950' : ''} ${selected ? 'bg-indigo-200' : 'hover:bg-indigo-50 active:bg-indigo-100'}`}
            data-opens-word-sheet=""
            data-selected={selected ? true : undefined}
            key={index}
            onClick={() => {
              // A drag to select some text also ends in a click on a word.
              if (!window.getSelection()?.toString()) {
                tap.open(word, spot, sentence ? { sentence, form: part.text.replaceAll('’', "'"), ...source } : undefined)
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
