import { useEffect, useRef, useState } from 'react'
import { isSpeechSupported, speakText, stopSpeaking } from '../../../shared/speech/pronunciation'
import { type SceneLine, speakersOf } from './dialogueFromText'

type Play = 'idle' | 'playing' | 'paused'

// The whole conversation read aloud, one voice (pitch) for each speaker. The microphone is off here.
export function ListenFirst({ lines }: { lines: SceneLine[] }) {
  const [play, setPlay] = useState<Play>('idle')
  const [index, setIndex] = useState(0)
  const token = useRef(0)
  const speakers = speakersOf(lines)

  function playFrom(from: number) {
    const mine = ++token.current
    if (from >= lines.length) {
      setPlay('idle')
      setIndex(0)
      return
    }
    setPlay('playing')
    setIndex(from)
    speakText(lines[from].text, {
      pitch: speakers.indexOf(lines[from].speaker) % 2 === 0 ? 1 : 0.75,
      onStart: () => undefined,
      onEnd: () => {
        if (token.current === mine) playFrom(from + 1)
      },
    })
  }

  function halt(next: Play) {
    token.current++
    stopSpeaking()
    setPlay(next)
    if (next === 'idle') setIndex(0)
  }

  useEffect(
    () => () => {
      token.current++
      stopSpeaking()
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
