import { type ReactNode, useMemo, useRef, useState } from 'react'
import { WordSheet } from './WordSheet'
import { WordTapContext } from './wordTapContext'

// Holds the one panel for adding a word, so a tap on any word in the app, or the "Add a word"
// button, opens the same place. Closing returns focus to where it was, if that was a control.
export function WordSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ word: string; opening: number }>()
  const opener = useRef<Element | null>(null)
  const openings = useRef(0)

  const tap = useMemo(
    () => ({
      open: (word = '') => {
        if (!target) {
          opener.current = document.activeElement
        }
        openings.current += 1
        setTarget({ word, opening: openings.current })
      },
    }),
    [target],
  )

  function close() {
    setTarget(undefined)
    if (opener.current instanceof HTMLElement && opener.current.isConnected && opener.current !== document.body) {
      opener.current.focus()
    }
    opener.current = null
  }

  return (
    <WordTapContext.Provider value={tap}>
      {children}
      {target ? <WordSheet initialWord={target.word} key={target.opening} onClose={close} /> : null}
    </WordTapContext.Provider>
  )
}
