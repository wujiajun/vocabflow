import type { ReadAloudState, ReadingSpeed } from '../hooks/useReadAloud'
import type { VoiceAccent } from '../../../shared/speech/pronunciation'

const buttonClass =
  'rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'

// One button goes through Listen, Pause and Resume; Stop ends the reading.
export function ReadAloudControls({
  state,
  speed,
  accent,
  onStart,
  onPause,
  onResume,
  onStop,
  onSpeed,
}: {
  state: ReadAloudState
  speed: ReadingSpeed
  accent: VoiceAccent
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSpeed: (speed: ReadingSpeed) => void
}) {
  const main =
    state === 'idle'
      ? { label: 'Listen', icon: '🔊', onClick: onStart }
      : state === 'playing'
        ? { label: 'Pause', icon: '⏸', onClick: onPause }
        : { label: 'Resume', icon: '▶', onClick: onResume }

  return (
    <div aria-label="Read aloud" className="mt-4" role="group">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`${buttonClass} bg-indigo-700 text-white hover:bg-indigo-800`}
          onClick={main.onClick}
          type="button"
        >
          <span aria-hidden="true" className="mr-1.5">
            {main.icon}
          </span>
          {main.label}
        </button>
        {state !== 'idle' ? (
          <button
            className={`${buttonClass} border border-slate-300 text-slate-800 hover:bg-slate-100`}
            onClick={onStop}
            type="button"
          >
            <span aria-hidden="true" className="mr-1.5">
              ■
            </span>
            Stop
          </button>
        ) : null}
        <div aria-label="Reading speed" className="ml-auto flex gap-1" role="group">
          {(['normal', 'slow'] as const).map((value) => (
            <button
              aria-pressed={speed === value}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-pressed:border-indigo-700 aria-pressed:bg-indigo-700 aria-pressed:text-white"
              key={value}
              onClick={() => onSpeed(value)}
              type="button"
            >
              {value === 'normal' ? 'Normal' : 'Slow'}
            </button>
          ))}
        </div>
      </div>
      {accent === 'other' ? (
        <p className="mt-2 text-xs text-amber-800">
          No American English voice was found on this device, so another English voice is used.
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only" role="status">
        {state === 'playing' ? 'Reading aloud.' : state === 'paused' ? 'Paused.' : ''}
      </p>
    </div>
  )
}
