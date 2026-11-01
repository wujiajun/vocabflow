const key = 'vocabflow.speakOnAnswer'

// When the word on a study card is read aloud on its own: as the card appears, when the answer is
// shown, or never.
export type SpeakMode = 'card' | 'answer' | 'off'

// Kept in this browser, because it depends on where and on what the learner is studying. The key and
// its older "on" and "off" values stay, so a choice made before the third option still holds.
export function getSpeakMode(): SpeakMode {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === 'off' || stored === 'card' ? stored : 'answer'
  } catch {
    return 'answer'
  }
}

export function setSpeakMode(mode: SpeakMode) {
  try {
    window.localStorage.setItem(key, mode === 'answer' ? 'on' : mode)
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
