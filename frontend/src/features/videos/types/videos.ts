export interface VideoAlbum {
  id: string
  title: string
  source: string
  description: string
  clbMin: number
  clbMax: number
  videoCount: number
  watchedCount: number
  // The first video of the album: its picture is the album's cover.
  coverVideoId: string
}

export interface AlbumVideo {
  id: string
  title: string
  channel: string
  durationSeconds: number
  watched: boolean
  // Where the learner stopped, in seconds; null for a video not started (or watched).
  positionSeconds: number | null
}

export interface AlbumDetail {
  id: string
  title: string
  source: string
  description: string
  clbMin: number
  clbMax: number
  watchedCount: number
  videos: AlbumVideo[]
}
