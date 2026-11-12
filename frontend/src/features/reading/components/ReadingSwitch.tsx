import { Link } from 'react-router'

const linkClass =
  'flex min-h-11 items-center rounded-lg px-3 text-sm sm:px-4 font-semibold text-slate-700 transition hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-[current]:bg-white aria-[current]:text-indigo-900 aria-[current]:shadow-sm'

// Passages written for the learner, the albums of videos and of articles, and the scenes of life in Canada:
// ways to practise reading and listening under one tab. Siblings replace each other, so the phone's swipe-back does not walk
// between them.
export function ReadingSwitch({ current }: { current: 'passages' | 'videos' | 'articles' | 'scenarios' }) {
  return (
    <nav aria-label="Reading sections" className="mt-3 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
      <Link aria-current={current === 'passages' ? 'true' : undefined} className={linkClass} replace to="/app/reading">
        Passages
      </Link>
      <Link aria-current={current === 'videos' ? 'true' : undefined} className={linkClass} replace to="/app/reading/videos">
        Videos
      </Link>
      <Link aria-current={current === 'articles' ? 'true' : undefined} className={linkClass} replace to="/app/reading/articles">
        Articles
      </Link>
      <Link aria-current={current === 'scenarios' ? 'true' : undefined} className={linkClass} replace to="/app/reading/scenarios">
        Canada
      </Link>
    </nav>
  )
}
