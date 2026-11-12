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
  /** Called before onEnd when the browser reports an error (for example `interrupted`, `canceled`). */
  onError?: (reason: string) => void
}

// Chrome on a computer drops an utterance that is spoken right after a cancel() of one that is still
// playing, so after stopping something the new word waits a moment. Each call supersedes the earlier one.
const restartDelayMs = 80
let latestRequest = 0
// The word being spoken. Kept here because Chrome may collect an utterance that nothing refers to and then
// never report its end, which would leave a pronunciation button showing "speaking" for good.
let current: { utterance: SpeechSynthesisUtterance; onEnd: () => void } | null = null

// Tell whoever asked for the word that is being replaced or stopped that it is over, once.
function finishCurrent() {
  const finished = current
  current = null
  finished?.onEnd()
}

export function speakText(text: string, { onStart, onEnd, onError }: SpeakCallbacks) {
  const synth = window.speechSynthesis
  const request = ++latestRequest
  const interrupting = synth.speaking || synth.pending
  finishCurrent()
  synth.cancel()

  function start() {
    if (request !== latestRequest) {
      return
    }
    const { voice } = chooseVoice(synth.getVoices())
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice?.lang ?? preferredLang
    if (voice) {
      utterance.voice = voice
    }
    utterance.rate = speechRate
    utterance.onstart = onStart
    const ended = () => {
      if (current?.utterance === utterance) {
        finishCurrent()
      }
    }
    utterance.onend = ended
    utterance.onerror = (event) => {
      onError?.((event as SpeechSynthesisErrorEvent | undefined)?.error ?? 'error')
      ended()
    }

    current = { utterance, onEnd }
    synth.resume()
    synth.speak(utterance)
  }

  if (interrupting) {
    window.setTimeout(start, restartDelayMs)
  } else {
    start()
  }
}

export function stopSpeaking() {
  latestRequest++
  finishCurrent()
  window.speechSynthesis.cancel()
}
