// The pieces the three practice games share, so they look and feel alike: the start screen with its
// icon, the score and streak at the top, the progress bar, and the stars at the end.

import { starsForShare } from '../starsForShare'

export const gamePrimaryButton =
  'min-h-11 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'

// The first screen of a game: a big icon, what it is about, and Start. Speech may start only from a
// press, so the first sound of a game that speaks waits for this one.
export function GameStart({ icon, title, text, onStart }: { icon: string; title: string; text: string; onStart: () => void }) {
  return (
    <section aria-label="Start" className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <p aria-hidden="true" className="text-6xl leading-none">
        {icon}
      </p>
      <h2 className="mt-4 text-xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-700">{text}</p>
      <button className={`mt-5 w-full sm:w-auto sm:px-10 ${gamePrimaryButton}`} onClick={onStart} type="button">
        Start
      </button>
    </section>
  )
}

// ⭐ the score, and 🔥 the streak from two in a row; both move the moment an answer is given.
export function ScorePills({ score, scoreLabel, streak }: { score: number; scoreLabel: string; streak: number }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      {streak >= 2 ? (
        <span aria-label={`${streak} in a row`} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900 motion-safe:animate-pop">
          🔥 {streak}
        </span>
      ) : null}
      <span aria-label={`${score} ${scoreLabel}`} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-indigo-900">
        ⭐ {score}
      </span>
    </p>
  )
}

export function GameProgress({ value, max }: { value: number; max: number }) {
  return (
    <div aria-label="Progress" aria-valuemax={max} aria-valuemin={0} aria-valuenow={value} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar">
      <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

// One to three stars for the share of answers that were right (the first time).
export function Stars({ share }: { share: number }) {
  const stars = starsForShare(share)
  return (
    <p aria-hidden="true" className="text-4xl tracking-widest motion-safe:animate-pop">
      {'⭐'.repeat(stars)}
      <span className="opacity-25">{'⭐'.repeat(3 - stars)}</span>
    </p>
  )
}
