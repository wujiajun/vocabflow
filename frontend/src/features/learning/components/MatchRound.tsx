import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { type MatchPair, shuffle } from './matching'

export interface RoundResult {
  total: number
  // Words matched on the first try; the rest are named so they can be looked at again.
  firstTry: number
  missed: string[]
}

// How far a finger or mouse must move before a press counts as a drag rather than a tap.
const dragDistance = 6

// The meanings are cards, the words are chips, and a chip goes onto the card it means: by dragging it,
// or, for anyone who cannot drag, by choosing the word and then the card (which is also how the
// keyboard and a screen reader play).
export function MatchRound({
  pairs,
  continueLabel,
  onContinue,
}: {
  pairs: MatchPair[]
  continueLabel: string
  onContinue: (result: RoundResult) => void
}) {
  const chips = useMemo(() => shuffle(pairs), [pairs])
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set())
  const [missed, setMissed] = useState<ReadonlySet<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [shaking, setShaking] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number; over: number | null } | null>(null)
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  const trayRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const done = matched.size === pairs.length
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

  function attempt(wordId: number, cardId: number) {
    const word = pairs.find((pair) => pair.id === wordId)
    setSelected(null)
    if (wordId === cardId) {
      setMatched((current) => new Set(current).add(wordId))
      setMessage(`Correct: ${word?.term}.`)
    } else {
      setMissed((current) => new Set(current).add(wordId))
      setShaking(wordId)
      setMessage('Not that one. Try another meaning.')
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
      attempt(current.id, target)
    }
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
    setSelected((current) => (current === id ? null : id))
    setMessage('')
  }

  function chooseCard(id: number) {
    if (selected === null) {
      setMessage('Choose a word first, or drag one onto a meaning.')
      return
    }
    attempt(selected, id)
  }

  return (
    <div>
      <p className="text-sm text-slate-600">Drag each word onto its meaning, or tap a word and then a meaning.</p>

      <ul aria-label="Meanings" className="mt-4 space-y-2">
        {pairs.map((pair) => {
          const placed = matched.has(pair.id)
          return (
            <li key={pair.id}>
              {placed ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 motion-safe:animate-pop">
                  <p className="text-base font-bold text-emerald-900">{pair.term}</p>
                  <p className="mt-0.5 text-sm text-emerald-900">{pair.definition}</p>
                </div>
              ) : (
                <button
                  className={`w-full rounded-xl border-2 border-dashed px-4 py-3 text-left text-sm leading-6 text-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                    drag?.over === pair.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                  data-card-id={pair.id}
                  onClick={() => chooseCard(pair.id)}
                  type="button"
                >
                  {pair.definition}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-600" role="status">
        {message}
      </p>

      {done ? (
        <div className="mt-3 rounded-xl bg-indigo-50 px-4 py-4">
          <h3 className="text-lg font-bold tracking-tight outline-none" ref={doneRef} tabIndex={-1}>
            {missed.size === 0 ? 'All matched on the first try!' : 'All matched!'}
          </h3>
          <button
            className="mt-3 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={() =>
              onContinue({
                total: pairs.length,
                firstTry: pairs.length - missed.size,
                missed: pairs.filter((pair) => missed.has(pair.id)).map((pair) => pair.term),
              })
            }
            type="button"
          >
            {continueLabel}
          </button>
        </div>
      ) : (
        <div aria-label="Words" className="mt-3 flex flex-wrap gap-2" ref={trayRef} role="group">
          {remaining.map((pair) => {
            const dragging = drag?.id === pair.id
            return (
              <button
                aria-pressed={selected === pair.id}
                className={`relative cursor-grab touch-none rounded-full border px-4 py-2 text-base font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                  selected === pair.id ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-indigo-300 bg-white text-indigo-900'
                } ${dragging ? 'z-20 cursor-grabbing shadow-lg' : 'motion-safe:transition-transform'} ${
                  shaking === pair.id ? 'motion-safe:animate-shake' : ''
                }`}
                key={pair.id}
                onAnimationEnd={() => setShaking(null)}
                onClick={() => chooseChip(pair.id)}
                onPointerCancel={cancelChip}
                onPointerDown={(event) => pressChip(event, pair.id)}
                onPointerMove={moveChip}
                onPointerUp={releaseChip}
                style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` } : undefined}
                type="button"
              >
                {pair.term}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
