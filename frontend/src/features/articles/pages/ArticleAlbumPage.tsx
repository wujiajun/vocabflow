import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ApiClientError } from '../../../shared/api/apiClient'
import { BackLink } from '../../../shared/BackLink'
import { backState } from '../../../shared/navigation'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { formatLevels } from '../../videos/videoLevels'
import { useArticleAlbum } from '../hooks/useArticles'
import { isShortArticle } from '../articleLengths'

const albumsPage = { path: '/app/reading/articles', label: 'Back to articles' }

type Length = 'short' | 'long'

const lengthButton =
  'min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-pressed:border-indigo-700 aria-pressed:bg-indigo-700 aria-pressed:text-white'

// The articles of one album, split into short ones and long ones, the unread ones first (newest first
// inside each group, as the catalog lists them).
export function ArticleAlbumPage() {
  const { albumId } = useParams()
  const album = useArticleAlbum(albumId)
  const location = useLocation()
  const [chosen, setChosen] = useState<Length>()
  usePageTitle(album.data?.title ?? 'Articles')

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
    const short = data.articles.filter((article) => isShortArticle(article.readingMinutes))
    const long = data.articles.filter((article) => !isShortArticle(article.readingMinutes))
    const length: Length = chosen ?? (short.length > 0 ? 'short' : 'long')
    const shown = [...(length === 'short' ? short : long)].sort((a, b) => Number(a.read) - Number(b.read))
    const share = data.articles.length > 0 ? (data.readCount / data.articles.length) * 100 : 0
    const backPath = `${location.pathname}${location.search}`

    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.source} · {formatLevels(data)}
        </p>
        {data.description ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">{data.description}</p> : null}
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {data.readCount} of {data.articles.length} read
        </p>
        <div aria-hidden="true" className="mt-1.5 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${share}%` }} />
        </div>

        {short.length > 0 && long.length > 0 ? (
          <div aria-label="Length of the articles" className="mt-5 flex gap-2" role="group">
            <button aria-pressed={length === 'short'} className={lengthButton} onClick={() => setChosen('short')} type="button">
              Short · {short.length}
            </button>
            <button aria-pressed={length === 'long'} className={lengthButton} onClick={() => setChosen('long')} type="button">
              Long · {long.length}
            </button>
          </div>
        ) : (
          <h2 className="mt-5 text-sm font-semibold tracking-wide text-slate-600 uppercase">
            {length === 'short' ? 'Short articles (up to 5 minutes)' : 'Long articles (over 5 minutes)'}
          </h2>
        )}

        <ul aria-label={length === 'short' ? 'Short articles' : 'Long articles'} className="mt-3 space-y-3">
          {shown.map((article) => (
            <li key={article.id}>
              <Link
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                state={backState(backPath, `Back to ${data.title}`)}
                to={`/app/reading/articles/a/${article.id}`}
              >
                <span className="block leading-6 font-semibold text-slate-900">{article.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>{article.readingMinutes} min read</span>
                  <span>{new Date(`${article.publishedOn}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  {article.read ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">✓ Read</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    )
  }
}
