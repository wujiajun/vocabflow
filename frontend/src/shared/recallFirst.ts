const key = 'vocabflow.recallFirst'

// Whether a study card shows the picture of a word first and asks which word it is, instead of
// showing the word. Starts on, and is kept in this browser like the speech choices.
export function getRecallFirst() {
  try {
    return window.localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

export function setRecallFirst(on: boolean) {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
