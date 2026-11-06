import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import { formatLevels } from '../../videos/videoLevels'
import type { ArticleAlbum } from '../types/articles'

// An album as a card: its title and source, the levels it suits, how far the learner has got, and a line about it.
export function ArticleAlbumCard({ album, backPath }: { album: ArticleAlbum; backPath: string }) {
  const share = album.articleCount > 0 ? (album.readCount / album.articleCount) * 100 : 0

  return (
    <Link
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      state={backState(backPath, 'Back to articles')}
      to={`/app/reading/articles/albums/${album.id}`}
    >
      <h2 className="text-base leading-6 font-bold tracking-tight text-slate-900">{album.title}</h2>
      <p className="text-sm text-slate-600">{album.source}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-900">{formatLevels(album)}</span>
        <span className="text-slate-700">
          {album.readCount} of {album.articleCount} read
        </span>
      </p>
      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>
      {album.description ? <p className="mt-2 text-sm leading-5 text-slate-700">{album.description}</p> : null}
    </Link>
  )
}
