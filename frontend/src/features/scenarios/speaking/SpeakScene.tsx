import { useEffect, useRef, useState } from 'react'
import { GameProgress, Stars, gamePrimaryButton } from '../../learning/components/GameParts'
import { starsForShare } from '../../learning/starsForShare'
import { speakText, stopSpeaking } from '../../../shared/speech/pronunciation'
import { type HeardResult, recognitionErrorMessage, useSpeechRecognition } from '../../../shared/speech/useSpeechRecognition'
import { type SceneLine, speakersOf } from './dialogueFromText'
import { ListenFirst } from './ListenFirst'
import { type LineScore, scoreLine } from './lineScore'
import { type SelfRating, pitchFor, readyDelayMs, selfLabel, selfShare, turnCue, turnText, watchdogMs } from './turn'

type Phase = 'setup' | 'running' | 'finished'
// partner: the other person's line is read aloud and nobody listens (the next line is not the learner's, or
//   self-rating); cue: the phone reads a line (the partner's, or the learner's own as a model) and then listens;
// turn: listening for the learner's line; finishing: Skip was pressed while listening, the recognizer is left to
//   end by itself; judged / nothing: the line has a score, or nothing was heard; self: the learner rates the line;
// failed: the microphone was refused.
type StepKind = 'partner' | 'cue' | 'turn' | 'finishing' | 'judged' | 'nothing' | 'self' | 'failed'

interface LineResult {
  share: number
  score?: LineScore
  said: string
  self?: boolean
}

const wordClass = {
  correct: 'bg-emerald-100 text-emerald-900',
  missed: 'bg-amber-100 text-amber-900 line-through',
  wrong: 'bg-rose-100 text-rose-900',
} as const

const refusals = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])

function Words({ score }: { score: LineScore }) {
  return (
    <p className="mt-1 flex flex-wrap gap-1.5 text-base">
      {score.words.map((w, i) => (
        <span className={`rounded px-1.5 py-0.5 ${wordClass[w.status]}`} data-status={w.status} key={i}>
          {w.word}
        </span>
      ))}
    </p>
  )
}

