import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAlbum, listAlbums, setVideoWatched } from '../api/videosApi'
import type { AlbumDetail } from '../types/videos'

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
        const videos = before.videos.map((video) => (video.id === videoId ? { ...video, watched } : video))
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
