import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { primeGapMs } from '../../../shared/speech/useSpeechRecognition'
import { installSpeechSynthesis } from '../../../test/speech'
import { playListenEnd, playListenStart } from '../../../shared/sound/effects'
import { SpeakScene } from './SpeakScene'
import { readyDelayMs, turnCue, watchdogMs } from './turn'

vi.mock('../../../shared/sound/effects', () => ({
  playListenStart: vi.fn(),
  playListenEnd: vi.fn(),
  unlockGameSound: vi.fn(),
}))

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
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
  // The recognizer ends by itself after the learner pauses.
  end() {
    act(() => this.onend?.())
    tick(0)
  }
}

const lines = [
  { speaker: 'Barista', text: 'Hi there! What can I get for you?' },
  { speaker: 'Customer', text: "I'd like a medium coffee, please." },
  { speaker: 'Barista', text: 'That will be six dollars and fifty cents.' },
  { speaker: 'Customer', text: 'Can I pay by card?' },
]

let speech: ReturnType<typeof installSpeechSynthesis>

beforeEach(() => {
  vi.mocked(playListenStart).mockClear()
  vi.mocked(playListenEnd).mockClear()
  FakeRecognition.instances = []
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  speech = installSpeechSynthesis()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const click = (name: string | RegExp) => act(() => screen.getByRole('button', { name }).click())
function tick(ms: number) {
  act(() => void vi.advanceTimersByTime(ms))
}
const spoken = () => speech.lastUtterance()?.text
// The phone finishes the line it is reading; a new recognizer starts 0.4 s later.
function phoneDone() {
  act(() => speech.lastUtterance().onend?.())
  tick(primeGapMs)
}
const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]
// The microphone opens; "Speak now" shows half a second later.
function micOpen() {
  latest().fire('audiostart')
  tick(readyDelayMs)
}

function begin(role?: string) {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  if (role) click(role)
  click('Start speaking')
}

test('the partner line is read aloud, then a new recognizer listens for your line, and Speak now shows once the mic is open', () => {
  begin('Customer')
  expect(spoken()).toBe('Hi there! What can I get for you?')
  expect(FakeRecognition.instances).toHaveLength(0) // nobody listens while the phone speaks

  phoneDone()
  expect(screen.getByText("I'd like a medium coffee, please.")).toBeInTheDocument()
  expect(screen.getByText('Get ready…')).toBeInTheDocument()
  expect(FakeRecognition.instances).toHaveLength(1)
  expect(latest().continuous).toBe(false)

  latest().fire('audiostart')
  tick(readyDelayMs - 1)
  expect(screen.queryByTestId('speak-now')).toBeNull() // the first words right after audiostart get lost
  tick(1)
  expect(screen.getByTestId('speak-now')).toBeInTheDocument()

  latest().said(['I would like a medium coffee', false])
  expect(screen.getByTestId('heard-now')).toHaveTextContent('I would like a medium coffee')
  latest().said(['I would like a medium coffee please', true])
  expect(screen.queryByTestId('line-result')).toBeNull() // judged when the recognizer ends by itself
  latest().end()
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
})

test('each turn has its own recognizer, none is ever cut, and the total counts only your lines', () => {
  begin('Customer')
  phoneDone()
  micOpen()
  const first = latest()
  first.said(["I'd like a medium coffee please", true])
  first.end()
  click('Continue')

  expect(spoken()).toBe('That will be six dollars and fifty cents.')
  phoneDone()
  const second = latest()
  expect(second).not.toBe(first)
  micOpen()
  second.said(['can I pay by card', true])
  second.end()
  click('Finish')

  expect(screen.getByTestId('total')).toHaveTextContent('100% · 3 of 3 stars')
  for (const rec of FakeRecognition.instances) {
    expect(rec.stop).not.toHaveBeenCalled()
    expect(rec.abort).not.toHaveBeenCalled()
  }
})

test('when you play the one who speaks first, the phone says a short cue, not your line, before listening', () => {
  begin() // Barista
  expect(spoken()).toBe(turnCue)
  expect(speech.spoken.map((u) => u.text)).not.toContain('Hi there! What can I get for you?')
  expect(screen.getByText('Your turn is next…')).toBeInTheDocument()
  phoneDone()
  expect(FakeRecognition.instances).toHaveLength(1)
  micOpen()
  latest().said(['hi there what can I get for you', true])
  latest().end()
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
})

test('nothing heard: Try again says the cue and listens with a new recognizer', () => {
  begin('Customer')
  phoneDone()
  micOpen()
  const first = latest()
  act(() => first.onerror?.({ error: 'no-speech' }))
  tick(0)
  expect(screen.getByText('Nothing was heard.')).toBeInTheDocument()

  click('Try again')
  expect(spoken()).toBe(turnCue)
  phoneDone()
  expect(latest()).not.toBe(first)
  micOpen()
  latest().said(["I'd like a medium coffee please", true])
  latest().end()
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
})

test('Try again after a score asks again, and the new try counts', () => {
  begin('Customer')
  phoneDone()
  micOpen()
  latest().said(['a medium tea', true])
  latest().end()
  expect(screen.getByTestId('line-result')).not.toHaveTextContent('100%')
  click('Try again')
  phoneDone()
  micOpen()
  latest().said(["I'd like a medium coffee please", true])
  latest().end()
  expect(screen.getByTestId('line-result')).toHaveTextContent('100%')
})

test('Skip while listening does not cut the recognizer: it waits for it to end, then moves on', () => {
  begin('Customer')
  phoneDone()
  micOpen()
  const rec = latest()
  click('Skip')
  expect(screen.getByText(/Finishing/)).toBeInTheDocument()
  expect(rec.stop).not.toHaveBeenCalled()
  expect(rec.abort).not.toHaveBeenCalled()
  rec.end()
  expect(spoken()).toBe('That will be six dollars and fifty cents.')
})

test('a refused microphone says so and offers self-rating', () => {
  begin('Customer')
  phoneDone()
  act(() => latest().onerror?.({ error: 'not-allowed' }))
  tick(0)
  expect(screen.getByRole('alert')).toHaveTextContent('did not work')
  click('Self-rate the rest')
  click('Went well')
  expect(screen.getByTestId('line-result')).toHaveTextContent('You rated yourself: 100%')
})

test('a microphone that does not open offers a way out after a while', () => {
  begin('Customer')
  phoneDone()
  tick(watchdogMs + 100)
  expect(screen.getByRole('alert')).toHaveTextContent('has not opened')
  click('Self-rate the rest')
  expect(screen.getByText(/Say the line out loud/)).toBeInTheDocument()
})

test('self-rating reads the other lines aloud and never listens', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Customer')
  click('Self-rate (no microphone)')
  expect(spoken()).toBe('Hi there! What can I get for you?')
  act(() => speech.lastUtterance().onend?.())
  click('Went well')
  click('Continue')
  act(() => speech.lastUtterance().onend?.())
  click('So-so')
  click('Finish')
  expect(screen.getByTestId('total')).toHaveTextContent('85%')
  expect(FakeRecognition.instances).toHaveLength(0)
})

