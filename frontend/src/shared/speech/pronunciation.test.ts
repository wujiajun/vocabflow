import { afterEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { chooseVoice, currentVoiceAccent, isSpeechSupported, speakText, stopSpeaking } from './pronunciation'

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

test('reports when playback starts, ends or fails', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const onStart = vi.fn()
  const onEnd = vi.fn()

  speakText('overwhelmed', { onStart, onEnd })
  const utterance = speech.lastUtterance()
  utterance.onstart?.()
  utterance.onend?.()
  utterance.onerror?.()

  expect(onStart).toHaveBeenCalledTimes(1)
  expect(onEnd).toHaveBeenCalledTimes(2)
})

test('stops anything being spoken', () => {
  const speech = installSpeechSynthesis()

  stopSpeaking()

  expect(speech.synth.cancel).toHaveBeenCalledTimes(1)
})
