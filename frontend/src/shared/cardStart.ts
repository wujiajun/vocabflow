export type CardStart = 'word' | 'picture' | 'sound'

const key = 'vocabflow.cardStart'
// The earlier on/off switch for the picture; a browser that only has that one keeps its choice.
const earlierKey = 'vocabflow.recallFirst'

// How a study card starts: with the word, with the picture of it (which word is this?), or with the
// word only heard (what does it mean?). Kept in this browser like the speech choices, and starts on
// the picture, which a word without one skips.
export function getCardStart(): CardStart {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === 'word' || stored === 'picture' || stored === 'sound') {
      return stored
    }
    return window.localStorage.getItem(earlierKey) === 'off' ? 'word' : 'picture'
  } catch {
    return 'picture'
  }
}

export function setCardStart(start: CardStart) {
  try {
    window.localStorage.setItem(key, start)
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
