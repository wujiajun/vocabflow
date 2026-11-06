import { apiClient } from '../../../shared/api/apiClient'
import type { AlbumDetail, VideoAlbum } from '../types/videos'

const videosPath = '/api/v1/videos'

export function listAlbums() {
  return apiClient<VideoAlbum[]>(`${videosPath}/albums`)
}

export function getAlbum(id: string) {
  return apiClient<AlbumDetail>(`${videosPath}/albums/${encodeURIComponent(id)}`)
}

// `keepalive` lets the request finish when the page is being closed or hidden.
export function saveVideoPosition(videoId: string, seconds: number, keepalive = false) {
  return apiClient<void>(`${videosPath}/${encodeURIComponent(videoId)}/position`, { method: 'PUT', body: { seconds }, keepalive })
}

export function setVideoWatched(videoId: string, watched: boolean) {
  return apiClient<void>(`${videosPath}/${encodeURIComponent(videoId)}/watched`, { method: watched ? 'PUT' : 'DELETE' })
}
