import { vi } from 'vitest'

export function voice(name: string, lang: string, isDefault = false) {
  return { name, lang, default: isDefault, localService: true, voiceURI: name } as SpeechSynthesisVoice
}

export class FakeUtterance {
  text: string
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  rate = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

// jsdom has no Web Speech API; install a fake whose voices and playback the test controls.
export function installSpeechSynthesis(initialVoices: SpeechSynthesisVoice[] = []) {
  let voices = initialVoices
  const events = new EventTarget()
  const spoken: FakeUtterance[] = []
  const synth = Object.assign(events, {
    speak: vi.fn((utterance: FakeUtterance) => {
      spoken.push(utterance)
    }),
    cancel: vi.fn(),
    getVoices: () => voices,
  })

  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)

  return {
    synth,
    spoken,
    lastUtterance: () => spoken[spoken.length - 1],
    setVoices(nextVoices: SpeechSynthesisVoice[]) {
      voices = nextVoices
      events.dispatchEvent(new Event('voiceschanged'))
    },
  }
}
