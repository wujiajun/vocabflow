import { Link, useLocation, useSearchParams } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useAuth } from '../../auth/hooks/useAuth'
import { ReadingSwitch } from '../../reading/components/ReadingSwitch'
import { bandFromParam, clbNumber, fitsLevel, levelBands, overlapsBand } from '../../videos/videoLevels'
import { ArticleAlbumCard } from '../components/ArticleAlbumCard'
import { useArticleAlbums } from '../hooks/useArticles'

const chipClass =
  'inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-[current]:border-indigo-700 aria-[current]:bg-indigo-700 aria-[current]:text-white'

const listPath = '/app/reading/articles'

// Albums of articles for English learners. By default only the albums that suit the learner's own CLB
// level are shown; "all levels" shows every album, with a filter by level band.
export function ArticlesPage() {
  usePageTitle('Articles')
  const auth = useAuth()
  const albums = useArticleAlbums()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const all = searchParams.get('levels') === 'all'
  const band = bandFromParam(searchParams.get('band'))
  const level = auth.user ? clbNumber(auth.user.clbLevel) : undefined
  const backPath = `${location.pathname}${location.search}`

  const shown =
    albums.data === undefined
      ? []
      : all
        ? albums.data.filter((album) => band === undefined || overlapsBand(album, band))
        : albums.data.filter((album) => level === undefined || fitsLevel(album, level))

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reading</h1>
      <ReadingSwitch current="articles" />
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
        Articles written for learners of English, grouped into albums. Tap any word to add it.{' '}
        {all ? 'Showing every level.' : level === undefined ? '' : `Showing the albums for your level, CLB ${level}.`}{' '}
        <Link className="font-semibold text-indigo-700 underline underline-offset-4" replace to={all ? listPath : `${listPath}?levels=all`}>
          {all ? 'Show only my level' : 'Show all levels'}
        </Link>
      </p>

      {all ? (
        <nav aria-label="Filter by level" className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          <Link aria-current={band === undefined ? 'true' : undefined} className={chipClass} replace to={`${listPath}?levels=all`}>
            All
          </Link>
          {levelBands.map((item) => (
            <Link
              aria-current={band?.param === item.param ? 'true' : undefined}
              className={chipClass}
              key={item.param}
              replace
              to={`${listPath}?levels=all&band=${encodeURIComponent(item.param)}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-label="Article albums" className="mt-4 sm:mt-6">
        {albums.isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Loading the albums…
          </p>
        ) : albums.isError ? (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <p>{authErrorMessage(albums.error, 'Unable to load the albums.')}</p>
            <button className="mt-2 font-semibold underline underline-offset-4" disabled={albums.isFetching} onClick={() => void albums.refetch()} type="button">
              {albums.isFetching ? 'Trying again…' : 'Try again'}
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
            No albums {all ? 'for that level ' : `for CLB ${level} `}yet.{' '}
            {all ? null : (
              <Link className="font-semibold text-indigo-700 underline underline-offset-4" replace to={`${listPath}?levels=all`}>
                Show all levels
              </Link>
            )}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((album) => (
              <li key={album.id}>
                <ArticleAlbumCard album={album} backPath={backPath} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
