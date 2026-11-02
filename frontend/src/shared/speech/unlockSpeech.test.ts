import { afterEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { installSpeechUnlock } from './unlockSpeech'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the first touch says one silent syllable, and later ones say nothing more', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  installSpeechUnlock()
  expect(speech.spoken).toHaveLength(0)

  document.body.dispatchEvent(new Event('touchend', { bubbles: true }))
  document.body.dispatchEvent(new Event('touchend', { bubbles: true }))

  expect(speech.spoken).toHaveLength(1)
  expect(speech.lastUtterance()).toMatchObject({ volume: 0 })
  // Said without stopping what may already be playing.
  expect(speech.synth.cancel).not.toHaveBeenCalled()
})

test('a click with a mouse says nothing', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  installSpeechUnlock()

  document.body.dispatchEvent(new Event('click', { bubbles: true }))

  expect(speech.spoken).toHaveLength(0)
  // Leave nothing listening for the next test.
  document.body.dispatchEvent(new Event('touchend', { bubbles: true }))
})

test('nothing is installed where there is no speech', () => {
  expect(() => {
    installSpeechUnlock()
    document.body.dispatchEvent(new Event('touchend', { bubbles: true }))
  }).not.toThrow()
})