test('stopping while listening leaves the recognizer to end; starting again waits for it', () => {
  begin('Customer')
  phoneDone()
  micOpen()
  const old = latest()
  click('Stop practising')
  expect(old.abort).not.toHaveBeenCalled()
  click('Start speaking')
  // The old recognizer is still on, so the new turn waits for it before the phone speaks and listens.
  expect(FakeRecognition.instances).toHaveLength(1)
  old.end()
  phoneDone()
  expect(FakeRecognition.instances).toHaveLength(2)
})

test('Listen first reads the conversation aloud with the microphone off', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Listen first')
  expect(spoken()).toBe('Hi there! What can I get for you?')
  // The learner plays the first speaker by default, so their line has the second voice (here, lower)...
  expect(speech.lastUtterance().pitch).toBe(0.75)
  expect(FakeRecognition.instances).toHaveLength(0)
  act(() => speech.lastUtterance().onend?.())
  // ...and the other person the main voice.
  expect(spoken()).toBe("I'd like a medium coffee, please.")
  expect(speech.lastUtterance().pitch).toBe(1)
  click('Pause')
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
})

test('starting while Listen first is reading stops it, and the first line is not cut by it', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  click('Customer')
  click('Listen first')
  click('Start speaking')
  const first = speech.lastUtterance()
  expect(first.text).toBe('Hi there! What can I get for you?')
  // Nothing has ended the line the scene is reading: the microphone waits for it.
  expect(screen.queryByText('Get ready…')).toBeNull()
  phoneDone()
  expect(screen.getByText('Get ready…')).toBeInTheDocument()
  expect(speech.spoken.filter((u) => u.text === "I'd like a medium coffee, please.")).toHaveLength(0)
})

