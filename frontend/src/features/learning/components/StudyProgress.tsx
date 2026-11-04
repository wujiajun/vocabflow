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
      {/* The total sits at the end of the bar, not in the legend: the three legend items already fill
          the width of a phone, so a fourth made a line of its own. */}
      <div className="flex items-center gap-3">
        <svg
          aria-label={`${counts.studied} studied, ${counts.learning} learning, ${counts.notStarted} not started, ${total} in total`}
          className="block h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${total} 1`}
        >
          {groups.map(({ key, fill }) => (
            <rect fill={fill} height="1" key={key} width={counts[key]} x={offsets[key]} />
          ))}
        </svg>
        <span aria-hidden="true" className="shrink-0 text-sm font-semibold text-slate-800">
          {total} {total === 1 ? 'word' : 'words'}
        </span>
      </div>
      <ul aria-hidden="true" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {groups.map(({ key, label, dot }) => (
          <li className="flex items-center gap-1.5" key={key}>
            <span className={`size-2.5 rounded-full ${dot}`} />
            {label} {counts[key]}
          </li>
        ))}
      </ul>
    </section>
  )
}
