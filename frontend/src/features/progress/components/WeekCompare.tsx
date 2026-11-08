import type { ProgressWeek } from '../types/progress'

const rows: { key: keyof ProgressWeek; label: string }[] = [
  { key: 'reviews', label: 'Cards reviewed' },
  { key: 'newWords', label: 'New words' },
  { key: 'rounds', label: 'Game rounds' },
]

export function Change({ now, before }: { now: number; before: number }) {
  const diff = now - before
  if (diff === 0) {
    return <span className="text-slate-600">– same</span>
  }
  return diff > 0 ? (
    <span className="font-semibold text-emerald-800">▲ {diff}</span>
  ) : (
    <span className="font-semibold text-rose-800">▼ {Math.abs(diff)}</span>
  )
}

// The last 7 days against the 7 days before them.
export function WeekCompare({ thisWeek, lastWeek }: { thisWeek: ProgressWeek; lastWeek: ProgressWeek }) {
  return (
    <section aria-labelledby="week-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold tracking-tight" id="week-heading">This week and last week</h2>
      <p className="text-xs text-slate-600">The last 7 days against the 7 days before.</p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-600">
            <th className="py-1 font-semibold" scope="col">&nbsp;</th>
            <th className="py-1 text-right font-semibold" scope="col">This week</th>
            <th className="py-1 text-right font-semibold" scope="col">Last week</th>
            <th className="py-1 text-right font-semibold" scope="col">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key}>
              <th className="min-h-11 py-3 text-left font-semibold text-slate-900" scope="row">{row.label}</th>
              <td className="py-3 text-right">{thisWeek[row.key]}</td>
              <td className="py-3 text-right">{lastWeek[row.key]}</td>
              <td className="py-3 text-right"><Change before={lastWeek[row.key]} now={thisWeek[row.key]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
