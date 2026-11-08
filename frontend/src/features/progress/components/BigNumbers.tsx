import type { ProgressSummary } from '../types/progress'

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      {note ? <p className="text-xs text-slate-600">{note}</p> : null}
    </div>
  )
}

// Words learned, words mastered and the streak. "Learning" is shown too so the first days do not
// look empty: a word is mastered only once its review interval reaches 21 days.
export function BigNumbers({ summary }: { summary: ProgressSummary }) {
  return (
    <section aria-label="Your numbers">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Words learned" value={summary.started} />
        <Stat label="Mastered" value={summary.mastered} />
        <Stat label={summary.streak === 1 ? 'Day in a row' : 'Days in a row'} value={summary.streak} note={summary.bestStreak > 0 ? `Best ${summary.bestStreak}` : undefined} />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        <strong>{summary.learning}</strong> {summary.learning === 1 ? 'word' : 'words'} still being learned. A word is mastered when you will see it again in 21 days or more.
      </p>
    </section>
  )
}
