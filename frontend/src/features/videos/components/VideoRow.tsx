import { formatDuration } from '../videoLevels'
import type { AlbumVideo } from '../types/videos'
import { VideoPlayer } from './VideoPlayer'

const actionClass =
  'inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'

// One video of an album: its picture and title open the player under them, and the watched mark can be
// changed by hand. The player marks the video itself when it ends.
export function VideoRow({
  video,
  open,
  onToggle,
  onSetWatched,
}: {
  video: AlbumVideo
  open: boolean
  onToggle: () => void
  onSetWatched: (watched: boolean) => void
}) {
  const playerId = `player-${video.id}`

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        aria-controls={playerId}
        aria-expanded={open}
        className="flex min-h-16 w-full items-start gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        onClick={onToggle}
        type="button"
      >
        <span className="relative shrink-0">
          <img alt="" className="h-[4.5rem] w-32 rounded-lg bg-slate-200 object-cover" loading="lazy" src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} />
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/60 pl-0.5 text-white">▶</span>
          </span>
          <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1.5 text-xs font-semibold text-white">{formatDuration(video.durationSeconds)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block leading-6 font-semibold text-slate-900">{video.title}</span>
          <span className="block text-sm text-slate-600">{video.channel}</span>
          {video.watched ? (
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">✓ Watched</span>
          ) : null}
        </span>
      </button>
      <div id={playerId}>{open ? <VideoPlayer onEnded={() => !video.watched && onSetWatched(true)} title={video.title} videoId={video.id} /> : null}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={actionClass} onClick={() => onSetWatched(!video.watched)} type="button">
          {video.watched ? 'Mark as not watched' : 'Mark as watched'}
        </button>
        <a className={actionClass} href={`https://www.youtube.com/watch?v=${video.id}`} rel="noopener noreferrer" target="_blank">
          Open on YouTube
        </a>
      </div>
    </li>
  )
}
