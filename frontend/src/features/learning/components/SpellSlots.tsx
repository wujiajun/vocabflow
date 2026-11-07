import { useRef, useState, type RefObject } from 'react'
import { unlockGameSound } from '../../../shared/sound/effects'
import { check, isFull, type Slot } from './spelling'

// One underlined place per letter. A real text field lies invisibly over them, so a tap anywhere on the slots
// opens the phone's keyboard, and what is typed fills the slots in order. The slots are for the eye: the field
// carries the label, and the page announces what happened.
export function SpellSlots({
  slots,
  answer,
  typed,
  revealed,
  done,
  label,
  inputRef,
  onType,
}: {
  slots: Slot[]
  answer: string[]
  typed: string[]
  // Shown when the word is skipped: the letters not typed yet.
  revealed: boolean
  done: boolean
  label: string
  inputRef: RefObject<HTMLInputElement | null>
  onType: (value: string, composing: boolean) => void
}) {
  // While a keyboard builds a word (composition) the field keeps its own text: giving it another would end the
  // composition and the letters would only arrive when it ends.
  const composing = useRef(false)
  const [raw, setRaw] = useState<string | null>(null)
  const right = check(answer, typed)
  const judged = isFull(answer, typed)
  // The place of each letter slot among the letters, so a slot knows which typed letter is its own.
  const places = slots.map((_, index) => slots.slice(0, index).filter((slot) => slot.kind === 'letter').length)

  const words: { slot: Slot; index: number }[][] = [[]]
  slots.forEach((slot, index) => {
    if (slot.kind === 'gap') {
      words.push([])
    } else {
      words[words.length - 1].push({ slot, index })
    }
  })

  return (
    <div className="relative scroll-mb-48">
      <div aria-hidden="true" className="flex flex-wrap justify-center gap-x-5 gap-y-3">
        {words.map((word, wordIndex) => (
          // A word stays on one line when it fits; only one longer than the screen breaks.
          <div className="flex max-w-full flex-wrap justify-center gap-x-1 gap-y-3" key={wordIndex}>
            {word.map(({ slot, index }) => {
          if (slot.kind === 'fixed') {
            return (
              <span className="flex h-11 w-4 items-end justify-center pb-1 text-2xl font-bold text-slate-500" key={index}>
                {slot.char}
              </span>
            )
          }
          const position = places[index]
          const shown = position < typed.length ? typed[position] : revealed ? answer[position] : ''
          // Only a full row is judged; until then nothing is red and the learner can change any letter at the end.
          const wrong = judged && !right[position]
          const state = done
            ? 'border-emerald-500 text-emerald-700'
            : wrong
              ? 'border-rose-500 text-rose-600 motion-safe:animate-shake'
              : position < typed.length
                ? judged
                  ? 'border-emerald-500 text-slate-900'
                  : 'border-slate-500 text-slate-900'
                : revealed
                  ? 'border-amber-400 text-amber-700'
                  : position === typed.length
                    ? 'border-indigo-600'
                    : 'border-slate-300'
          return (
            <span
              className={`flex h-11 w-7 items-end justify-center border-b-4 pb-0.5 text-2xl leading-none font-bold transition-colors ${state}`}
              data-state={done ? 'done' : wrong ? 'wrong' : shown ? (judged ? 'right' : 'filled') : 'empty'}
              key={index}
            >
              {shown.toLowerCase()}
            </span>
          )
            })}
          </div>
        ))}
      </div>
      <input
        aria-label={label}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        enterKeyHint="done"
        inputMode="text"
        onChange={(event) => {
          setRaw(composing.current ? event.target.value : null)
          onType(event.target.value, composing.current)
        }}
        onCompositionEnd={(event) => {
          composing.current = false
          setRaw(null)
          onType(event.currentTarget.value, false)
        }}
        onCompositionStart={() => {
          composing.current = true
        }}
        // A tap is a press; the sound after a typed letter is allowed only once there has been one.
        onClick={unlockGameSound}
        onTouchEnd={unlockGameSound}
        readOnly={done || revealed}
        ref={inputRef}
        spellCheck={false}
        style={{ fontSize: '16px' }}
        type="text"
        value={raw ?? typed.join('')}
      />
    </div>
  )
}
