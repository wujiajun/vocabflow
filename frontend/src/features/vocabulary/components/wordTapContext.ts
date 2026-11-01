import { createContext } from 'react'

export interface WordTap {
  // Opens the panel for adding a word. A word given is filled in; without one the field starts empty.
  open: (word?: string) => void
}

// Absent outside the app shell, where words in a text are then not tappable.
export const WordTapContext = createContext<WordTap | null>(null)
