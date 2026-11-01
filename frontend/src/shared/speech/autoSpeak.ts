const answerKey = 'vocabflow.speakOnAnswer'
const cardKey = 'vocabflow.speakOnCard'

// Whether the word on a study card is read aloud on its own, as the card appears and when its answer
// is shown. The two are separate, so a learner can have either, both or neither. Kept in this browser,
// because it depends on where and on what the learner is studying.
export function getSpeakOnAnswer() {
  try {
    return window.localStorage.getItem(answerKey) !== 'off'
  } catch {
    return true
  }
}

export function setSpeakOnAnswer(on: boolean) {
  store(answerKey, on)
}

export function getSpeakOnCard() {
  try {
    return window.localStorage.getItem(cardKey) === 'on'
  } catch {
    return false
  }
}

export function setSpeakOnCard(on: boolean) {
  store(cardKey, on)
}

function store(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
