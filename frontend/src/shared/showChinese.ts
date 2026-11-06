const key = 'vocabflow.showChinese'

// Whether the Chinese meaning of a word's meaning is shown without being asked for. Off until turned on, and
// kept in this browser like the speech choices; a "中文" button on each meaning shows it for that word either way.
export function getShowChinese() {
  try {
    return window.localStorage.getItem(key) === 'on'
  } catch {
    return false
  }
}

export function setShowChinese(on: boolean) {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // The choice then lasts only until the page is closed.
  }
}
