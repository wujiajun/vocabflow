import { isSpeechSupported } from './pronunciation'

// iPhone browsers let the page speak only from inside a press (a tap or a click), and a drag that ends
// in a release counts as neither. Once the page has spoken from a press, later speech is allowed, so the
// first press anywhere says one silent syllable; after that the games and the cards can speak on their own.
export function installSpeechUnlock() {
  if (!isSpeechSupported()) {
    return
  }

  function unlock() {
    document.removeEventListener('touchend', unlock, true)
    document.removeEventListener('click', unlock, true)
    const utterance = new SpeechSynthesisUtterance('.')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)
  }

  document.addEventListener('touchend', unlock, true)
  document.addEventListener('click', unlock, true)
}
