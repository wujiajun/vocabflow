import { type ReactNode, useMemo, useRef, useState } from 'react'
import type { TapSource } from '../types/vocabulary'
import { WordSheet } from './WordSheet'
import { WordTapContext } from './wordTapContext'

// Holds the one panel for adding a word, so a tap on any word in the app, or the "Add a word"
// button, opens the same place. Closing returns focus to where it was, if that was a control.
export function WordSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ word: string; spot?: string; source?: TapSource; opening: number }>()
  const opener = useRef<Element | null>(null)
  const openings = useRef(0)

  const tap = useMemo(
    () => ({
      open: (word = '', spot?: string, source?: TapSource) => {
        if (!target) {
          opener.current = document.activeElement
        }
        openings.current += 1
        setTarget({ word, spot, source, opening: openings.current })
      },
      spot: target?.spot,
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
      {target ? <WordSheet initialWord={target.word} source={target.source} key={target.opening} onClose={close} /> : null}
    </WordTapContext.Provider>
  )
}