// Practise one side of a scenario's conversation. On an iPhone (iOS 27, WebKit bug 321436) a recognizer only hears
// reliably when the phone has just spoken and the recognizer is never cut. So each turn goes: the phone reads the
// line before (the other person's, or the learner's own as a model), a new recognizer starts 0.4 s later, "Speak
// now" shows once the microphone is open, and the recognizer ends by itself when the learner pauses; then the line
// is scored. Nothing is recorded, stored or sent; the result is shown, not kept.
// `onFinished` gets the round's score (0-100) once when it ends, if at least one line was heard and scored.
export function SpeakScene({ lines, onClose, onFinished }: { lines: SceneLine[]; onClose: () => void; onFinished?: (score: number) => void }) {
  const speakers = speakersOf(lines)
  const [me, setMe] = useState(speakers[0])
  const [phase, setPhase] = useState<Phase>('setup')
  const [kind, setKind] = useState<StepKind>('partner')
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [heard, setHeard] = useState('')
  const [results, setResults] = useState<Record<number, LineResult | null>>({})
  const [selfMode, setSelfMode] = useState(false)
  const [model, setModel] = useState(false) // read the learner's own line to them before they say it
  const [failure, setFailure] = useState('')

  const phaseRef = useRef<Phase>('setup')
  const kindRef = useRef<StepKind>('partner')
  const stepRef = useRef(0)
  const turnRef = useRef(0) // the learner's line that the current cue leads to
  const meRef = useRef(me)
  const selfRef = useRef(false)
  const modelRef = useRef(false)
  const heardRef = useRef('')
  const token = useRef(0) // a newer step makes an older spoken line's end meaningless
  const pending = useRef<(() => void) | null>(null) // to run once the last recognizer has ended
  const readyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stopListenFirst = useRef<(() => void) | null>(null)

  const lastErrorCode = useRef('')
  const { supported, listenAfterSpeaking, stop } = useSpeechRecognition('en-US', 'H', {
    onResults: (r) => onResults(r),
    // The hook clears its recognizer just after this call; act once it has.
    onEnd: () => void setTimeout(onEnded, 0),
    onEvent: (name) => onRecognizerEvent(name),
    onError: (code) => {
      lastErrorCode.current = code
    },
  })

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }
  function changeKind(next: StepKind) {
    kindRef.current = next
    setKind(next)
  }
  function show(index: number) {
    stepRef.current = index
    setStep(index)
  }
  function clearTimers() {
    clearTimeout(readyTimer.current)
    clearTimeout(watchdog.current)
    setStuck(false)
  }

  // Starts listening after the phone says `phrase`; if the last recognizer is still ending, once it has ended.
  function cue(phrase: string, speaker: string, turn: number) {
    turnRef.current = turn
    changeKind('cue')
    const go = () => {
      if (phaseRef.current !== 'running' || kindRef.current !== 'cue') return
      if (!listenAfterSpeaking(phrase, speaker ? pitchFor(speakers, speaker) : undefined)) pending.current = go
    }
    go()
  }

  function advance(index: number) {
    clearTimers()
    const mine = ++token.current
    setHeard('')
    heardRef.current = ''
    if (index >= lines.length) {
      changePhase('finished')
      return
    }
    const line = lines[index]
    show(index)
    if (line.speaker === meRef.current) {
      if (selfRef.current) changeKind('self')
      // Nothing is read just before this line: a short cue, or the learner's own line as a model if they asked.
      else cue(modelRef.current ? line.text : turnCue, modelRef.current ? line.speaker : '', index)
      return
    }
    const next = lines[index + 1]
    if (!selfRef.current && next && next.speaker === meRef.current) {
      cue(line.text, line.speaker, index + 1)
      return
    }
    // Nobody listens after this line: just read it aloud and move on.
    changeKind('partner')
    speakText(line.text, {
      pitch: pitchFor(speakers, line.speaker),
      onStart: () => undefined,
      onEnd: () => {
        if (token.current === mine && kindRef.current === 'partner') advance(index + 1)
      },
    })
  }

  function onRecognizerEvent(name: string) {
    if (phaseRef.current !== 'running') return
    if (name === 'primed' && kindRef.current === 'cue') {
      // The phone has finished speaking: the learner's line is next.
      show(turnRef.current)
      setHeard('')
      heardRef.current = ''
      setReady(false)
      changeKind('turn')
      clearTimeout(watchdog.current)
      setStuck(false)
      watchdog.current = setTimeout(() => setStuck(true), watchdogMs)
    } else if (name === 'audiostart' && kindRef.current === 'turn') {
      clearTimeout(watchdog.current)
      setStuck(false)
      clearTimeout(readyTimer.current)
      readyTimer.current = setTimeout(() => {
        if (kindRef.current === 'turn') setReady(true)
      }, readyDelayMs)
    }
  }

  function onResults(all: HeardResult[]) {
    if (phaseRef.current !== 'running') return
    if (kindRef.current !== 'turn' && kindRef.current !== 'finishing') return
    const said = turnText(all, 0).text
    heardRef.current = said
    setHeard(said)
  }

  function onEnded() {
    const next = pending.current
    pending.current = null
    if (next) {
      // A step that was waiting for the last recognizer to end (after leaving and starting again, say) goes now.
      next()
      return
    }
    if (phaseRef.current === 'running') {
      if (kindRef.current === 'turn') judge()
      else if (kindRef.current === 'finishing') {
        setResults((prev) => ({ ...prev, [stepRef.current]: null }))
        advance(stepRef.current + 1)
      }
    }
  }

  function judge() {
    clearTimers()
    setReady(false)
    const index = stepRef.current
    const said = heardRef.current
    if (!said) {
      const code = lastErrorCode.current
      lastErrorCode.current = ''
      if (refusals.has(code)) {
        setFailure(recognitionErrorMessage(code))
        changeKind('failed')
      } else {
        changeKind('nothing')
      }
      return
    }
    const score = scoreLine(lines[index].text, said)
    setResults((prev) => ({ ...prev, [index]: { share: score.share, score, said } }))
    changeKind('judged')
  }

  function retry() {
    const index = stepRef.current
    setResults((prev) => ({ ...prev, [index]: null }))
    advance(index) // the phone says the cue (or the learner's line) first, then listens
  }

  function skip() {
    const index = stepRef.current
    if (kindRef.current === 'turn') {
      // Never cut the recognizer: let it end by itself, then move on.
      clearTimers()
      changeKind('finishing')
      stop()
      return
    }
    if (kindRef.current === 'cue') {
      stop() // only cancels the phone's speech; listening has not begun
      setResults((prev) => ({ ...prev, [turnRef.current]: null }))
      advance(turnRef.current + 1)
      return
    }
    token.current++ // the end of the line being read is not a reason to move on twice
    stopSpeaking()
    if (lines[index].speaker === meRef.current) setResults((prev) => ({ ...prev, [index]: null }))
    advance(index + 1)
  }

  function rate(rating: SelfRating) {
    setResults((prev) => ({ ...prev, [stepRef.current]: { share: selfShare[rating], said: '', self: true } }))
    changeKind('judged')
  }

  function selfRateRest() {
    selfRef.current = true
    setSelfMode(true)
    if (kindRef.current === 'cue') stop()
    advance(lines[stepRef.current].speaker === meRef.current ? stepRef.current : turnRef.current)
  }

  function begin(self: boolean) {
    meRef.current = me
    modelRef.current = model
    selfRef.current = self
    setSelfMode(self)
    setResults({})
    setFailure('')
    lastErrorCode.current = ''
    pending.current = null
    token.current++
    stopListenFirst.current?.()
    stopSpeaking()
    changePhase('running')
    advance(0)
  }

  function leave() {
    clearTimers()
    token.current++
    pending.current = null
    if (kindRef.current === 'cue') stop()
    else if (kindRef.current !== 'turn' && kindRef.current !== 'finishing') stopSpeaking()
    // A recognizer that is listening is left to end by itself: cutting it would leave the next ones deaf.
    changePhase('setup')
    changeKind('partner')
    setResults({})
  }

  useEffect(
    () => () => {
      clearTimeout(readyTimer.current)
      clearTimeout(watchdog.current)
      token.current++
      if (kindRef.current === 'partner') stopSpeaking()
    },
    [],
  )

  // Keep the latest line in view, and stop the page behind the full-screen practice from scrolling.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' })
  }, [step, kind, heard, phase])
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [])

  // Report the round's score once when it ends (only lines the phone heard make it a speaking score).
  const reported = useRef(false)
  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  })
  useEffect(() => {
    if (phase !== 'finished') {
      reported.current = false
      return
    }
    if (reported.current) return
    reported.current = true
    const scored = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => l.speaker === meRef.current && results[i])
    if (!scored.some(({ i }) => results[i]?.score)) return
    const share = scored.reduce((sum, { i }) => sum + (results[i]?.share ?? 0), 0) / scored.length
    onFinishedRef.current?.(Math.round(share * 100))
  }, [phase, results, lines])

  // A partner line can be heard again while nothing is listening or about to listen.
  const quiet = kind === 'judged' || kind === 'nothing' || kind === 'self' || kind === 'failed' || phase === 'finished'
  function replay(line: SceneLine) {
    if (!quiet) return
    speakText(line.text, { pitch: pitchFor(speakers, line.speaker), onStart: () => undefined, onEnd: () => undefined })
  }

  const mine = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.speaker === me)
  const rated = mine.filter(({ i }) => results[i])
  const average = rated.length ? rated.reduce((sum, { i }) => sum + (results[i]?.share ?? 0), 0) / rated.length : 0
  const current = lines[Math.min(step, lines.length - 1)]
  const isLast = step === lines.length - 1
  const ownLine = current.speaker === me
  const shown = phase === 'finished' ? lines : lines.slice(0, step + 1)
  const speaking = (kind === 'partner' || kind === 'cue') && phase === 'running'
  const result = results[step]
  const tone = !result || result.self ? 'neutral' : result.share >= 0.8 ? 'good' : result.share >= 0.5 ? 'almost' : 'poor'
  const panel = {
    neutral: 'border-slate-200 bg-white',
    good: 'border-emerald-200 bg-emerald-50',
    almost: 'border-amber-200 bg-amber-50',
    poor: 'border-rose-200 bg-rose-50',
  }[tone]
  const panelText = { neutral: 'text-slate-900', good: 'text-emerald-900', almost: 'text-amber-900', poor: 'text-rose-900' }[tone]
  const primary = `w-full ${gamePrimaryButton}`
  const secondary =
    'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
  const quietLink = 'min-h-11 px-3 text-sm font-semibold text-slate-600 underline underline-offset-4'
  const progress = phase === 'running' || phase === 'finished' ? (phase === 'finished' ? lines.length : step + 1) : 0

  return (
    <section aria-label="Speak this scene" className="fixed inset-0 z-30 flex h-[100dvh] flex-col bg-slate-50">
      {/* Top: leave, and how far along the conversation is. */}
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          aria-label={phase === 'setup' ? 'Close' : 'Stop practising'}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          onClick={phase === 'setup' ? onClose : leave}
          type="button"
        >
          <CloseIcon />
        </button>
        <div className="flex-1">
          {phase === 'setup' ? (
            <p className="text-sm font-semibold text-slate-700">Speak this scene</p>
          ) : (
            <GameProgress max={lines.length} value={progress} />
          )}
        </div>
      </div>

      {phase === 'setup' ? (
        // The start screen: who you play, and Start. Everything else is under Options.
        <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-6">
          <section aria-label="Start" className="mt-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p aria-hidden="true" className="text-6xl leading-none">
              🗣️
            </p>
            <h2 className="mt-4 text-xl font-bold tracking-tight">Who do you play?</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-700">
              The phone says the other person&apos;s lines. When you see <strong>Speak now</strong>, say yours and pause.
            </p>
            <div aria-label="You play" className="mt-5 flex justify-center gap-6" role="group">
              {speakers.map((name) => (
                <button aria-pressed={me === name} className="flex flex-col items-center gap-2" key={name} onClick={() => setMe(name)} type="button">
                  <span
                    aria-hidden="true"
                    className={`flex size-16 items-center justify-center rounded-full text-xl font-bold ring-offset-2 transition ${
                      me === name ? 'bg-indigo-700 text-white ring-2 ring-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {initialsOf(name)}
                  </span>
                  <span className={`text-sm font-semibold ${me === name ? 'text-indigo-800' : 'text-slate-600'}`}>{name}</span>
                </button>
              ))}
            </div>
            <button className={`mt-6 ${primary} disabled:opacity-50`} disabled={!supported} onClick={() => begin(false)} type="button">
              Start speaking
            </button>
            {!supported && <p className="mt-2 text-sm text-amber-900">This browser has no speech recognition. Open Options to rate yourself instead.</p>}
          </section>

          <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-1 text-left shadow-sm">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700">Options</summary>
            <div className="pb-4">
              <ListenFirst lines={lines} stopRef={stopListenFirst} />
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-slate-800">
                <input checked={model} className="size-5 accent-indigo-700" onChange={(e) => setModel(e.target.checked)} type="checkbox" />
                Read my line to me first (to repeat after it)
              </label>
              <button className={`mt-2 ${secondary}`} onClick={() => begin(true)} type="button">
                Self-rate (no microphone)
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                The first time, the phone asks for the microphone: tap Allow. Your browser&apos;s speech service may send the sound to Apple or Google. VocabFlow records and keeps nothing.
              </p>
            </div>
          </details>
        </div>
      ) : (
        <>
          {/* The conversation so far, as a chat. */}
          <div className="flex-1 overflow-y-auto" ref={scroller}>
            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
              <p className="mb-3 text-center text-xs font-semibold text-slate-500">You are {me}</p>
              <ol className="flex flex-col gap-3">
                {shown.map((line, i) => {
                  const isMe = line.speaker === me
                  const r = results[i]
                  const active = phase === 'running' && i === step
                  return (
                    <li className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`} key={i}>
                      <Avatar mine={isMe} name={line.speaker} />
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          isMe
                            ? `rounded-br-sm ${active && !r ? 'bg-indigo-700 text-white' : 'border border-indigo-200 bg-white text-slate-900'}`
                            : `rounded-bl-sm border bg-white text-slate-900 ${active ? 'border-indigo-300' : 'border-slate-200'}`
                        }`}
                      >
                        <p className={`text-xs font-semibold ${isMe && active && !r ? 'text-indigo-100' : 'text-slate-500'}`}>{isMe ? `${line.speaker} (you)` : line.speaker}</p>
                        {isMe && r?.score ? <Words score={r.score} /> : <p className="mt-0.5 text-base">{line.text}</p>}
                        {!isMe &&
                          (active && speaking ? (
                            <SoundBars />
                          ) : (
                            <button
                              aria-label={`Hear again: ${line.text}`}
                              className="-mb-1 -ml-2 flex size-11 items-center justify-center rounded-full text-indigo-700 hover:bg-indigo-50 disabled:opacity-30"
                              disabled={!quiet}
                              onClick={() => replay(line)}
                              type="button"
                            >
                              <SpeakerIcon />
                            </button>
                          ))}
                        {isMe && r && <p className="mt-1 text-xs font-semibold text-slate-500">{r.self ? `You rated yourself ${Math.round(r.share * 100)}%` : `${Math.round(r.share * 100)}%`}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>

          {/* Bottom: what to do now. Stays in reach, like the result bar of the games. */}
          <div className={`border-t pb-[max(1rem,env(safe-area-inset-bottom))] ${phase === 'running' && kind === 'judged' ? panel : kind === 'nothing' && phase === 'running' ? 'border-amber-200 bg-amber-50' : kind === 'failed' && phase === 'running' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
            <div className="mx-auto w-full max-w-2xl px-4 pt-3">
              {phase === 'running' && (kind === 'partner' || kind === 'cue') && (
                <div className="flex items-center justify-between gap-3" role="status">
                  <p className="text-sm font-semibold text-slate-700">{ownLine ? (model ? 'Listen to your line first…' : 'Your turn is next…') : 'Listen…'}</p>
                  <button className={quietLink} onClick={skip} type="button">
                    {kind === 'cue' && !ownLine ? 'Skip my next line' : 'Skip'}
                  </button>
                </div>
              )}

              {phase === 'running' && (kind === 'turn' || kind === 'finishing') && (
                <div className="flex flex-col items-center" role="status">
                  <p className="min-h-6 text-center text-sm font-semibold text-slate-800" data-testid="heard-now">
                    {heard}
                  </p>
                  {kind === 'finishing' ? (
                    <p className="py-6 text-sm font-semibold text-slate-600">Finishing… the phone stops listening after a short pause.</p>
                  ) : (
                    <>
                      <div className="relative mt-1">
                        {ready && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-indigo-300 opacity-60 motion-safe:animate-ping" />}
                        <span className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-lg ${ready ? 'bg-indigo-700' : 'bg-slate-300'}`}>
                          <MicIcon />
                        </span>
                      </div>
                      {ready ? (
                        <p className="mt-2 text-base font-bold text-indigo-800" data-testid="speak-now">
                          Speak now
                        </p>
                      ) : (
                        <p className="mt-2 text-base font-semibold text-slate-500">Get ready…</p>
                      )}
                      <p className="text-xs text-slate-500">{ready ? 'Say your line, then pause. It stops listening by itself.' : 'The microphone is opening.'}</p>
                    </>
                  )}
                  {stuck && (
                    <p className="mt-2 text-center text-sm text-amber-900" role="alert">
                      The microphone has not opened yet. If the phone asks, tap Allow; otherwise skip this line or rate yourself.
                    </p>
                  )}
                  {kind === 'turn' && (
                    <div className="flex flex-wrap justify-center">
                      <button className={quietLink} onClick={skip} type="button">
                        Skip
                      </button>
                      {stuck && (
                        <button className={quietLink} onClick={selfRateRest} type="button">
                          Self-rate the rest
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {phase === 'running' && kind === 'judged' && result && (
                <div role="status">
                  <p className={`text-base font-bold ${panelText}`}>
                    {result.self ? 'Noted.' : tone === 'good' ? 'Great!' : tone === 'almost' ? 'Almost there.' : 'Keep practising.'}
                  </p>
                  <p className={`text-sm font-semibold ${panelText}`} data-testid="line-result">
                    {result.self ? `You rated yourself: ${Math.round(result.share * 100)}%` : `${Math.round(result.share * 100)}% of the words`}
                  </p>
                  {result.said && <p className={`mt-0.5 text-sm ${panelText}`}>Heard: {result.said}</p>}
                  {!result.self && result.share < 1 && <p className={`mt-0.5 text-sm ${panelText}`}>Line: {current.text}</p>}
                  <div className="mt-3 flex flex-col gap-2">
                    <button className={primary} onClick={() => advance(step + 1)} type="button">
                      {isLast ? 'Finish' : 'Continue'}
                    </button>
                    {!selfMode && (
                      <button className={secondary} onClick={retry} type="button">
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              )}

              {phase === 'running' && kind === 'nothing' && (
                <div role="status">
                  <p className="text-base font-bold text-amber-900">Nothing was heard.</p>
                  <p className="text-sm text-amber-900">Wait for Speak now, then say the line a little louder.</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button className={primary} onClick={retry} type="button">
                      Try again
                    </button>
                    <div className="flex justify-center">
                      <button className={quietLink} onClick={skip} type="button">
                        Skip
                      </button>
                      <button className={quietLink} onClick={selfRateRest} type="button">
                        Self-rate the rest
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {phase === 'running' && kind === 'failed' && (
                <div role="alert">
                  <p className="text-base font-bold text-rose-900">The microphone did not work.</p>
                  <p className="text-sm text-rose-900">Check that it is allowed for this site, or rate yourself instead.</p>
                  {failure && <p className="mt-1 text-sm text-rose-900">{failure}</p>}
                  <button className={`mt-3 ${primary}`} onClick={selfRateRest} type="button">
                    Self-rate the rest
                  </button>
                </div>
              )}

              {phase === 'running' && kind === 'self' && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Say the line out loud, then rate yourself.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(Object.keys(selfShare) as SelfRating[]).map((rating) => (
                      <button className={`${secondary} px-2`} key={rating} onClick={() => rate(rating)} type="button">
                        {selfLabel[rating]}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <button className={quietLink} onClick={skip} type="button">
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {phase === 'finished' && (
                <div className="flex flex-col items-center text-center" role="status">
                  {rated.length > 0 ? (
                    <>
                      <Stars share={average} />
                      <p className="mt-1 text-xl font-bold tracking-tight" data-testid="total">
                        {Math.round(average * 100)}% · {starsForShare(average)} of 3 stars
                      </p>
                      <p className="text-sm text-slate-700">
                        {rated.length} of {mine.length} of your lines{rated.some(({ i }) => results[i]?.self) ? ' (some rated by you)' : ''}. This result is not saved.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">No line was scored.</p>
                  )}
                  <div className="mt-3 flex w-full flex-col gap-2">
                    <button className={primary} onClick={leave} type="button">
                      Practise again
                    </button>
                    <button
                      className={secondary}
                      onClick={() => {
                        leave()
                        onClose()
                      }}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function initialsOf(name: string) {
  return name
    .replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${mine ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>
      {initialsOf(name)}
    </span>
  )
}

function SoundBars() {
  return (
    <span aria-label="Speaking" className="flex h-11 items-center gap-1" role="img">
      {[0, 150, 300, 450].map((delay) => (
        <span className="h-4 w-1 rounded-full bg-indigo-400 motion-safe:animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9" fill="currentColor" viewBox="0 0 24 24">
      <rect height="12" rx="3.5" width="7" x="8.5" y="2.5" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} />
    </svg>
  )
}
