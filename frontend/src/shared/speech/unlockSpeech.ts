import { isSpeechSupported } from './pronunciation'

// iPhone browsers let the page speak only from inside a press (a tap or a click), and a drag that ends
// in a release counts as neither. Once the page has spoken from a press, later speech is allowed, so the
// first touch anywhere says one silent syllable; after that the games and the cards can speak on their own.
// Only touches do it: on a computer the silent syllable is not needed, and Chrome can then drop the word
// that is spoken in the same click.
export function installSpeechUnlock() {
  if (!isSpeechSupported()) {
    return
  }

  function unlock() {
    document.removeEventListener('touchend', unlock, true)
    const utterance = new SpeechSynthesisUtterance('.')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)
  }

  document.addEventListener('touchend', unlock, true)
}
