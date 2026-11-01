const key = 'vocabflow.speakOnAnswer'

// Whether the word is read aloud when the answer on a study card is shown. On unless turned off; kept
// in this browser, because it depends on where and on what the learner is studying.
export function getSpeakOnAnswer() {
  try {
    return window.localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

export function setSpeakOnAnswer(on: boolean) {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
