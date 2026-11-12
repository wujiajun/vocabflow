import { useEffect, useRef, useState } from 'react'
import { isSpeechSupported, speakText, stopSpeaking } from '../../shared/speech/pronunciation'
import { compareSpeech } from '../../shared/speech/compareSpeech'
import { DiagnosticLog } from './DiagnosticLog'
import { dialogues, graceMs, isEchoWindow, readingMs, speechTimeoutMs, turnSaid } from './dialogue'
import { type HeardResult, useSpeechRecognition } from '../../shared/speech/useSpeechRecognition'

type Phase = 'idle' | 'starting' | 'running' | 'ended' | 'failed' | 'finished'
interface Judged {
  line: number
  share: number | null
  said: string
}
interface Stuck {
  kind: 'starting' | 'speaking'
  where: string
  index: number
}

const nowMs = () => Date.now()
const heartbeatMs = 15000
export const watchdogMs = 10000
const startFallbackMs = 1500
const retryDelayMs = 400
const pollMs = 500

type Partner = 'speak' | 'text'

function synthState() {
  const synth = window.speechSynthesis
  return `speaking=${synth.speaking} paused=${synth.paused} pending=${synth.pending}`
}

// One recognizer for the whole conversation (continuous), the phone speaks the other person's lines.
// The microphone is asked for first, and nothing is spoken until it is ready: the permission prompt would
// cut the speech off. Every step has a watchdog so that a speech that was cut off cannot stop the page.
// Experimental: nothing is stored or sent by the app.
export function DialoguePrototype({ onBack }: { onBack?: () => void }) {
  const [dialogueId, setDialogueId] = useState(dialogues[0].id)
  const dialogue = dialogues.find((d) => d.id === dialogueId) ?? dialogues[0]
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(0)
  const [heard, setHeard] = useState('')
  const [judged, setJudged] = useState<Judged[]>([])
  const [endedAfter, setEndedAfter] = useState(0)
  const [stuck, setStuck] = useState<Stuck | null>(null)
  const [partner, setPartner] = useState<Partner>('speak')
  const [blocked, setBlocked] = useState(false)
  const [reading, setReading] = useState<number | null>(null)

  const phaseRef = useRef<Phase>('idle')
  const stepRef = useRef(0)
  const token = useRef(0)
  const baseline = useRef(0)
  const resultCount = useRef(0)
  const heardRef = useRef('')
  const speaking = useRef(false)
  const spokeUntil = useRef(0)
  const startedAt = useRef(0)
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const partnerRef = useRef<Partner>('speak')
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const poll = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const dialogueRef = useRef(dialogue)
  const stateRef = useRef('idle')
  useEffect(() => {
    dialogueRef.current = dialogue
  }, [dialogue])

  const recognition = useSpeechRecognition('en-US', 'D', {
    onResults: (results) => onResults(results),
    onEnd: ({ requested }) => onEnded(requested),
    onEvent: (name) => onRecognizerEvent(name),
  })
  const { supported, state, error, log, start, stop, clearLog, note } = recognition
  useEffect(() => {
    stateRef.current = state
  }, [state])

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function seconds() {
    return Math.round((nowMs() - startedAt.current) / 100) / 10
  }

  function clearWatchdog() {
    clearTimeout(watchdog.current)
    setStuck(null)
  }

  // If nothing moves on within the time, the page offers a way out and the log says where it stopped.
  function armWatchdog(kind: Stuck['kind'], where: string, index: number) {
    clearTimeout(watchdog.current)
    setStuck(null)
    watchdog.current = setTimeout(() => {
      note(`STUCK: no progress for ${watchdogMs / 1000} s at "${where}"`)
      setStuck({ kind, where, index })
    }, watchdogMs)
  }

  function clearSpeechTimers() {
    clearTimeout(speechTimer.current)
    clearTimeout(readTimer.current)
    clearInterval(poll.current)
    setReading(null)
  }

  function goTo(index: number) {
    token.current++
    clearWatchdog()
    clearSpeechTimers()
    stepRef.current = index
    setStep(index)
    setHeard('')
    heardRef.current = ''
    const lines = dialogueRef.current.lines
    if (index >= lines.length) {
      note(`conversation finished after ${seconds()} s`)
      changePhase('finished')
      stop()
      return
    }
    const line = lines[index]
    if (line.speaker === 'you') {
      note(`your turn (line ${index + 1})`)
      return
    }
    if (partnerRef.current === 'text' || !isSpeechSupported()) {
      readLine(index)
      return
    }
    speakLine(index, 0)
  }

  function endSpeech(index: number, how: string) {
    speaking.current = false
    spokeUntil.current = nowMs()
    baseline.current = resultCount.current
    note(`tts line ${index + 1} over (${how}); results are ignored for ${graceMs} ms`)
    goTo(index + 1)
  }

  function speakLine(index: number, attempt: number) {
    const mine = ++token.current
    const line = dialogueRef.current.lines[index]
    let started = false
    let failure = ''
    speaking.current = true
    clearSpeechTimers()
    note(`tts line ${index + 1} speak, attempt ${attempt + 1}, recognizer ${stateRef.current}, synth before: ${synthState()}`)
    armWatchdog('speaking', `the phone speaking line ${index + 1}`, index)
    // Does the speech go on while the microphone is open? Every change of the speech state is logged.
    let last = ''
    poll.current = setInterval(() => {
      const now = synthState()
      if (now !== last) {
        last = now
        note(`tts line ${index + 1} synth: ${now}`)
      }
    }, pollMs)
    speechTimer.current = setTimeout(() => {
      if (token.current !== mine) return
      note(`TTS BLOCKED: line ${index + 1} ${started ? 'started but' : 'never started and'} gave no end in ${speechTimeoutMs(line.text)} ms while the microphone is on; synth: ${synthState()}; speech cancelled`)
      stopSpeaking()
      setBlocked(true)
      partnerRef.current = 'text'
      setPartner('text')
      speaking.current = false
      readLine(index)
    }, speechTimeoutMs(line.text))
    speakText(line.text, {
      onStart: () => {
        if (token.current !== mine) return
        started = true
        note(`tts line ${index + 1} onstart`)
      },
      onError: (reason) => {
        if (token.current !== mine) return
        failure = reason
        note(`tts line ${index + 1} onerror: ${reason}`)
      },
      onPauseResume: (event) => {
        if (token.current !== mine) return
        note(`tts line ${index + 1} on${event}; synth: ${synthState()}`)
      },
      onEnd: () => {
        if (token.current !== mine) return
        clearSpeechTimers()
        if (!failure && started) {
          endSpeech(index, 'ended normally')
          return
        }
        note(`tts line ${index + 1} did not finish normally (${failure || 'it never started'})`)
        if (attempt === 0) {
          setTimeout(() => {
            if (token.current === mine) speakLine(index, 1)
          }, retryDelayMs)
        } else {
          endSpeech(index, 'skipped after a second failure')
        }
      },
    })
  }

  // The other person's line is only shown; the learner reads it and taps, or it moves on after a time.
  function readLine(index: number) {
    const mine = ++token.current
    clearSpeechTimers()
    clearWatchdog()
    speaking.current = false
    setReading(index)
    const wait = readingMs(dialogueRef.current.lines[index].text)
    note(`line ${index + 1} is shown, not spoken; it moves on after ${wait} ms or when "I read it" is tapped`)
    readTimer.current = setTimeout(() => {
      if (token.current === mine) finishReading(index, 'time')
    }, wait)
  }

  function finishReading(index: number, how: string) {
    note(`line ${index + 1} read (${how})`)
    baseline.current = resultCount.current
    goTo(index + 1)
  }

  function retrySpeech(index: number) {
    note(`Retry pressed at line ${index + 1}`)
    stopSpeaking()
    speakLine(index, 0)
  }

  function skipSpeech(index: number) {
    note(`speech of line ${index + 1} skipped by the learner`)
    token.current++
    stopSpeaking()
    endSpeech(index, 'skipped by the learner')
  }

  function judge(said: string, how: string) {
    const index = stepRef.current
    const line = dialogueRef.current.lines[index]
    const share = said ? compareSpeech(line.text, said).share : 0
    note(`line ${index + 1} judged by ${how}: ${Math.round(share * 100)}% "${said}"`)
    setJudged((prev) => [...prev, { line: index, share, said }])
    baseline.current = resultCount.current
    goTo(index + 1)
  }

  function onResults(results: HeardResult[]) {
    resultCount.current = results.length
    if (phaseRef.current !== 'running') return
    if (isEchoWindow(nowMs(), speaking.current, spokeUntil.current)) {
      baseline.current = results.length
      note(`discarded: results arrived while the phone was speaking (n=${results.length})`)
      return
    }
    const line = dialogueRef.current.lines[stepRef.current]
    if (!line || line.speaker !== 'you') return
    const said = turnSaid(results, baseline.current)
    heardRef.current = said.text
    setHeard(said.text)
    if (said.final) judge(said.text, 'final result')
  }

  // The microphone is ready: only now does the conversation begin.
  function ready(how: string) {
    if (phaseRef.current !== 'starting') return
    clearTimeout(fallback.current)
    note(`microphone ready (${how}) after ${seconds()} s; the conversation begins`)
    clearWatchdog()
    changePhase('running')
    goTo(stepRef.current)
  }

  function onRecognizerEvent(name: string) {
    if (name === 'audiostart' && isSpeechSupported()) note(`speech state at audiostart: ${synthState()}`)
    if (phaseRef.current !== 'starting') return
    if (name === 'audiostart') {
      ready('onaudiostart')
    } else if (name === 'start') {
      // Some phones may send onstart before the question is answered, so audiostart is waited for a moment.
      clearTimeout(fallback.current)
      fallback.current = setTimeout(() => ready('onstart only'), startFallbackMs)
    }
  }

  function onEnded(requested: boolean) {
    note(`recognizer ended after ${seconds()} s ${requested ? '(asked by us)' : '(NOT asked by us: the phone ended it)'}`)
    if (requested) return
    clearTimeout(fallback.current)
    if (phaseRef.current === 'starting') {
      note('the microphone could not be started (refused, or an error before it began)')
      clearWatchdog()
      changePhase('failed')
      return
    }
    if (phaseRef.current !== 'running') return
    clearWatchdog()
    speaking.current = false
    token.current++
    stopSpeaking()
    clearSpeechTimers()
    setEndedAfter(seconds())
    changePhase('ended')
  }

  function begin(fromStart: boolean) {
    if (fromStart) {
      setJudged([])
      stepRef.current = 0
      setStep(0)
      startedAt.current = nowMs()
    }
    token.current++
    baseline.current = 0
    resultCount.current = 0
    setHeard('')
    note('asking for the microphone: start() called; nothing is spoken until it is ready (a permission question may appear now)')
    changePhase('starting')
    armWatchdog('starting', 'waiting for the microphone to start', 0)
    start()
  }

  function leave() {
    token.current++
    clearTimeout(fallback.current)
    clearWatchdog()
    clearSpeechTimers()
    speaking.current = false
    stopSpeaking()
    changePhase('idle')
    stop()
  }

  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => note(`still listening, ${seconds()} s`), heartbeatMs)
    return () => clearInterval(timer)
  }, [phase, note])

  // The permission question and phone calls show up here.
  useEffect(() => {
    if (phase === 'idle') return
    const onVisibility = () => note(`page ${document.visibilityState}`)
    const onBlur = () => note('window lost focus')
    const onFocus = () => note('window got focus')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [phase, note])

  useEffect(
    () => () => {
      token.current++
      clearTimeout(watchdog.current)
      clearTimeout(fallback.current)
      clearTimeout(speechTimer.current)
      clearTimeout(readTimer.current)
      clearInterval(poll.current)
      stopSpeaking()
    },
    [],
  )

  const line = dialogue.lines[Math.min(step, dialogue.lines.length - 1)]
  const yourTurn = phase === 'running' && step < dialogue.lines.length && line.speaker === 'you'
  const scored = judged.filter((j) => j.share !== null)
  const average = scored.length ? Math.round((scored.reduce((sum, j) => sum + (j.share ?? 0), 0) / scored.length) * 100) : 0

  return (
    <div>
      <p className="mt-1 text-sm text-slate-600">
        Experimental. You play one side of a short conversation; the phone speaks the other side. The microphone is started once and stays on for the whole conversation.
        Wear headphones for the first try, then try again with the speaker.
      </p>
      {!supported && (
        <p className="mt-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          This browser has no speech recognition.
        </p>
      )}

      <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
        Conversation
        <select
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-2"
          disabled={phase === 'running' || phase === 'starting'}
          onChange={(e) => {
            setDialogueId(e.target.value)
            setJudged([])
            setStep(0)
            stepRef.current = 0
            changePhase('idle')
          }}
          value={dialogueId}
        >
          {dialogues.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} (you are the {d.yourRole.toLowerCase()})
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
        Partner lines
        <select
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-2"
          disabled={phase === 'running' || phase === 'starting'}
          onChange={(e) => {
            partnerRef.current = e.target.value as Partner
            setPartner(e.target.value as Partner)
            setBlocked(false)
          }}
          value={partner}
        >
          <option value="speak">Speak (the phone reads them aloud)</option>
          <option value="text">Text only (you read them)</option>
        </select>
      </label>
      {blocked && (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
          The phone did not speak while the microphone was on, so the other person's lines are only shown from now on.
        </p>
      )}

      <ol className="mt-4 space-y-2" aria-label="Conversation">
        {dialogue.lines.map((l, i) => {
          const result = judged.find((j) => j.line === i)
          const visible = l.speaker === 'other' ? i <= step && phase !== 'idle' : i === step && phase === 'running' || result !== undefined
          const current = i === step && phase === 'running'
          return (
            <li className={`rounded-xl px-3 py-2 text-sm ${current ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-slate-50'}`} key={i}>
              <span className="font-semibold text-slate-700">{l.speaker === 'you' ? dialogue.yourRole : dialogue.otherRole}</span>
              {l.speaker === 'you' && !visible ? (
                <span className="ml-2 text-slate-500">…</span>
              ) : (
                <span className="ml-2 text-slate-900">{l.text}</span>
              )}
              {result && (
                <span className="ml-2 text-xs text-slate-600" data-testid={`result-${i}`}>
                  {result.share === null ? 'skipped' : `${Math.round(result.share * 100)}%`}
                  {result.said ? ` · heard "${result.said}"` : ''}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {yourTurn && (
        <div className="mt-3" role="status">
          <p className="text-sm text-slate-600">Your turn. Say your line. Heard so far:</p>
          <p className="mt-1 min-h-6 font-semibold" data-testid="heard-now">{heard}</p>
          <div className="mt-2 flex gap-2">
            <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={() => judge(heardRef.current, 'Done button')} type="button">
              Done
            </button>
            <button
              className="min-h-11 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800"
              onClick={() => {
                const index = stepRef.current
                note(`line ${index + 1} skipped`)
                setJudged((prev) => [...prev, { line: index, share: null, said: '' }])
                baseline.current = resultCount.current
                goTo(index + 1)
              }}
              type="button"
            >
              Skip
            </button>
          </div>
        </div>
      )}
      {phase === 'starting' && !stuck && (
        <p className="mt-3 text-sm text-slate-600" role="status">
          Starting the microphone… if the phone asks, tap Allow. The conversation begins after that.
        </p>
      )}
      {phase === 'running' && reading !== null && (
        <div className="mt-3" role="status">
          <p className="text-sm text-slate-600">Read what the {dialogue.otherRole.toLowerCase()} says, then tap.</p>
          <button className="mt-2 min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={() => finishReading(reading, 'I read it')} type="button">
            I read it
          </button>
        </div>
      )}
      {phase === 'running' && !yourTurn && reading === null && step < dialogue.lines.length && !stuck && (
        <p className="mt-3 text-sm text-slate-600">{dialogue.otherRole} is speaking…</p>
      )}
      {stuck && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>Nothing has moved for {watchdogMs / 1000} seconds: {stuck.where}.</p>
          <div className="mt-2 flex gap-2">
            {stuck.kind === 'speaking' ? (
              <>
                <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => retrySpeech(stuck.index)} type="button">
                  Retry
                </button>
                <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => skipSpeech(stuck.index)} type="button">
                  Skip this line
                </button>
              </>
            ) : (
              <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={leave} type="button">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {phase === 'failed' && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>The microphone did not start, so the conversation cannot begin. Check that it is allowed for this site, or go back to the one-sentence test.</p>
          <div className="mt-2 flex gap-2">
            <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => begin(true)} type="button">
              Try again
            </button>
            {onBack && (
              <button className="min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={onBack} type="button">
                Back to the one-sentence test
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'ended' && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>
            The phone ended the listening by itself after {endedAfter} s. On an iPhone, starting to listen again often does not work, so we cannot promise to carry on. You can
            try: it may show your words, or it may stay silent. If it stays silent, leave this page and open it again.
          </p>
          <button className="mt-2 min-h-11 rounded-xl bg-amber-200 px-4 font-semibold" onClick={() => begin(false)} type="button">
            Try listening again
          </button>
        </div>
      )}
      {phase === 'finished' && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Finished. Average of your lines: {average}% ({scored.length} of {judged.length} judged).
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {phase === 'running' || phase === 'starting' ? (
          <button className="min-h-11 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800" onClick={leave} type="button">
            Stop the conversation
          </button>
        ) : (
          <button
            className="min-h-11 w-full rounded-xl bg-indigo-700 px-4 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
            disabled={!supported || state === 'stopping' || phase === 'ended' || phase === 'failed'}
            onClick={() => begin(true)}
            type="button"
          >
            {state === 'stopping' ? 'Wait…' : phase === 'finished' ? 'Start again' : 'Start the conversation'}
          </button>
        )}
      </div>

      <DiagnosticLog lang="en-US" lines={log} onClear={clearLog} onNote={note} variant="dialogue (D, one recognizer)" />
    </div>
  )
}
