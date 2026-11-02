import { afterEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { installSpeechUnlock } from './unlockSpeech'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the first press says one silent syllable, and later presses say nothing more', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  installSpeechUnlock()
  expect(speech.spoken).toHaveLength(0)

  document.body.dispatchEvent(new Event('click', { bubbles: true }))
  document.body.dispatchEvent(new Event('touchend', { bubbles: true }))
  document.body.dispatchEvent(new Event('click', { bubbles: true }))

  expect(speech.spoken).toHaveLength(1)
  expect(speech.lastUtterance()).toMatchObject({ volume: 0 })
  // Said without stopping what may already be playing.
  expect(speech.synth.cancel).not.toHaveBeenCalled()
})

test('nothing is installed where there is no speech', () => {
  expect(() => {
    installSpeechUnlock()
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
  }).not.toThrow()
})
