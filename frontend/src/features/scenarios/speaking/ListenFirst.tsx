import { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { isSpeechSupported, speakText, stopSpeaking } from '../../../shared/speech/pronunciation'
import type { SceneLine } from './dialogueFromText'
import { roleFor } from './turn'

type Play = 'idle' | 'playing' | 'paused'

// The whole conversation read aloud, the other person in the main voice and the learner (`me`) in the second. The microphone is off here.
// `stopRef` lets the page stop the reading before it starts its own speech.
export function ListenFirst({
  lines,
  me,
  stopRef,
}: {
  lines: SceneLine[]
  me: string
  stopRef?: MutableRefObject<(() => void) | null>
}) {
  const [play, setPlay] = useState<Play>('idle')
  const [index, setIndex] = useState(0)
  const token = useRef(0)
  const playing = useRef(false) // only its own reading is stopped when it goes away, not what follows it

  function playFrom(from: number) {
    const mine = ++token.current
    if (from >= lines.length) {
      playing.current = false
      setPlay('idle')
      setIndex(0)
      return
    }
    playing.current = true
    setPlay('playing')
    setIndex(from)
    speakText(lines[from].text, {
      role: roleFor(me, lines[from].speaker),
      onStart: () => undefined,
      onEnd: () => {
        if (token.current === mine) playFrom(from + 1)
      },
    })
  }

  function halt(next: Play) {
    token.current++
    playing.current = false
    stopSpeaking()
    setPlay(next)
    if (next === 'idle') setIndex(0)
  }

  useEffect(() => {
    if (!stopRef) return
    stopRef.current = () => {
      if (playing.current) halt('idle')
    }
    return () => {
      stopRef.current = null
    }
  })

  useEffect(
    () => () => {
      token.current++
      if (playing.current) stopSpeaking()
    },
    [],
  )

  if (!isSpeechSupported()) return null
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {play === 'playing' ? (
          <button className="min-h-11 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-800" onClick={() => halt('paused')} type="button">
            Pause
          </button>
        ) : (
          <button className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800" onClick={() => playFrom(play === 'paused' ? index : 0)} type="button">
            {play === 'paused' ? 'Resume' : 'Listen first'}
          </button>
        )}
        {play !== 'idle' && (
          <button className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800" onClick={() => halt('idle')} type="button">
            Stop
          </button>
        )}
      </div>
      {play !== 'idle' && (
        <p className="mt-2 text-sm text-slate-700" role="status">
          {lines[index].speaker}: {lines[index].text}
        </p>
      )}
    </div>
  )
}
