import type { ProgressSummary } from '../types/progress'

export function MilestoneBar({ summary }: { summary: ProgressSummary }) {
  const { previous, next } = summary.milestone
  if (next === null) {
    return (
      <section aria-labelledby="milestone-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold tracking-tight" id="milestone-heading">Next goal</h2>
        <p className="mt-1 text-sm text-slate-700">You have mastered {summary.mastered} words, past every goal. Amazing!</p>
      </section>
    )
  }
  const remaining = next - summary.mastered
  const span = next - previous
  const percent = Math.min(100, Math.round(((summary.mastered - previous) / span) * 100))
  return (
    <section aria-labelledby="milestone-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold tracking-tight" id="milestone-heading">Next goal</h2>
      <p className="mt-1 text-sm text-slate-700">
        {remaining} more {remaining === 1 ? 'word' : 'words'} to {next}
      </p>
      <div
        aria-label={`Progress to ${next} mastered words`}
        aria-valuemax={next}
        aria-valuemin={previous}
        aria-valuenow={summary.mastered}
        className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-xs text-slate-600">
        <span>{previous}</span>
        <span>{next}</span>
      </p>
    </section>
  )
}
