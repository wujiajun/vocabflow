import { useEffect, useRef, useState } from 'react'
import { loadYouTubeApi, playerTimings, type YouTubePlayer } from './youtubeApi'

// YouTube's own player, from the privacy-friendly domain, started by the press that opened it, at
// `startSeconds` when the learner stopped there before. The frame gets its own referrer policy: the app
// sends none (`Referrer-Policy: no-referrer`), and the player refuses to start without the page's origin.
// While the video plays its place is saved now and then, and again when it pauses, when the player is
// closed and when the page is hidden; when it ends, `onEnded` is called, which is how a video gets
// marked as watched.
export function VideoPlayer({
  videoId,
  title,
  startSeconds = 0,
  onEnded,
  onPosition,
}: {
  videoId: string
  title: string
  startSeconds?: number
  onEnded: () => void
  onPosition: (seconds: number, keepalive: boolean) => void
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const onEndedRef = useRef(onEnded)
  const onPositionRef = useRef(onPosition)
  const [noControls, setNoControls] = useState(false)
  // Read once: the frame must not reload when the saved place changes while it plays.
  const [start] = useState(startSeconds)

  useEffect(() => {
    onEndedRef.current = onEnded
    onPositionRef.current = onPosition
  })

  useEffect(() => {
    let current = true
    let player: YouTubePlayer | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    let ended = false
    let lastSaved: number | undefined

    function save(keepalive = false) {
      if (!player || ended) {
        return
      }
      let seconds: number
      try {
        seconds = Math.floor(player.getCurrentTime())
      } catch {
        return
      }
      if (Number.isFinite(seconds) && seconds >= 0 && seconds !== lastSaved) {
        lastSaved = seconds
        onPositionRef.current(seconds, keepalive)
      }
    }
    function stopTimer() {
      clearInterval(timer)
      timer = undefined
    }
    function whenHidden() {
      if (document.visibilityState === 'hidden') {
        save(true)
      }
    }

    loadYouTubeApi()
      .then((YT) => {
        if (current && frameRef.current) {
          // Not destroyed on the way out: the frame belongs to React, which removes it.
          player = new YT.Player(frameRef.current, {
            events: {
              onStateChange: (event) => {
                if (!current) {
                  return
                }
                if (event.data === YT.PlayerState.PLAYING) {
                  stopTimer()
                  timer = setInterval(() => save(), playerTimings.saveEveryMs)
                } else if (event.data === YT.PlayerState.ENDED) {
                  stopTimer()
                  ended = true
                  onEndedRef.current()
                } else {
                  stopTimer()
                  if (event.data === YT.PlayerState.PAUSED) {
                    save()
                  }
                }
              },
            },
          })
        }
      })
      .catch(() => {
        if (current) {
          setNoControls(true)
        }
      })

    document.addEventListener('visibilitychange', whenHidden)
    window.addEventListener('pagehide', whenHidden)
    return () => {
      current = false
      document.removeEventListener('visibilitychange', whenHidden)
      window.removeEventListener('pagehide', whenHidden)
      stopTimer()
      // Closing the player (or leaving the page) is a place to remember too.
      save(true)
    }
  }, [videoId])

  const source =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
    `?enablejsapi=1&autoplay=1&playsinline=1&rel=0&cc_load_policy=1&origin=${encodeURIComponent(window.location.origin)}` +
    (start > 0 ? `&start=${Math.floor(start)}` : '')

  return (
    <div className="mt-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
          ref={frameRef}
          referrerPolicy="strict-origin-when-cross-origin"
          src={source}
          title={`Video: ${title}`}
        />
      </div>
      {noControls ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          The player’s controls could not be loaded, so this video will not be marked as watched by itself, and where you stop is not
          remembered. Mark it yourself when you finish.
        </p>
      ) : null}
    </div>
  )
}
