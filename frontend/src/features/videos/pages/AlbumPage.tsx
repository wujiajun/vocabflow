import { useParams } from 'react-router'
import { useState } from 'react'
import { ApiClientError } from '../../../shared/api/apiClient'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { VideoRow } from '../components/VideoRow'
import { useAlbum, useSetWatched } from '../hooks/useVideos'
import { formatLevels, isShort } from '../videoLevels'

const albumsPage = { path: '/app/reading/videos', label: 'Back to videos' }

type Length = 'short' | 'long'

const lengthButton =
  'min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-pressed:border-indigo-700 aria-pressed:bg-indigo-700 aria-pressed:text-white'

// The videos of one album, split into short ones (up to ten minutes) and long ones, the ones not yet
// watched first. At most one player is open at a time.
export function AlbumPage() {
  const { albumId } = useParams()
  const album = useAlbum(albumId)
  const setWatched = useSetWatched(albumId)
  const [chosen, setChosen] = useState<Length>()
  const [playing, setPlaying] = useState<string | null>(null)
  usePageTitle(album.data?.title ?? 'Videos')

  return (
    <div>
      <BackLink fallback={albumsPage} />
      <div className="mt-5">{renderBody()}</div>
    </div>
  )

  function renderBody() {
    if (album.isPending) {
      return (
        <p className="text-sm text-slate-600" role="status">
          Loading…
        </p>
      )
    }
    if (album.isError) {
      const missing = album.error instanceof ApiClientError && album.error.status === 404
      return missing ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">We couldn’t find that album</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been mistyped, or it is no longer offered.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(album.error, 'Unable to load this album.')}</p>
          <button className="mt-2 font-semibold underline underline-offset-4" disabled={album.isFetching} onClick={() => void album.refetch()} type="button">
            {album.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )
    }

    const data = album.data
    const short = data.videos.filter((video) => isShort(video.durationSeconds))
    const long = data.videos.filter((video) => !isShort(video.durationSeconds))
    const length: Length = chosen ?? (short.length > 0 ? 'short' : 'long')
    // Not watched first; the album's own order is kept inside each group. The video that is open keeps its
    // place even once it ends and is marked, so the page does not jump under the learner's thumb.
    const placedAsWatched = (video: { id: string; watched: boolean }) => video.watched && video.id !== playing
    const list = [...(length === 'short' ? short : long)].sort((a, b) => Number(placedAsWatched(a)) - Number(placedAsWatched(b)))
    const share = data.videos.length > 0 ? (data.watchedCount / data.videos.length) * 100 : 0

    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.source} · {formatLevels(data)}
        </p>
        {data.description ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">{data.description}</p> : null}
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {data.watchedCount} of {data.videos.length} watched
        </p>
        <div aria-hidden="true" className="mt-1.5 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${share}%` }} />
        </div>

        {short.length > 0 && long.length > 0 ? (
          <div aria-label="Length of the videos" className="mt-5 flex gap-2" role="group">
            <button aria-pressed={length === 'short'} className={lengthButton} onClick={() => setChosen('short')} type="button">
              Short · {short.length}
            </button>
            <button aria-pressed={length === 'long'} className={lengthButton} onClick={() => setChosen('long')} type="button">
              Long · {long.length}
            </button>
          </div>
        ) : (
          <h2 className="mt-5 text-sm font-semibold tracking-wide text-slate-600 uppercase">
            {length === 'short' ? 'Short videos (up to 10 minutes)' : 'Long videos (over 10 minutes)'}
          </h2>
        )}

        <ul aria-label={length === 'short' ? 'Short videos' : 'Long videos'} className="mt-3 space-y-3">
          {list.map((video) => (
            <VideoRow
              key={video.id}
              onSetWatched={(watched) => setWatched.mutate({ videoId: video.id, watched })}
              onToggle={() => setPlaying((current) => (current === video.id ? null : video.id))}
              open={playing === video.id}
              video={video}
            />
          ))}
        </ul>
      </>
    )
  }
}
