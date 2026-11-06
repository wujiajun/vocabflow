import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAlbum, listAlbums, saveVideoPosition, setVideoWatched } from '../api/videosApi'
import type { AlbumDetail } from '../types/videos'
import { finishedShare, minPositionSeconds } from '../videoLevels'

export const videoKeys = {
  all: ['videos'] as const,
  albums: () => [...videoKeys.all, 'albums'] as const,
  album: (id: string) => [...videoKeys.all, 'album', id] as const,
}

export function useAlbums() {
  return useQuery({ queryKey: videoKeys.albums(), queryFn: listAlbums })
}

export function useAlbum(id: string | undefined) {
  return useQuery({ queryKey: videoKeys.album(id ?? ''), queryFn: () => getAlbum(id as string), enabled: id !== undefined })
}

// The mark shows at once and is put back if the server says no, so a tap feels instant on a phone.
export function useSetWatched(albumId: string | undefined) {
  const queryClient = useQueryClient()
  const albumKey = videoKeys.album(albumId ?? '')

  return useMutation({
    mutationFn: ({ videoId, watched }: { videoId: string; watched: boolean }) => setVideoWatched(videoId, watched),
    onMutate: async ({ videoId, watched }) => {
      await queryClient.cancelQueries({ queryKey: albumKey })
      const before = queryClient.getQueryData<AlbumDetail>(albumKey)
      if (before) {
        const videos = before.videos.map((video) => (video.id === videoId ? { ...video, watched, positionSeconds: null, positionUpdatedAt: null } : video))
        queryClient.setQueryData<AlbumDetail>(albumKey, { ...before, videos, watchedCount: videos.filter((video) => video.watched).length })
      }
      return { before }
    },
    onError: (_error, _variables, context) => {
      if (context?.before) {
        queryClient.setQueryData(albumKey, context.before)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: videoKeys.all }),
  })
}

// Saves where the learner stopped. The page shows the new place at once and is not refetched for every
// save; it applies the rules the server applies (too early to keep, or far enough to count as watched).
export function useSavePosition(albumId: string | undefined) {
  const queryClient = useQueryClient()
  const albumKey = videoKeys.album(albumId ?? '')

  return useMutation({
    mutationFn: ({ videoId, seconds, keepalive }: { videoId: string; seconds: number; keepalive?: boolean }) =>
      saveVideoPosition(videoId, seconds, keepalive),
    onMutate: ({ videoId, seconds }) => {
      queryClient.setQueryData<AlbumDetail>(albumKey, (album) => {
        if (!album) {
          return album
        }
        const videos = album.videos.map((video) => {
          if (video.id !== videoId) {
            return video
          }
          if (seconds >= video.durationSeconds * finishedShare) {
            return { ...video, watched: true, positionSeconds: null, positionUpdatedAt: null }
          }
          const kept = seconds >= minPositionSeconds
          return { ...video, positionSeconds: kept ? seconds : null, positionUpdatedAt: kept ? new Date().toISOString() : null }
        })
        return { ...album, videos, watchedCount: videos.filter((video) => video.watched).length }
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: videoKeys.albums() }),
  })
}
