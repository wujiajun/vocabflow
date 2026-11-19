import { useContext, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { WordTapContext } from './wordTapContext'

// A link such as /app/vocabulary?add=resilient opens the add-word panel with that word filled in, so that a
// shortcut on the computer (a macOS Quick Action on the selected text) can hand a word to the app. The
// parameter is taken out of the address at once, so a reload or a back step does not open the panel again.
export function AddFromLink() {
  const tap = useContext(WordTapContext)
  const [params, setParams] = useSearchParams()
  const link = params.get('add')
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (link === null) {
      handled.current = null
      return
    }
    if (!tap || handled.current === link) return
    handled.current = link
    const word = link.replace(/\s+/g, ' ').trim()
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('add')
        return next
      },
      { replace: true },
    )
    if (word) tap.open(word)
  }, [link, tap, setParams])

  return null
}
