import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import { formatLevels } from '../videoLevels'
import type { VideoAlbum } from '../types/videos'

// An album as a card: the cover of its first video, the title and source, the levels it suits, how far
// the learner has got, and a line about it.
export function AlbumCard({ album, backPath }: { album: VideoAlbum; backPath: string }) {
  const share = album.videoCount > 0 ? (album.watchedCount / album.videoCount) * 100 : 0

  return (
    <Link
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      state={backState(backPath, 'Back to videos')}
      to={`/app/reading/videos/${album.id}`}
    >
      <img
        alt=""
        className="aspect-video w-full rounded-lg bg-slate-200 object-cover"
        loading="lazy"
        src={`https://i.ytimg.com/vi/${album.coverVideoId}/mqdefault.jpg`}
      />
      <h2 className="mt-3 text-base leading-6 font-bold tracking-tight text-slate-900">{album.title}</h2>
      <p className="text-sm text-slate-600">{album.source}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-900">{formatLevels(album)}</span>
        <span className="text-slate-700">
          {album.watchedCount} of {album.videoCount} watched
        </span>
      </p>
      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>
      {album.description ? <p className="mt-2 text-sm leading-5 text-slate-700">{album.description}</p> : null}
    </Link>
  )
}
