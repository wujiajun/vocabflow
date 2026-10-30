import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis, voice } from '../../test/speech'
import { PronounceButton } from './PronounceButton'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('renders nothing when the browser cannot speak', () => {
  render(<PronounceButton term="overwhelmed" />)

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('is named after the word and speaks it with an American voice when clicked', async () => {
  const american = voice('Samantha', 'en-US')
  const speech = installSpeechSynthesis([voice('Daniel', 'en-GB'), american])
  const browserUser = userEvent.setup()

  render(<PronounceButton term="figure out" />)
  await browserUser.click(screen.getByRole('button', { name: 'Play pronunciation of figure out' }))

  expect(speech.lastUtterance()).toMatchObject({ text: 'figure out', lang: 'en-US', voice: american })
  expect(screen.getByRole('button')).toHaveAttribute('title', 'Play pronunciation')
})

test('shows it is playing and stops when clicked again', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()

  render(<PronounceButton term="overwhelmed" />)
  const button = screen.getByRole('button')
  expect(button).toHaveAttribute('aria-pressed', 'false')

  await browserUser.click(button)
  act(() => speech.lastUtterance().onstart?.())
  expect(button).toHaveAttribute('aria-pressed', 'true')

  speech.synth.cancel.mockClear()
  await browserUser.click(button)
  expect(speech.synth.cancel).toHaveBeenCalledTimes(1)
  expect(button).toHaveAttribute('aria-pressed', 'false')
})

test('returns to idle when playback ends on its own', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()

  render(<PronounceButton term="overwhelmed" />)
  await browserUser.click(screen.getByRole('button'))
  act(() => speech.lastUtterance().onstart?.())
  act(() => speech.lastUtterance().onend?.())

  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})

test('says so in its tooltip when the device has no American voice, and updates when voices load', () => {
  const speech = installSpeechSynthesis([])

  render(<PronounceButton term="overwhelmed" />)
  expect(screen.getByRole('button')).toHaveAttribute('title', 'Play pronunciation')

  act(() => speech.setVoices([voice('Daniel', 'en-GB')]))
  expect(screen.getByRole('button')).toHaveAttribute(
    'title',
    'Plays with an English voice; no American English voice was found on this device',
  )

  act(() => speech.setVoices([voice('Daniel', 'en-GB'), voice('Samantha', 'en-US')]))
  expect(screen.getByRole('button')).toHaveAttribute('title', 'Play pronunciation')
})

test('stops speaking when the button leaves the page mid-word', async () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])
  const browserUser = userEvent.setup()

  const { unmount } = render(<PronounceButton term="overwhelmed" />)
  await browserUser.click(screen.getByRole('button'))
  act(() => speech.lastUtterance().onstart?.())
  speech.synth.cancel.mockClear()

  unmount()

  expect(speech.synth.cancel).toHaveBeenCalledTimes(1)
})

test('does not cancel anything on unmount when nothing is playing', () => {
  const speech = installSpeechSynthesis([voice('Samantha', 'en-US')])

  const { unmount } = render(<PronounceButton term="overwhelmed" />)
  unmount()

  expect(speech.synth.cancel).not.toHaveBeenCalled()
})