test('Read my line to me first reads your own line as a model before you say it', () => {
  render(<SpeakScene lines={lines} onClose={() => undefined} />)
  act(() => screen.getByRole('checkbox', { name: /Read my line to me first/ }).click())
  click('Start speaking') // Barista speaks first
  expect(spoken()).toBe('Hi there! What can I get for you?')
  expect(screen.getByText('Listen to your line first…')).toBeInTheDocument()
  phoneDone()
  micOpen()
  latest().said(['a cup of tea', true])
  latest().end()
  click('Try again')
  expect(spoken()).toBe('Hi there! What can I get for you?')
})

test('the chat shows the lines so far; a partner line can be heard again only while nothing listens', () => {
  begin('Customer')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  phoneDone()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  const again = screen.getByRole('button', { name: /Hear again: Hi there/ })
  expect(again).toBeDisabled() // the microphone is about to listen
  micOpen()
  latest().said(["I'd like a medium coffee please", true])
  latest().end()
  expect(again).toBeEnabled()
  const before = speech.spoken.length
  act(() => again.click())
  expect(speech.spoken).toHaveLength(before + 1)
  expect(spoken()).toBe('Hi there! What can I get for you?')
  expect(screen.getByText('Great!')).toBeInTheDocument()
})

test('the start screen shows who you play and Start; the rest is folded under Options', () => {
  const onClose = vi.fn()
  render(<SpeakScene lines={lines} onClose={onClose} />)
  expect(screen.getByRole('heading', { name: 'Who do you play?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start speaking' })).toBeEnabled()
  const options = screen.getByText('Options').closest('details')!
  expect(options).not.toHaveAttribute('open')
  expect(options).toContainElement(screen.getByRole('button', { name: 'Listen first' }))
  expect(options).toContainElement(screen.getByRole('button', { name: 'Self-rate (no microphone)' }))
  click('Close')
  expect(onClose).toHaveBeenCalled()
})

test('the round score is reported once when it ends, and not for a round rated only by yourself', () => {
  const onFinished = vi.fn()
  render(<SpeakScene lines={lines} onClose={() => undefined} onFinished={onFinished} />)
  click('Customer')
  click('Start speaking')
  phoneDone()
  micOpen()
  latest().said(["I'd like a medium coffee please", true])
  latest().end()
  click('Continue')
  phoneDone()
  micOpen()
  latest().said(['can I pay', true])
  latest().end()
  click('Finish')
  expect(onFinished).toHaveBeenCalledTimes(1)
  expect(onFinished.mock.calls[0][0]).toBeGreaterThan(50)
  expect(onFinished.mock.calls[0][0]).toBeLessThan(100)

  click('Practise again')
  click('Self-rate (no microphone)')
  act(() => speech.lastUtterance().onend?.())
  click('Went well')
  click('Continue')
  act(() => speech.lastUtterance().onend?.())
  click('Went well')
  click('Finish')
  expect(onFinished).toHaveBeenCalledTimes(1)
})

test('a rising cue sounds with Speak now, and a falling one when the phone stops listening by itself', () => {
  begin('Customer')
  phoneDone()
  latest().fire('audiostart')
  expect(playListenStart).not.toHaveBeenCalled()
  tick(readyDelayMs)
  expect(playListenStart).toHaveBeenCalledTimes(1)
  latest().said(["I'd like a medium coffee please", true])
  expect(playListenEnd).not.toHaveBeenCalled()
  latest().end()
  expect(playListenEnd).toHaveBeenCalledTimes(1)
})
