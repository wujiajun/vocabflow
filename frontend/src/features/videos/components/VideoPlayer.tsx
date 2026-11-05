import { useEffect, useRef, useState } from 'react'
import { loadYouTubeApi } from './youtubeApi'

// YouTube's own player, from the privacy-friendly domain, started by the press that opened it. The
// frame gets its own referrer policy: the app sends none (`Referrer-Policy: no-referrer`), and the player
// refuses to start without the page's origin. When the video ends, `onEnded` is called, which is how a
// video gets marked as watched.
export function VideoPlayer({ videoId, title, onEnded }: { videoId: string; title: string; onEnded: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const onEndedRef = useRef(onEnded)
  const [noControls, setNoControls] = useState(false)

  useEffect(() => {
    onEndedRef.current = onEnded
  })

  useEffect(() => {
    let current = true
    loadYouTubeApi()
      .then((YT) => {
        if (current && frameRef.current) {
          // Not destroyed on the way out: the frame belongs to React, which removes it.
          new YT.Player(frameRef.current, {
            events: {
              onStateChange: (event) => {
                if (current && event.data === YT.PlayerState.ENDED) {
                  onEndedRef.current()
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
    return () => {
      current = false
    }
  }, [videoId])

  const source =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
    `?enablejsapi=1&autoplay=1&playsinline=1&rel=0&cc_load_policy=1&origin=${encodeURIComponent(window.location.origin)}`

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
          The player’s controls could not be loaded, so this video will not be marked as watched by itself. Mark it yourself when you finish.
        </p>
      ) : null}
    </div>
  )
}
