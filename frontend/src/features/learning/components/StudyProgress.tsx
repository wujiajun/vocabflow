import type { StudyQueue } from '../types/study'

const groups = [
  { key: 'studied', label: 'Studied', fill: '#059669', dot: 'bg-emerald-600' },
  { key: 'learning', label: 'Learning', fill: '#f59e0b', dot: 'bg-amber-500' },
  { key: 'notStarted', label: 'Not started', fill: '#cbd5e1', dot: 'bg-slate-300' },
] as const

// Every word of this study is in exactly one group. The bar is an SVG with widths as attributes,
// because the Content-Security-Policy blocks inline styles.
export function StudyProgress({ queue }: { queue: StudyQueue }) {
  const counts = {
    studied: queue.studiedCount,
    learning: queue.stillLearningCount,
    notStarted: queue.notStartedCount,
  }
  const total = counts.studied + counts.learning + counts.notStarted

  if (total === 0) {
    return null
  }

  const offsets = { studied: 0, learning: counts.studied, notStarted: counts.studied + counts.learning }

  return (
    <section aria-label="Study progress" className="mt-3">
      <svg
        aria-label={`${counts.studied} studied, ${counts.learning} learning, ${counts.notStarted} not started, ${total} in total`}
        className="block h-2.5 w-full overflow-hidden rounded-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${total} 1`}
      >
        {groups.map(({ key, fill }) => (
          <rect fill={fill} height="1" key={key} width={counts[key]} x={offsets[key]} />
        ))}
      </svg>
      <ul aria-hidden="true" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {groups.map(({ key, label, dot }) => (
          <li className="flex items-center gap-1.5" key={key}>
            <span className={`size-2.5 rounded-full ${dot}`} />
            {label} {counts[key]}
          </li>
        ))}
        <li className="ml-auto font-semibold text-slate-800">Total {total}</li>
      </ul>
    </section>
  )
}
