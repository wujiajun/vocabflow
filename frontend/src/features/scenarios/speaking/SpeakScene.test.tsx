import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSpeechSynthesis } from '../../../test/speech'
import { SpeakScene } from './SpeakScene'
import { quietMs, settleMs } from './turn'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
  constructor() {
    FakeRecognition.instances.push(this)
  }
  fire(name: string) {
    act(() => (this as unknown as Record<string, (() => void) | undefined>)[`on${name}`]?.())
  }
  said(...parts: [string, boolean][]) {
    act(() => this.onresult?.({ resultIndex: 0, results: parts.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } })) }))
  }
}

const lines = [
  { speaker: 'Barista', text: 'Hi there! What can I get for you?' },
  { speaker: 'Customer', text: "I'd like a medium coffee, please." },
  { speaker: 'Barista', text: 'That will be six dollars and fifty cents.' },
  { speaker: 'Customer', text: 'Can I pay by card?' },
]

beforeEach(() => {
  FakeRecognition.instances = []
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  installSpeechSynthesis()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const click = (name: string | RegExp) => act(() => screen.getByRole('button', { name }).click())
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

function begin(role?: string) {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  if (role) click(role)
  click('Start speaking')
  FakeRecognition.instances[0].fire('audiostart')
}

test('you choose who to play, and the other lines are only shown', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  expect(screen.getByRole('button', { name: 'Barista' })).toHaveAttribute('aria-pressed', 'true')
  click('Customer')
  expect(screen.getByRole('button', { name: 'Customer' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/Say only your own lines/)).toBeInTheDocument()
  click('Start speaking')
  expect(screen.getByText(/Starting the microphone/)).toBeInTheDocument()
  FakeRecognition.instances[0].fire('audiostart')
  // The Barista goes first: shown, not spoken, and "I read it" or the reading time moves on.
  expect(screen.getByText('Hi there! What can I get for you?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'I read it' })).toBeInTheDocument()
  expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
  click('I read it')
  expect(screen.getByText("I'd like a medium coffee, please.")).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  expect(FakeRecognition.instances).toHaveLength(1)
  expect(FakeRecognition.instances[0].continuous).toBe(true)
})

test('the reading time moves a partner line on by itself', () => {
  begin('Customer')
  tick(6000)
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
})

test('Done waits for the final result for a moment, and judges only what came in this turn', () => {
  begin('Customer')
  const rec = FakeRecognition.instances[0]
  // Something said earlier (the partner line read aloud, say) is before the turn.
  rec.said(['hi there what can I get for you', true])
  click('I read it')
  rec.said(['hi there what can I get for you', true], ["I would like a medium coffee", false])
  expect(screen.getByTestId('heard-now')).toHaveTextContent(/^I would like a medium coffee$/)

  click('Done')
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  expect(screen.queryByTestId('line-result')).toBeNull() // not judged at once
  rec.said(['hi there what can I get for you', true], ['I would like a medium coffee please', true]) // the final result arrives late
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%') // I'd = I would
})

test('without a final result the line is judged after the short wait', () => {
  begin('Customer')
  click('I read it')
  FakeRecognition.instances[0].said(['I would like a medium coffee please', false])
  click('Done')
  tick(settleMs - 100)
  expect(screen.queryByTestId('line-result')).toBeNull()
  tick(200)
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
})

test('a final result followed by quiet judges the line by itself', () => {
  begin('Customer')
  click('I read it')
  FakeRecognition.instances[0].said(['I would like a medium coffee', true])
  tick(quietMs + 100)
  expect(screen.getByTestId('line-result')).toBeInTheDocument()
})

test('Retry this line starts the line again with the same recognizer; the new try is scored', () => {
  begin('Customer')
  click('I read it')
  const rec = FakeRecognition.instances[0]
  rec.said(['a medium tea', true])
  tick(quietMs + 100)
  expect(screen.getByTestId('line-result')).not.toHaveTextContent('100%')
  click('Retry this line')
  expect(screen.getByTestId('heard-now')).toHaveTextContent('')
  rec.said(['a medium tea', true], ["I'd like a medium coffee please", true])
  tick(quietMs + 100)
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
  expect(FakeRecognition.instances).toHaveLength(1)
})

test('at the end it shows the total and stars for the learner’s own lines', () => {
  begin('Customer')
  const rec = FakeRecognition.instances[0]
  click('I read it')
  rec.said(["I'd like a medium coffee please", true])
  tick(quietMs + 100)
  click('Next')
  click('I read it')
  rec.said(["I'd like a medium coffee please", true], ['can I pay by card', true])
  tick(quietMs + 100)
  click('Finish')
  expect(screen.getByTestId('total')).toHaveTextContent('100% · 3 of 3 stars')
  expect(rec.stop).toHaveBeenCalled()
  expect(screen.getByText(/not saved/)).toBeInTheDocument()
})

test('a refused microphone says so and offers another try or self-rating', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Start speaking')
  const rec = FakeRecognition.instances[0]
  act(() => rec.onerror?.({ error: 'not-allowed' }))
  expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toMatch(/did not start/)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  click('Self-rate instead')
  expect(screen.getByText(/Say the line out loud/)).toBeInTheDocument() // Barista goes first here: shown
})

test('when the phone ends the listening, it says so and offers self-rating without promising to resume', () => {
  begin('Customer')
  click('I read it')
  act(() => FakeRecognition.instances[0].onend?.())
  expect(screen.getByRole('alert')).toHaveTextContent('stopped listening by itself')
  expect(screen.getByRole('alert')).toHaveTextContent('does not work on an iPhone')
  click('Self-rate the rest')
  click('Went well')
  expect(screen.getByTestId('line-result')).toHaveTextContent('You rated yourself: 100%')
  click('Next')
  click('I read it')
  click('So-so')
  click('Finish')
  expect(screen.getByTestId('total')).toHaveTextContent('85%')
})

test('the microphone taking too long shows Cancel', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Start speaking')
  tick(10100)
  expect(screen.getByRole('alert')).toHaveTextContent('has not started')
  click('Cancel')
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeInTheDocument()
})

test('Listen first reads the conversation aloud with the microphone off', async () => {
  const synth = installSpeechSynthesis()
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Listen first')
  expect(synth.lastUtterance().text).toBe('Hi there! What can I get for you?')
  expect(FakeRecognition.instances).toHaveLength(0)
  act(() => synth.lastUtterance().onend?.())
  expect(synth.lastUtterance().text).toBe("I'd like a medium coffee, please.")
  expect(synth.lastUtterance().pitch).not.toBeUndefined()
  click('Pause')
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  void userEvent
})
