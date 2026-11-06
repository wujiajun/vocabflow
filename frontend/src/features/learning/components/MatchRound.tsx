import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { isSpeechSupported, speakText } from '../../../shared/speech/pronunciation'
import { playRight, playWrong } from '../../../shared/sound/effects'
import { GameProgress, ScorePills, gamePrimaryButton } from './GameParts'
import { type MatchPair, shuffle } from './matching'

export interface RoundResult {
  total: number
  // Words matched on the first try; the rest are named so they can be looked at again.
  firstTry: number
  missed: string[]
  // The run of words placed right the first time, at the end of the round and the longest in it.
  streak: number
  bestStreak: number
}

// What the earlier rounds of the game added up to, so the score, the streak and the bar run on across rounds.
export interface GameSoFar {
  placed: number
  firstTry: number
  streak: number
  total: number
}

// How long a wrong answer stays red.
const wrongMs = 900

// How far a finger or mouse must move before a press counts as a drag rather than a tap.
const dragDistance = 6

// The meanings are cards, the words are chips, and a chip goes onto the card it means: by dragging it,
// or, for anyone who cannot drag, by choosing the word and then the card (which is also how the
// keyboard and a screen reader play).
export function MatchRound({
  pairs,
  heading,
  before,
  continueLabel,
  onContinue,
  sounds = false,
}: {
  pairs: MatchPair[]
  heading: string
  before: GameSoFar
  continueLabel: string
  onContinue: (result: RoundResult) => void
  // The chips are sounds, not words: a chip says its word when tapped and shows only a number, and
  // the cards are sentences with a blank. The word then shows on the card it was placed on.
  sounds?: boolean
}) {
  const chips = useMemo(() => shuffle(pairs), [pairs])
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set())
  const [missed, setMissed] = useState<ReadonlySet<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  // The word and the meaning of the last wrong answer, red for a moment.
  const [wrong, setWrong] = useState<{ wordId: number; cardId: number } | null>(null)
  const [message, setMessage] = useState('')
  const [streak, setStreak] = useState(before.streak)
  const [bestStreak, setBestStreak] = useState(before.streak)
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number; over: number | null } | null>(null)
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  // A touch drag is answered when the finger has left the screen: the browsers that only allow a voice or
  // a sound from a press count that moment (touchend), not the earlier pointerup.
  const deferred = useRef<(() => void) | null>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const done = matched.size === pairs.length
  const firstTryNow = before.firstTry + [...matched].filter((id) => !missed.has(id)).length
  const remaining = chips.filter((pair) => !matched.has(pair.id))

  // The word just placed leaves the tray, and the control pressed with it: keep the keyboard in the game.
  useEffect(() => {
    if (done) {
      doneRef.current?.focus()
    } else if (matched.size > 0) {
      trayRef.current?.querySelector('button')?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.size])

  useEffect(() => () => clearTimeout(wrongTimer.current), [])

  // Called from a press or a drop, which is where the browser lets a sound or a voice start.
  function attempt(wordId: number, cardId: number) {
    const word = pairs.find((pair) => pair.id === wordId)
    setSelected(null)
    if (wordId === cardId) {
      setMatched((current) => new Set(current).add(wordId))
      setWrong(null)
      // Only a word placed right the first time keeps the streak going.
      if (!missed.has(wordId)) {
        const next = streak + 1
        setStreak(next)
        setBestStreak((best) => Math.max(best, next))
      }
      playRight()
      setMessage(`Correct: ${word?.term}.`)
      if (word && isSpeechSupported()) {
        speakText(word.term, { onStart: () => {}, onEnd: () => {} })
      }
    } else {
      setStreak(0)
      setMissed((current) => new Set(current).add(wordId))
      setWrong({ wordId, cardId })
      clearTimeout(wrongTimer.current)
      wrongTimer.current = setTimeout(() => setWrong(null), wrongMs)
      setMessage(sounds ? 'Not that one. Try another sound.' : 'Not that one. Try another meaning.')
      playWrong()
    }
  }

  function cardAt(x: number, y: number) {
    // jsdom and very old browsers have no such call; there the game is played by tapping.
    const elements = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : []
    for (const element of elements) {
      const card = element.closest<HTMLElement>('[data-card-id]')
      if (card) {
        return Number(card.dataset.cardId)
      }
    }
    return null
  }

  function pressChip(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    press.current = { id, x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveChip(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current
    if (!current) {
      return
    }
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.moved && Math.hypot(dx, dy) < dragDistance) {
      return
    }
    current.moved = true
    setSelected(null)
    setDrag({ id: current.id, dx, dy, over: cardAt(event.clientX, event.clientY) })
  }

  function releaseChip(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current
    press.current = null
    if (!current?.moved) {
      return
    }

    // The click that follows a drag must not also select the word; some browsers send none, so the
    // flag is dropped again once this event is over.
    swallowClick.current = true
    setTimeout(() => {
      swallowClick.current = false
    }, 0)
    const target = cardAt(event.clientX, event.clientY)
    setDrag(null)
    if (target !== null && !matched.has(target)) {
      if (event.pointerType === 'touch') {
        deferred.current = () => attempt(current.id, target)
        // Should the touchend never come, the answer is still given.
        setTimeout(answerDeferred, 150)
      } else {
        attempt(current.id, target)
      }
    }
  }

  function answerDeferred() {
    const answer = deferred.current
    deferred.current = null
    answer?.()
  }

  function cancelChip() {
    press.current = null
    setDrag(null)
  }

  function chooseChip(id: number) {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    setMessage('')
    if (sounds) {
      // A tap on a sound plays it, every time, and keeps it chosen.
      setSelected(id)
      const word = pairs.find((pair) => pair.id === id)
      if (word && isSpeechSupported()) {
        speakText(word.term, { onStart: () => {}, onEnd: () => {} })
      }
      return
    }
    setSelected((current) => (current === id ? null : id))
  }

  function chooseCard(id: number) {
    if (selected === null) {
      setMessage(sounds ? 'Tap a sound first, or drag one onto a sentence.' : 'Choose a word first, or drag one onto a meaning.')
      return
    }
    attempt(selected, id)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{heading}</h2>
        <ScorePills score={firstTryNow} scoreLabel="right on the first try" streak={streak} />
      </div>
      <GameProgress max={before.total} value={before.placed + matched.size} />
      <p className="mt-3 text-xs text-slate-600">
        {sounds
          ? 'Tap a sound to hear it, then drag it onto the sentence it fits, or tap the sentence.'
          : 'Drag each word onto its meaning, or tap a word and then a meaning.'}
      </p>

      <ul aria-label={sounds ? 'Sentences' : 'Meanings'} className="mt-2 space-y-1.5">
        {pairs.map((pair) => {
          const placed = matched.has(pair.id)
          return (
            <li key={pair.id}>
              {placed ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 motion-safe:animate-pop">
                  <p className="text-base font-bold text-emerald-900">{pair.term}</p>
                  <p className="text-sm leading-5 text-emerald-900">{pair.filled ?? pair.definition}</p>
                </div>
              ) : (
                <button
                  className={`w-full rounded-xl border-2 border-dashed px-3 py-2 text-left text-sm leading-5 text-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                    wrong?.cardId === pair.id
                      ? 'border-solid border-rose-600 bg-rose-100 text-rose-900'
                      : drag?.over === pair.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                  data-card-id={pair.id}
                  data-wrong={wrong?.cardId === pair.id || undefined}
                  onClick={() => chooseCard(pair.id)}
                  type="button"
                >
                  {pair.definition}
                  {pair.hint ? <span className="mt-1 block text-xs leading-4 text-slate-600">{pair.hint}</span> : null}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {/* Stays at the bottom of the screen, so the words are in reach however tall the meanings are. */}
      <div className="sticky bottom-0 z-10 -mx-3 mt-2 rounded-b-2xl border-t border-slate-200 bg-white/95 px-3 pt-2 pb-1 backdrop-blur sm:-mx-7 sm:px-7">
        <p
          aria-live="polite"
          className={`mb-2 min-h-5 text-sm ${wrong ? 'font-semibold text-rose-700' : 'text-slate-600'}`}
          role="status"
        >
          {message}
        </p>
        {done ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 motion-safe:animate-pop">
            <h3 className="text-lg font-bold tracking-tight text-emerald-950 outline-none" ref={doneRef} tabIndex={-1}>
              <span aria-hidden="true">✓ </span>
              {missed.size === 0 ? 'All matched on the first try!' : 'All matched!'}
            </h3>
            <button
              className={`shrink-0 ${gamePrimaryButton}`}
              onClick={() =>
                onContinue({
                  total: pairs.length,
                  firstTry: pairs.length - missed.size,
                  missed: pairs.filter((pair) => missed.has(pair.id)).map((pair) => pair.term),
                  streak,
                  bestStreak,
                })
              }
              type="button"
            >
              {continueLabel}
            </button>
          </div>
        ) : (
          <div aria-label={sounds ? 'Sounds' : 'Words'} className="flex flex-wrap gap-2 pb-1" ref={trayRef} role="group">
            {remaining.map((pair) => {
              const dragging = drag?.id === pair.id
              return (
                <button
                  aria-label={sounds ? `Play sound ${chips.indexOf(pair) + 1}` : undefined}
                  aria-pressed={selected === pair.id}
                  className={`relative inline-flex min-h-11 cursor-grab touch-none items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-base font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                    wrong?.wordId === pair.id
                      ? 'border-rose-600 bg-rose-100 text-rose-900'
                      : selected === pair.id
                        ? 'border-indigo-700 bg-indigo-700 text-white'
                        : 'border-indigo-300 bg-white text-indigo-900'
                  } ${dragging ? 'z-20 cursor-grabbing shadow-lg' : 'motion-safe:transition-transform'} ${
                    wrong?.wordId === pair.id ? 'motion-safe:animate-shake' : ''
                  }`}
                  key={pair.id}
                  onClick={() => chooseChip(pair.id)}
                  onPointerCancel={cancelChip}
                onTouchEnd={answerDeferred}
                  onPointerDown={(event) => pressChip(event, pair.id)}
                  onPointerMove={moveChip}
                  onPointerUp={releaseChip}
                  style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` } : undefined}
                  type="button"
                >
                  {sounds ? (
                    <>
                      <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      </svg>
                      {chips.indexOf(pair) + 1}
                    </>
                  ) : (
                    pair.term
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
