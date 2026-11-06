import { createContext } from 'react'
import type { TapSource } from '../types/vocabulary'

export interface WordTap {
  // Opens the panel for adding a word. A word given is filled in; without one the field starts empty.
  // `source` is kept with the word if it is added as it stands.
  // `spot` names the place in the text that was tapped, so that one occurrence can be highlighted.
  open: (word?: string, spot?: string, source?: TapSource) => void
  // The spot of the tapped word while the panel is open.
  spot: string | undefined
}

// Absent outside the app shell, where words in a text are then not tappable.
export const WordTapContext = createContext<WordTap | null>(null)
