// Pronunciation uses the browser's Web Speech API, so which voices exist depends on the user's
// device and browser. We ask for American English and report honestly when it is not available.
const preferredLang = 'en-US'
const speechRate = 0.9

export type VoiceAccent = 'american' | 'other' | 'unknown'

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

function normalizedLang(voice: SpeechSynthesisVoice) {
  // Android reports "en_US", desktop browsers "en-US".
  return voice.lang.replace('_', '-').toLowerCase()
}

export function chooseVoice(voices: readonly SpeechSynthesisVoice[]) {
  const american = voices.filter((voice) => normalizedLang(voice) === 'en-us')
  if (american.length > 0) {
    return { voice: american.find((voice) => voice.default) ?? american[0], accent: 'american' as const }
  }

  const english = voices.filter((voice) => normalizedLang(voice).startsWith('en'))
  if (english.length > 0) {
    return { voice: english.find((voice) => voice.default) ?? english[0], accent: 'other' as const }
  }

  // Browsers often report no voices until they have loaded them, so "none yet" is not "no American voice".
  return { voice: undefined, accent: 'unknown' as const }
}

export function currentVoiceAccent(): VoiceAccent {
  return isSpeechSupported() ? chooseVoice(window.speechSynthesis.getVoices()).accent : 'unknown'
}

interface SpeakCallbacks {
  onStart: () => void
  onEnd: () => void
}

export function speakText(text: string, { onStart, onEnd }: SpeakCallbacks) {
  const synth = window.speechSynthesis
  synth.cancel()

  const { voice } = chooseVoice(synth.getVoices())
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang ?? preferredLang
  if (voice) {
    utterance.voice = voice
  }
  utterance.rate = speechRate
  utterance.onstart = onStart
  utterance.onend = onEnd
  utterance.onerror = onEnd

  synth.speak(utterance)
}

export function stopSpeaking() {
  window.speechSynthesis.cancel()
}
