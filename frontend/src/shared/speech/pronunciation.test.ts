import { afterEach, describe, expect, test, vi } from 'vitest'
import { installSpeechSynthesis, voice } from '../../test/speech'
import {
  chooseSecondVoice,
  chooseVoice,
  currentVoiceAccent,
  getVoiceChoice,
  isSpeechSupported,
  isUsableVoice,
  setVoiceChoice,
  speakText,
  stopSpeaking,
  systemVoice,
  voiceQuality,
} from './pronunciation'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('prefers an American voice even when another English voice is listed first', () => {
  const british = voice('Daniel', 'en-GB')
  const american = voice('Samantha', 'en-US')

  expect(chooseVoice([british, american])).toEqual({ voice: american, accent: 'american' })
})

test('recognises the underscore form some Android devices report', () => {
  const american = voice('Android US', 'en_US')

  expect(chooseVoice([voice('Android GB', 'en_GB'), american]).voice).toBe(american)
})

test('picks the default American voice when there are several', () => {
  const first = voice('First', 'en-US')
  const preferred = voice('Preferred', 'en-US', true)

  expect(chooseVoice([first, preferred]).voice).toBe(preferred)
})

test('falls back to another English voice and says it is not American', () => {
  const british = voice('Daniel', 'en-GB')

  expect(chooseVoice([voice('Amélie', 'fr-FR'), british])).toEqual({ voice: british, accent: 'other' })
})

test('reports an unknown accent while no voice is known yet', () => {
  expect(chooseVoice([])).toEqual({ voice: undefined, accent: 'unknown' })
  expect(chooseVoice([voice('Amélie', 'fr-FR')]).accent).toBe('unknown')
})

test('detects whether the browser can speak at all', () => {
  expect(isSpeechSupported()).toBe(false)
  expect(currentVoiceAccent()).toBe('unknown')

  installSpeechSynthesis([voice('Samantha', 'en-US')])

  expect(isSpeechSupported()).toBe(true)
  expect(currentVoiceAccent()).toBe('american')
})

test('speaks the text with the chosen voice, its language and a slightly slower rate', () => {
  const american = voice('Samantha', 'en-US')
  const speech = installSpeechSynthesis([voice('Daniel', 'en-GB'), american])

  speakText('figure out', { onStart: vi.fn(), onEnd: vi.fn() })

  expect(speech.synth.cancel).toHaveBeenCalledBefore(speech.synth.speak)
  expect(speech.lastUtterance()).toMatchObject({ text: 'figure out', lang: 'en-US', voice: american, rate: 0.9 })
})

test('asks for American English when no voice list is available yet', () => {
  const speech = installSpeechSynthesis([])

  speakText('overwhelmed', { onStart: vi.fn(), onEnd: vi.fn() })

  expect(speech.lastUtterance()).toMatchObject({ text: 'overwhelmed', lang: 'en-US', voice: null })
})

test('reports when playback starts and ends, once, whether it ends or fails', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const onStart = vi.fn()
  const onEnd = vi.fn()

  speakText('overwhelmed', { onStart, onEnd })
  const utterance = speech.lastUtterance()
  utterance.onstart?.()
  utterance.onend?.()
  utterance.onerror?.()

  expect(onStart).toHaveBeenCalledTimes(1)
  expect(onEnd).toHaveBeenCalledTimes(1)
})

test('a word that is stopped or replaced is reported as ended even if the browser never says so', () => {
  installSpeechSynthesis([voice('Samantha', 'en-US')])
  const first = vi.fn()
  const second = vi.fn()

  speakText('one', { onStart: vi.fn(), onEnd: first })
  speakText('two', { onStart: vi.fn(), onEnd: second })
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).not.toHaveBeenCalled()

  stopSpeaking()
  expect(second).toHaveBeenCalledTimes(1)
})

test('stops anything being spoken', () => {
  const speech = installSpeechSynthesis()

  stopSpeaking()

  expect(speech.synth.cancel).toHaveBeenCalledTimes(1)
})

describe('speakText after something is already playing', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('waits a moment after the cancel, and only the newest word is spoken', () => {
    vi.useFakeTimers()
    const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
    speech.synth.speaking = true
    const callbacks = { onStart: vi.fn(), onEnd: vi.fn() }

    speakText('first', callbacks)
    speakText('second', callbacks)

    expect(speech.synth.cancel).toHaveBeenCalledTimes(2)
    expect(speech.spoken).toHaveLength(0)
    vi.advanceTimersByTime(200)
    expect(speech.spoken.map((utterance) => utterance.text)).toEqual(['second'])
  })
})

