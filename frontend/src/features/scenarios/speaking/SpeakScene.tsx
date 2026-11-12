import { useEffect, useRef, useState } from 'react'
import { Stars } from '../../learning/components/GameParts'
import { starsForShare } from '../../learning/starsForShare'
import { stopSpeaking } from '../../../shared/speech/pronunciation'
import { type HeardResult, useSpeechRecognition } from '../../../shared/speech/useSpeechRecognition'
import { type SceneLine, speakersOf } from './dialogueFromText'
import { ListenFirst } from './ListenFirst'
import { type LineScore, scoreLine } from './lineScore'
import { type SelfRating, quietMs, readingMs, selfLabel, selfShare, settleMs, turnText, watchdogMs } from './turn'

type Phase = 'setup' | 'starting' | 'running' | 'ended' | 'failed' | 'finished'
// partner: the other person's line is shown; turn: the learner's line, listening; settling: Done was pressed and
// the last words are awaited; judged: the line has a score.
type StepKind = 'partner' | 'turn' | 'settling' | 'judged'

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

// Practise one side of a scenario's conversation. One recognizer is started once and kept for the whole practice
// (an iPhone does not hear a recognizer that is started again), and the other person's lines are only shown, because
// the microphone would catch the phone's own voice. Nothing is recorded, stored or sent; the result is shown, not kept.
export function SpeakScene({ lines, onClose }: { lines: SceneLine[]; onClose: () => void }) {
  const speakers = speakersOf(lines)
  const [me, setMe] = useState(speakers[0])
  const [phase, setPhase] = useState<Phase>('setup')
  const [kind, setKind] = useState<StepKind>('partner')
  const [step, setStep] = useState(0)
  const [heard, setHeard] = useState('')
  const [results, setResults] = useState<Record<number, LineResult | null>>({})
  const [selfMode, setSelfMode] = useState(false)
  const [stuck, setStuck] = useState(false)

  const phaseRef = useRef<Phase>('setup')
  const kindRef = useRef<StepKind>('partner')
  const stepRef = useRef(0)
  const meRef = useRef(me)
  const selfRef = useRef(false)
  const baseline = useRef(0)
  const resultCount = useRef(0)
  const heardRef = useRef({ text: '', final: false })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const recognition = useSpeechRecognition('en-US', 'D', {
    onResults: (r) => onResults(r),
    onEnd: ({ requested }) => onEnded(requested),
    onEvent: (name) => onRecognizerEvent(name),
  })
  const { supported, error, start, stop } = recognition

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }
  function changeKind(next: StepKind) {
    kindRef.current = next
    setKind(next)
  }
  function clearTimers() {
    clearTimeout(timer.current)
  }
  function clearWatchdog() {
    clearTimeout(watchdog.current)
    setStuck(false)
  }

  function goTo(index: number) {
    clearTimers()
    stepRef.current = index
    setStep(index)
    setHeard('')
    heardRef.current = { text: '', final: false }
    if (index >= lines.length) {
      changePhase('finished')
      if (!selfRef.current) stop()
      return
    }
    if (lines[index].speaker !== meRef.current) {
      changeKind('partner')
      timer.current = setTimeout(() => goTo(index + 1), readingMs(lines[index].text))
      return
    }
    baseline.current = resultCount.current
    changeKind('turn')
  }

  function judge() {
    clearTimers()
    const index = stepRef.current
    const said = heardRef.current.text
    const score = scoreLine(lines[index].text, said)
    setResults((prev) => ({ ...prev, [index]: { share: score.share, score, said } }))
    changeKind('judged')
  }

  function onResults(all: HeardResult[]) {
    resultCount.current = all.length
    if (phaseRef.current !== 'running' || selfRef.current) return
    if (kindRef.current !== 'turn' && kindRef.current !== 'settling') return
    const said = turnText(all, baseline.current)
    heardRef.current = said
    setHeard(said.text)
    clearTimeout(timer.current)
    if (said.final && said.text) {
      // After Done the final result is what was waited for; otherwise a short quiet means the line is over.
      if (kindRef.current === 'settling') judge()
      else timer.current = setTimeout(judge, quietMs)
    }
  }

  function done() {
    if (kindRef.current !== 'turn') return
    if (heardRef.current.final && heardRef.current.text) {
      judge()
      return
    }
    // The last words are still on their way: wait a moment, or for the final result.
    changeKind('settling')
    clearTimeout(timer.current)
    timer.current = setTimeout(judge, settleMs)
  }

  function retry() {
    clearTimers()
    setResults((prev) => ({ ...prev, [stepRef.current]: null }))
    setHeard('')
    heardRef.current = { text: '', final: false }
    baseline.current = resultCount.current
    changeKind('turn')
  }

  function skip() {
    clearTimers()
    setResults((prev) => ({ ...prev, [stepRef.current]: null }))
    goTo(stepRef.current + 1)
  }

  function rate(rating: SelfRating) {
    setResults((prev) => ({ ...prev, [stepRef.current]: { share: selfShare[rating], said: '', self: true } }))
    changeKind('judged')
  }

  function ready() {
    if (phaseRef.current !== 'starting') return
    clearTimeout(fallback.current)
    clearWatchdog()
    changePhase('running')
    goTo(0)
  }

  function onRecognizerEvent(name: string) {
    if (phaseRef.current !== 'starting') return
    if (name === 'audiostart') {
      ready()
    } else if (name === 'start') {
      clearTimeout(fallback.current)
      fallback.current = setTimeout(ready, 1500)
    }
  }

  function onEnded(requested: boolean) {
    if (requested) return
    clearTimeout(fallback.current)
    if (phaseRef.current === 'starting') {
      clearWatchdog()
      changePhase('failed')
    } else if (phaseRef.current === 'running') {
      clearTimers()
      changePhase('ended')
    }
  }

  function begin(self: boolean) {
    meRef.current = me
    selfRef.current = self
    setSelfMode(self)
    setResults({})
    resultCount.current = 0
    baseline.current = 0
    stopSpeaking()
    if (self) {
      changePhase('running')
      goTo(0)
      return
    }
    changePhase('starting')
    clearTimeout(watchdog.current)
    setStuck(false)
    watchdog.current = setTimeout(() => setStuck(true), watchdogMs)
    start()
  }

  function continueSelfRated() {
    selfRef.current = true
    setSelfMode(true)
    changePhase('running')
    goTo(stepRef.current)
  }

  function leave() {
    clearTimers()
    clearWatchdog()
    clearTimeout(fallback.current)
    stop()
    changePhase('setup')
    setResults({})
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(watchdog.current)
      clearTimeout(fallback.current)
      stopSpeaking()
    },
    [],
  )

  const mine = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.speaker === me)
  const rated = mine.filter(({ i }) => results[i])
  const average = rated.length ? rated.reduce((sum, { i }) => sum + (results[i]?.share ?? 0), 0) / rated.length : 0
  const current = lines[Math.min(step, lines.length - 1)]
  const isLast = step === lines.length - 1

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
          <p className="mt-1 text-sm text-slate-700">Choose who you play. The other person&apos;s lines are shown, not spoken. Say only your own lines.</p>
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
          <ListenFirst lines={lines} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white disabled:opacity-50" disabled={!supported} onClick={() => begin(false)} type="button">
              Start speaking
            </button>
            <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300" onClick={() => begin(true)} type="button">
              Self-rate (no microphone)
            </button>
          </div>
          {!supported && <p className="mt-2 text-sm text-amber-900">This browser has no speech recognition, so you can only self-rate.</p>}
          <p className="mt-2 text-xs text-slate-600">The microphone is used by your browser&apos;s speech service, which may send the sound to Apple or Google. VocabFlow records and keeps nothing.</p>
        </div>
      )}

      {phase === 'starting' && !stuck && (
        <p className="mt-2 text-sm text-slate-700" role="status">
          Starting the microphone… if the phone asks, tap Allow.
        </p>
      )}
      {stuck && phase === 'starting' && (
        <div className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>The microphone has not started after {watchdogMs / 1000} seconds.</p>
          <div className="mt-2 flex gap-2">
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={leave} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>The microphone did not start. Check that it is allowed for this site, or rate yourself instead.</p>
          {error && <p className="mt-1">{error}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => begin(false)} type="button">
              Try again
            </button>
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => begin(true)} type="button">
              Self-rate instead
            </button>
          </div>
        </div>
      )}

      {phase === 'ended' && (
        <div className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>The phone stopped listening by itself. Starting it again often does not work on an iPhone, so we do not try. You can rate yourself for the rest of the scene.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={continueSelfRated} type="button">
              Self-rate the rest
            </button>
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => { changePhase('finished') }} type="button">
              See my result so far
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && (
        <div>
          <p className="mt-2 text-xs font-semibold text-indigo-900">
            Line {step + 1} of {lines.length} · you are {me}. Say only your own lines, not the other person&apos;s.
          </p>
          <div className="mt-2 rounded-xl bg-white px-3 py-2 ring-2 ring-indigo-200">
            <p className="text-sm font-semibold text-slate-700">{current.speaker}</p>
            <p className="text-base text-slate-900">{current.text}</p>
          </div>

          {kind === 'partner' && (
            <div className="mt-2" role="status">
              <p className="text-sm text-slate-600">Read this line. Your turn comes next.</p>
              <button className="mt-1 min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={() => goTo(step + 1)} type="button">
                I read it
              </button>
            </div>
          )}

          {(kind === 'turn' || kind === 'settling') && !selfMode && (
            <div className="mt-2" role="status">
              <p className="text-sm text-slate-600">{kind === 'settling' ? 'Checking the last words…' : 'Your turn. Say the line, then tap Done.'}</p>
              <p className="mt-1 min-h-6 font-semibold" data-testid="heard-now">{heard}</p>
              <div className="mt-1 flex gap-2">
                <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white disabled:opacity-50" disabled={kind === 'settling'} onClick={done} type="button">
                  Done
                </button>
                <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300" onClick={retry} type="button">
                  Retry
                </button>
                <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300" onClick={skip} type="button">
                  Skip
                </button>
              </div>
            </div>
          )}

          {kind === 'turn' && selfMode && (
            <div className="mt-2">
              <p className="text-sm text-slate-600">Say the line out loud, then rate yourself.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(selfShare) as SelfRating[]).map((rating) => (
                  <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" key={rating} onClick={() => rate(rating)} type="button">
                    {selfLabel[rating]}
                  </button>
                ))}
                <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300" onClick={skip} type="button">
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
                  <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300" onClick={retry} type="button">
                    Retry this line
                  </button>
                )}
                <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={() => goTo(step + 1)} type="button">
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
            <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={leave} type="button">
              Practise again
            </button>
          </div>
        </div>
      )}
      {error && phase !== 'failed' && (
        <p className="mt-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
