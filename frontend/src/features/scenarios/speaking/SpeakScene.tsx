import { useEffect, useRef, useState } from 'react'
import { Stars } from '../../learning/components/GameParts'
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
export function SpeakScene({ lines, onClose }: { lines: SceneLine[]; onClose: () => void }) {
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

  const mine = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.speaker === me)
  const rated = mine.filter(({ i }) => results[i])
  const average = rated.length ? rated.reduce((sum, { i }) => sum + (results[i]?.share ?? 0), 0) / rated.length : 0
  const current = lines[Math.min(step, lines.length - 1)]
  const isLast = step === lines.length - 1
  const ownLine = current.speaker === me
  const button = 'min-h-11 rounded-xl px-4 font-semibold'
  const plain = `${button} bg-white text-slate-800 ring-1 ring-slate-300`
  const strong = `${button} bg-indigo-700 text-white`

  return (
    <section aria-label="Speak this scene" className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Speak this scene</h2>
        <button className="min-h-11 text-sm font-semibold text-indigo-700 underline underline-offset-4" onClick={() => { leave(); onClose() }} type="button">
          Close
        </button>
      </div>

      {phase === 'setup' && (
        <div>
          <p className="mt-1 text-sm text-slate-700">
            Choose who you play. The phone reads the other person&apos;s lines aloud. After each one, wait for <strong>Speak now</strong>, then say your line and pause: the phone stops listening by itself.
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="You play">
            {speakers.map((name) => (
              <button
                aria-pressed={me === name}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${me === name ? 'bg-indigo-700 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-300'}`}
                key={name}
                onClick={() => setMe(name)}
                type="button"
              >
                {name}
              </button>
            ))}
          </div>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-800">
            <input checked={model} className="h-5 w-5" onChange={(e) => setModel(e.target.checked)} type="checkbox" />
            Read my line to me first (to repeat after it)
          </label>
          <ListenFirst lines={lines} stopRef={stopListenFirst} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`${strong} disabled:opacity-50`} disabled={!supported} onClick={() => begin(false)} type="button">
              Start speaking
            </button>
            <button className={plain} onClick={() => begin(true)} type="button">
              Self-rate (no microphone)
            </button>
          </div>
          {!supported && <p className="mt-2 text-sm text-amber-900">This browser has no speech recognition, so you can only self-rate.</p>}
          <p className="mt-2 text-xs text-slate-600">
            The first time, the phone asks for the microphone: tap Allow. Your browser&apos;s speech service may send the sound to Apple or Google. VocabFlow records and keeps nothing.
          </p>
        </div>
      )}

      {phase === 'running' && (
        <div>
          <p className="mt-2 text-xs font-semibold text-indigo-900">
            Line {step + 1} of {lines.length} · you are {me}
          </p>
          <div className={`mt-2 rounded-xl bg-white px-3 py-2 ring-2 ${ownLine ? 'ring-indigo-500' : 'ring-indigo-200'}`}>
            <p className="text-sm font-semibold text-slate-700">{ownLine ? `${current.speaker} (you)` : current.speaker}</p>
            <p className="text-base text-slate-900">{current.text}</p>
          </div>

          {(kind === 'partner' || kind === 'cue') && (
            <div className="mt-2" role="status">
              <p className="text-sm text-slate-600">{ownLine ? (model ? 'Listen to your line first…' : 'Your turn is next…') : 'Listen…'}</p>
              <button className={`mt-1 ${plain}`} onClick={skip} type="button">
                {kind === 'cue' && !ownLine ? 'Skip my next line' : 'Skip'}
              </button>
            </div>
          )}

          {(kind === 'turn' || kind === 'finishing') && (
            <div className="mt-2" role="status">
              {kind === 'finishing' ? (
                <p className="text-sm text-slate-600">Finishing… the phone stops listening after a short pause.</p>
              ) : ready ? (
                <p className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-lg font-bold text-white" data-testid="speak-now">
                  Speak now
                </p>
              ) : (
                <p className="rounded-xl bg-amber-100 px-4 py-3 text-center text-base font-semibold text-amber-900">Get ready…</p>
              )}
              {kind === 'turn' && ready && <p className="mt-1 text-xs text-slate-600">Say your line, then pause. It stops listening by itself.</p>}
              <p className="mt-1 min-h-6 font-semibold" data-testid="heard-now">{heard}</p>
              {stuck && (
                <p className="mt-1 text-sm text-amber-900" role="alert">
                  The microphone has not opened yet. If the phone asks, tap Allow; otherwise skip this line or rate yourself.
                </p>
              )}
              {kind === 'turn' && (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button className={plain} onClick={skip} type="button">
                    Skip
                  </button>
                  {stuck && (
                    <button className={plain} onClick={selfRateRest} type="button">
                      Self-rate the rest
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {kind === 'nothing' && (
            <div className="mt-2" role="status">
              <p className="text-sm font-semibold text-amber-900">Nothing was heard.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button className={strong} onClick={retry} type="button">
                  Try again
                </button>
                <button className={plain} onClick={skip} type="button">
                  Skip
                </button>
                <button className={plain} onClick={selfRateRest} type="button">
                  Self-rate the rest
                </button>
              </div>
            </div>
          )}

          {kind === 'failed' && (
            <div className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              <p>The microphone did not work. Check that it is allowed for this site, or rate yourself instead.</p>
              {failure && <p className="mt-1">{failure}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={`${button} bg-amber-200`} onClick={selfRateRest} type="button">
                  Self-rate the rest
                </button>
              </div>
            </div>
          )}

          {kind === 'self' && (
            <div className="mt-2">
              <p className="text-sm text-slate-600">Say the line out loud, then rate yourself.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(selfShare) as SelfRating[]).map((rating) => (
                  <button className={strong} key={rating} onClick={() => rate(rating)} type="button">
                    {selfLabel[rating]}
                  </button>
                ))}
                <button className={plain} onClick={skip} type="button">
                  Skip
                </button>
              </div>
            </div>
          )}

          {kind === 'judged' && results[step] && (
            <div className="mt-2" role="status">
              <p className="text-sm font-semibold" data-testid="line-result">
                {results[step]!.self ? `You rated yourself: ${Math.round(results[step]!.share * 100)}%` : `${Math.round(results[step]!.share * 100)}% of the words`}
              </p>
              {results[step]!.score && <Words score={results[step]!.score!} />}
              {results[step]!.said && <p className="mt-1 text-xs text-slate-600">Heard: {results[step]!.said}</p>}
              <div className="mt-2 flex gap-2">
                {!selfMode && (
                  <button className={plain} onClick={retry} type="button">
                    Try again
                  </button>
                )}
                <button className={strong} onClick={() => advance(step + 1)} type="button">
                  {isLast ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          )}
          <button className="mt-3 min-h-11 text-sm font-semibold text-slate-700 underline underline-offset-4" onClick={leave} type="button">
            Stop practising
          </button>
        </div>
      )}

      {phase === 'finished' && (
        <div className="mt-2" role="status">
          {rated.length > 0 ? (
            <>
              <Stars share={average} />
              <p className="font-semibold" data-testid="total">
                {Math.round(average * 100)}% · {starsForShare(average)} of 3 stars
              </p>
              <p className="text-sm text-slate-600">
                {rated.length} of {mine.length} of your lines {rated.some(({ i }) => results[i]?.self) ? '(some rated by you)' : ''}. This result is not saved.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">No line was scored.</p>
          )}
          <div className="mt-2 flex gap-2">
            <button className={strong} onClick={leave} type="button">
              Practise again
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
