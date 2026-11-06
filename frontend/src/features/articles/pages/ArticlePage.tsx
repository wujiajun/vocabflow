import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { ApiClientError } from '../../../shared/api/apiClient'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { PassageReader } from '../../reading/components/PassageReader'
import { ReadStatus } from '../../reading/components/ReadStatus'
import { articleTimings } from '../articleLengths'
import { GlossaryList } from '../components/GlossaryList'
import { useArticle, useSetArticleRead } from '../hooks/useArticles'

const fallbackBack = { path: '/app/reading/articles', label: 'Back to articles' }

// One article in the reader: tap a word to add it, listen to it read aloud, see where it comes from.
export function ArticlePage() {
  const { articleId } = useParams()
  const article = useArticle(articleId)
  const setRead = useSetArticleRead(articleId)
  const endRef = useRef<HTMLDivElement>(null)
  const read = article.data?.read
  usePageTitle(article.data?.title ?? 'Articles')

  // Reaching the end of the text marks the article as read.
  useEffect(() => {
    const end = endRef.current
    if (read !== false || !end || typeof IntersectionObserver === 'undefined') {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting)
      clearTimeout(timer)
      if (visible) {
        timer = setTimeout(() => setRead.mutate(true), articleTimings.endDwellMs)
      }
    })
    observer.observe(end)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `setRead.mutate` is stable enough; only a change of article matters.
  }, [read, articleId])

  return (
    <div>
      <BackLink fallback={fallbackBack} />
      <div className="mt-5">{renderBody()}</div>
    </div>
  )

  function renderBody() {
    if (articleId === undefined || (article.error instanceof ApiClientError && article.error.status === 404)) {
      return (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">We couldn’t find that article</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been mistyped, or it is no longer offered.</p>
        </div>
      )
    }
    if (article.isPending) {
      return (
        <p className="text-sm text-slate-600" role="status">
          Loading…
        </p>
      )
    }
    if (article.isError) {
      return (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <p>{authErrorMessage(article.error, 'Unable to load this article.')}</p>
          <button className="mt-2 font-semibold underline underline-offset-4" disabled={article.isFetching} onClick={() => void article.refetch()} type="button">
            {article.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )
    }

    const current = article.data
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{current.title}</h1>
          <ReadStatus read={current.read} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {current.albumTitle} · {current.readingMinutes} min read
        </p>
        <p className="mt-1 text-sm text-slate-600">Tap any word to add it to your list.</p>

        <PassageReader source={{ title: current.title, link: `/app/reading/articles/a/${current.id}` }} text={current.text} />
        <div ref={endRef} />

        {current.glossary.length > 0 ? <GlossaryList words={current.glossary} /> : null}

        {setRead.isError ? (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {authErrorMessage(setRead.error, 'Unable to save that. Please try again.')}
          </p>
        ) : null}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <button
            aria-disabled={setRead.isPending}
            className={
              current.read
                ? 'min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
                : 'min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700'
            }
            onClick={() => !setRead.isPending && setRead.mutate(!current.read)}
            type="button"
          >
            {setRead.isPending ? 'Saving…' : current.read ? 'Mark as unread' : 'Mark as read'}
          </button>
          <p className="mt-2 text-sm text-slate-600" role="status">
            {current.read && current.readAt ? `Read on ${new Date(current.readAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.` : ''}
          </p>
        </div>

        <p className="mt-6 text-sm leading-6 text-slate-600">
          From{' '}
          <a className="font-semibold text-indigo-700 underline underline-offset-4" href={current.sourceUrl} rel="noopener noreferrer" target="_blank">
            {current.source}
          </a>{' '}
          (learningenglish.voanews.com), published {new Date(`${current.publishedOn}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}. VOA text is in the public domain.
          {current.audioUrl ? (
            <>
              {' '}
              <a className="font-semibold text-indigo-700 underline underline-offset-4" href={current.audioUrl} rel="noopener noreferrer" target="_blank">
                Listen to the original recording
              </a>
              .
            </>
          ) : null}
        </p>
      </article>
    )
  }
}
