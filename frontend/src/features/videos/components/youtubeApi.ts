// The small part of YouTube's IFrame Player API that is used: telling when a video has ended.
export interface YouTubePlayerEvent {
  data: number
}

export interface YouTubePlayer {
  getCurrentTime(): number
}

export interface YouTubeNamespace {
  Player: new (element: HTMLIFrameElement, options: { events: { onStateChange: (event: YouTubePlayerEvent) => void } }) => YouTubePlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

// How often the place is saved while a video plays. A mutable object so a test can shorten it.
export const playerTimings = { saveEveryMs: 15000 }

let loading: Promise<YouTubeNamespace> | undefined

// Loads YouTube's script once, the first time a video is played. It needs `script-src` to allow
// www.youtube.com (see the Caddyfile); when it cannot load, the video still plays and only the automatic
// "watched" mark is lost.
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  loading ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) {
        resolve(window.YT)
      } else {
        loading = undefined
        reject(new Error('YouTube player API did not start'))
      }
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      loading = undefined
      reject(new Error('YouTube player API could not be loaded'))
    }
    document.head.append(script)
  })
  return loading
}
