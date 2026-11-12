import { useEffect, useRef, useState } from 'react'
import { isSpeechSupported, speakText, stopSpeaking } from '../../shared/speech/pronunciation'
import { compareSpeech } from './compareSpeech'
import { DiagnosticLog } from './DiagnosticLog'
import { dialogues, isEchoWindow, turnSaid } from './dialogue'
import { type HeardResult, useSpeechRecognition } from './useSpeechRecognition'

type Phase = 'idle' | 'running' | 'ended' | 'finished'
interface Judged {
  line: number
  share: number | null
  said: string
}

const nowMs = () => Date.now()
const heartbeatMs = 15000
const speechGiveUpMs = 20000

// One recognizer for the whole conversation (continuous), the phone speaks the other person's lines.
// Experimental: nothing is stored or sent by the app.
export function DialoguePrototype() {
  const [dialogueId, setDialogueId] = useState(dialogues[0].id)
  const dialogue = dialogues.find((d) => d.id === dialogueId) ?? dialogues[0]
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(0)
  const [heard, setHeard] = useState('')
  const [judged, setJudged] = useState<Judged[]>([])
  const [endedAfter, setEndedAfter] = useState(0)

  const phaseRef = useRef<Phase>('idle')
  const stepRef = useRef(0)
  const baseline = useRef(0)
  const resultCount = useRef(0)
  const heardRef = useRef('')
  const speaking = useRef(false)
  const spokeUntil = useRef(0)
  const startedAt = useRef(0)
  const giveUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dialogueRef = useRef(dialogue)
  const stateRef = useRef('idle')
  useEffect(() => {
    dialogueRef.current = dialogue
  }, [dialogue])

  const recognition = useSpeechRecognition('en-US', 'D', {
    onResults: (results) => onResults(results),
    onEnd: ({ requested }) => onEnded(requested),
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

  function goTo(index: number) {
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
    if (!isSpeechSupported()) {
      note('this browser cannot speak; the other line is only shown')
      goTo(index + 1)
      return
    }
    speaking.current = true
    note(`tts start line ${index + 1}, recognizer ${stateRef.current}`)
    clearTimeout(giveUp.current)
    const proceed = () => {
      if (stepRef.current !== index || !speaking.current) return
      clearTimeout(giveUp.current)
      speaking.current = false
      spokeUntil.current = nowMs()
      baseline.current = resultCount.current
      note(`tts end line ${index + 1}; ignoring results until ${1000} ms later`)
      goTo(index + 1)
    }
    giveUp.current = setTimeout(() => {
      note(`tts gave no end after ${speechGiveUpMs / 1000} s; going on`)
      proceed()
    }, speechGiveUpMs)
    speakText(line.text, { onStart: () => note(`tts onstart line ${index + 1}`), onEnd: proceed })
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

  function onEnded(requested: boolean) {
    note(`recognizer ended after ${seconds()} s ${requested ? '(asked by us)' : '(NOT asked by us: the phone ended it)'}`)
    if (requested || phaseRef.current !== 'running') return
    clearTimeout(giveUp.current)
    speaking.current = false
    stopSpeaking()
    setEndedAfter(seconds())
    changePhase('ended')
  }

  function begin(fromStart: boolean) {
    if (fromStart) {
      setJudged([])
      stepRef.current = 0
      startedAt.current = nowMs()
    }
    baseline.current = 0
    resultCount.current = 0
    start()
    changePhase('running')
    goTo(stepRef.current)
  }

  function leave() {
    clearTimeout(giveUp.current)
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

  useEffect(
    () => () => {
      clearTimeout(giveUp.current)
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
          disabled={phase === 'running'}
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
      {phase === 'running' && !yourTurn && step < dialogue.lines.length && <p className="mt-3 text-sm text-slate-600">{dialogue.otherRole} is speaking…</p>}

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
        {phase === 'running' ? (
          <button className="min-h-11 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800" onClick={leave} type="button">
            Stop the conversation
          </button>
        ) : (
          <button
            className="min-h-11 w-full rounded-xl bg-indigo-700 px-4 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
            disabled={!supported || state === 'stopping' || phase === 'ended'}
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
