import { apiClient } from '../../../shared/api/apiClient'
import type { AlbumDetail, VideoAlbum } from '../types/videos'

const videosPath = '/api/v1/videos'

export function listAlbums() {
  return apiClient<VideoAlbum[]>(`${videosPath}/albums`)
}

export function getAlbum(id: string) {
  return apiClient<AlbumDetail>(`${videosPath}/albums/${encodeURIComponent(id)}`)
}

export function setVideoWatched(videoId: string, watched: boolean) {
  return apiClient<void>(`${videosPath}/${encodeURIComponent(videoId)}/watched`, { method: watched ? 'PUT' : 'DELETE' })
}