describe('natural voices', () => {
  const compact = voice('Samantha', 'en-US', true, 'com.apple.voice.compact.en-US.Samantha')
  const ava = voice('Ava', 'en-US', false, 'com.apple.voice.premium.en-US.Ava')
  const zoe = voice('Zoe (Enhanced)', 'en-US', false, 'com.apple.voice.enhanced.en-US.Zoe')
  const british = voice('Serena', 'en-GB', false, 'com.apple.voice.premium.en-GB.Serena')

  afterEach(() => {
    window.localStorage.removeItem('vocabflow.voice')
    window.localStorage.removeItem('vocabflow.secondVoice')
  })

  test('a Premium voice beats an Enhanced one, which beats the default', () => {
    expect(voiceQuality(ava)).toBe(2)
    expect(voiceQuality(zoe)).toBe(1)
    expect(voiceQuality(compact)).toBe(0)
    expect(chooseVoice([compact, zoe, ava]).voice).toBe(ava)
    expect(chooseVoice([compact, zoe]).voice).toBe(zoe)
  })

  test('an American voice still comes before a better voice of another accent', () => {
    expect(chooseVoice([british, compact])).toEqual({ voice: compact, accent: 'american' })
  })

  test('joke and robotic voices are never chosen', () => {
    const fred = voice('Fred', 'en-US', true)
    const flo = voice('Flo (English (US))', 'en-US', false, 'com.apple.eloquence.en-US.Flo')
    expect(isUsableVoice(fred)).toBe(false)
    expect(isUsableVoice(flo)).toBe(false)
    expect(chooseVoice([fred, flo, british])).toEqual({ voice: british, accent: 'other' })
  })

  test('the voice picked in Settings is used while the device has it', () => {
    setVoiceChoice('first', compact.voiceURI)
    expect(chooseVoice([compact, ava]).voice).toBe(compact)
    expect(chooseVoice([ava, zoe]).voice).toBe(ava)
    setVoiceChoice('first', '')
    expect(getVoiceChoice('first')).toBe('')
  })

  test('the second speaker gets another voice, or the same one lower when there is no other', () => {
    expect(chooseSecondVoice([compact, zoe, ava])).toBe(zoe)
    // The same person in another quality is not another voice.
    expect(chooseSecondVoice([ava, voice('Ava', 'en-US', false, 'com.apple.voice.compact.en-US.Ava')])).toBeUndefined()

    const speech = installSpeechSynthesis([compact, ava])
    speakText('Hello', { role: 'second', onStart: vi.fn(), onEnd: vi.fn() })
    expect(speech.lastUtterance()).toMatchObject({ voice: compact, pitch: 1 })

    speech.setVoices([ava])
    speakText('Hello', { role: 'second', onStart: vi.fn(), onEnd: vi.fn() })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    vi.runAllTimers()
    vi.useRealTimers()
    expect(speech.lastUtterance()).toMatchObject({ voice: ava, pitch: 0.75 })
  })

  test('the second voice picked in Settings is used unless it is the first voice', () => {
    setVoiceChoice('second', compact.voiceURI)
    expect(chooseSecondVoice([compact, zoe, ava])).toBe(compact)
    setVoiceChoice('first', compact.voiceURI)
    expect(chooseSecondVoice([compact, zoe, ava])).toBe(ava)
  })

  test('the phone’s own voice names no voice, and the second speaker is then that voice lower unless one is picked', () => {
    setVoiceChoice('first', systemVoice)
    expect(chooseVoice([compact, ava])).toEqual({ voice: undefined, accent: 'american' })
    const speech = installSpeechSynthesis([compact, ava])
    speakText('Hello', { onStart: vi.fn(), onEnd: vi.fn() })
    expect(speech.lastUtterance()).toMatchObject({ voice: null, lang: 'en-US', pitch: 1 })

    expect(chooseSecondVoice([compact, ava])).toBeUndefined()
    setVoiceChoice('second', compact.voiceURI)
    expect(chooseSecondVoice([compact, ava])).toBe(compact)
  })
})
