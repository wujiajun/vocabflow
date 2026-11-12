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

// Apple's joke voices and the old Eloquence ones (robotic) are never chosen or offered.
const noveltyNames = new Set(
  [
    'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Good News', 'Jester', 'Organ', 'Superstar',
    'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Fred', 'Junior', 'Ralph', 'Kathy',
    'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
  ].map((name) => name.toLowerCase()),
)

function baseName(voice: SpeechSynthesisVoice) {
  return voice.name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()
}

/** English voices worth hearing: not the joke or robotic ones. */
export function isUsableVoice(voice: SpeechSynthesisVoice) {
  return (
    normalizedLang(voice).startsWith('en') && !noveltyNames.has(baseName(voice)) && !voice.voiceURI.toLowerCase().includes('eloquence')
  )
}

/**
 * How natural a voice sounds. Apple's downloadable voices say Premium or Enhanced in their name or id
 * (`com.apple.voice.premium.en-US.Ava`); Edge's online voices say Natural, some others Neural.
 */
export function voiceQuality(voice: SpeechSynthesisVoice): 0 | 1 | 2 {
  const id = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  if (id.includes('premium') || id.includes('natural')) return 2
  if (id.includes('enhanced') || id.includes('neural')) return 1
  return 0
}

function rankVoices(voices: readonly SpeechSynthesisVoice[], lang?: string) {
  return voices
    .filter(isUsableVoice)
    .map((voice, order) => ({ voice, order }))
    .sort(
      (a, b) =>
        Number(normalizedLang(b.voice) === lang) - Number(normalizedLang(a.voice) === lang) ||
        voiceQuality(b.voice) - voiceQuality(a.voice) ||
        Number(b.voice.default) - Number(a.voice.default) ||
        a.order - b.order,
    )
    .map(({ voice }) => voice)
}

function accentOf(voice: SpeechSynthesisVoice) {
  return normalizedLang(voice) === 'en-us' ? ('american' as const) : ('other' as const)
}

function stored(voices: readonly SpeechSynthesisVoice[], uri: string) {
  return uri ? voices.find((voice) => voice.voiceURI === uri && isUsableVoice(voice)) : undefined
}

/**
 * The voice for reading: the one picked in Settings when this device still has it, otherwise the most natural
 * American voice (Premium, then Enhanced, then the default), otherwise the most natural other English voice.
 */
export function chooseVoice(voices: readonly SpeechSynthesisVoice[], picked = getVoiceChoice('first')) {
  // No voice is named, so the device uses its own English voice: on an iPhone the one set in Spoken Content, which
  // can be a downloaded Enhanced or Premium voice that iOS never lists to web pages. So that is automatic there.
  if (picked === systemVoice || (picked === '' && isAppleMobile())) {
    return { voice: undefined, accent: 'american' as const }
  }
  const chosen = stored(voices, picked) ?? rankVoices(voices, 'en-us')[0]
  if (chosen) {
    return { voice: chosen, accent: accentOf(chosen) }
  }

  // Browsers often report no voices until they have loaded them, so "none yet" is not "no American voice".
  return { voice: undefined, accent: 'unknown' as const }
}

/**
 * The second voice in a conversation (the learner's own lines): the one picked in Settings, otherwise the most
 * natural other voice, in the main voice's language if there is one. With the phone's own voice as the main one,
 * the best listed voice. None means the main voice at a lower pitch.
 */
export function chooseSecondVoice(voices: readonly SpeechSynthesisVoice[], picked = getVoiceChoice('second')) {
  const first = chooseVoice(voices).voice
  const chosen = stored(voices, picked)
  if (chosen && chosen.voiceURI !== first?.voiceURI) return chosen
  if (!first) return rankVoices(voices, 'en-us')[0]
  return rankVoices(voices, normalizedLang(first)).find(
    (voice) => voice.voiceURI !== first.voiceURI && baseName(voice) !== baseName(first),
  )
}

export function currentVoiceAccent(): VoiceAccent {
  return isSpeechSupported() ? chooseVoice(window.speechSynthesis.getVoices()).accent : 'unknown'
}

/** iPhone and iPad, including an iPad that says it is a Mac. */
export function isAppleMobile() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

/** The main voice (everything, and the other person in a conversation) or the second (the learner's own lines). */
export type VoiceRole = 'first' | 'second'
const choiceKeys: Record<VoiceRole, string> = { first: 'vocabflow.voice', second: 'vocabflow.secondVoice' }
const secondPitch = 0.75

/**
 * Picked in Settings to name no voice at all. iOS does not show web pages the Enhanced and Premium voices a
 * learner downloads, but a page that names no voice may get the one chosen in Spoken Content.
 */
export const systemVoice = 'system'

/** The voice picked in Settings for this browser (its voiceURI, or `systemVoice`); empty means automatic. */
export function getVoiceChoice(role: VoiceRole) {
  try {
    return window.localStorage.getItem(choiceKeys[role]) ?? ''
  } catch {
    return ''
  }
}

export function setVoiceChoice(role: VoiceRole, uri: string) {
  try {
    if (uri) window.localStorage.setItem(choiceKeys[role], uri)
    else window.localStorage.removeItem(choiceKeys[role])
  } catch {
    // The choice then lasts only until the page is closed.
  }
}

interface SpeakCallbacks {
  onStart: () => void
  onEnd: () => void
  /** Called before onEnd when the browser reports an error (for example `interrupted`, `canceled`). */
  onError?: (reason: string) => void
  /** Pause and resume as the browser reports them (a phone may pause speech on its own). */
  onPauseResume?: (event: 'pause' | 'resume') => void
  /** The second speaker of a conversation gets its own voice, or a lower pitch when the device has one voice. */
  role?: VoiceRole
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

export function speakText(text: string, { onStart, onEnd, onError, onPauseResume, role }: SpeakCallbacks) {
  const synth = window.speechSynthesis
  const request = ++latestRequest
  const interrupting = synth.speaking || synth.pending
  finishCurrent()
  synth.cancel()

  function start() {
    if (request !== latestRequest) {
      return
    }
    const voices = synth.getVoices()
    const second = role === 'second' ? chooseSecondVoice(voices) : undefined
    const voice = second ?? chooseVoice(voices).voice
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice?.lang ?? preferredLang
    if (voice) {
      utterance.voice = voice
    }
    utterance.rate = speechRate
    if (role === 'second' && !second) {
      utterance.pitch = secondPitch
    }
    utterance.onstart = onStart
    utterance.onpause = () => onPauseResume?.('pause')
    utterance.onresume = () => onPauseResume?.('resume')
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
  window.speechSynthesis?.cancel()
}
