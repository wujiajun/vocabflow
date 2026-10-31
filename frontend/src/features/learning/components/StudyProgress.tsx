import type { StudyQueue } from '../types/study'

// Native <progress> elements: an inline width would be blocked by the Content-Security-Policy.
export function StudyProgress({ queue }: { queue: StudyQueue }) {
  const reviewsTotal = queue.reviewsDoneCount + queue.reviewCount

  return (
    <section aria-label="Today’s progress" className="mt-3 grid gap-3 sm:grid-cols-2">
      <ProgressRow done={queue.newStudiedCount} label="New words" total={queue.newTargetCount} />
      {reviewsTotal > 0 ? <ProgressRow done={queue.reviewsDoneCount} label="Reviews" total={reviewsTotal} /> : null}
    </section>
  )
}

function ProgressRow({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span>
          {done} / {total}
        </span>
      </div>
      <progress aria-label={label} className="study-progress mt-1 block h-2 w-full" max={total} value={done} />
    </div>
  )
}
