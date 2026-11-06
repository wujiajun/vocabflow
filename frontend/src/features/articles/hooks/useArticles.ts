import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getArticle, getArticleAlbum, listArticleAlbums, setArticleRead } from '../api/articlesApi'
import type { Article } from '../types/articles'

export const articleKeys = {
  all: ['articles'] as const,
  albums: () => [...articleKeys.all, 'albums'] as const,
  album: (id: string) => [...articleKeys.all, 'album', id] as const,
  detail: (id: string) => [...articleKeys.all, 'article', id] as const,
}

export function useArticleAlbums() {
  return useQuery({ queryKey: articleKeys.albums(), queryFn: listArticleAlbums })
}

export function useArticleAlbum(id: string | undefined) {
  return useQuery({ queryKey: articleKeys.album(id ?? ''), queryFn: () => getArticleAlbum(id as string), enabled: id !== undefined })
}

export function useArticle(id: string | undefined) {
  return useQuery({ queryKey: articleKeys.detail(id ?? ''), queryFn: () => getArticle(id as string), enabled: id !== undefined })
}

// The mark shows at once and is put back if the server says no.
export function useSetArticleRead(articleId: string | undefined) {
  const queryClient = useQueryClient()
  const key = articleKeys.detail(articleId ?? '')

  return useMutation({
    mutationFn: (read: boolean) => setArticleRead(articleId as string, read),
    onMutate: async (read) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Article>(key)
      if (before) {
        queryClient.setQueryData<Article>(key, { ...before, read, readAt: read ? new Date().toISOString() : null })
      }
      return { before }
    },
    onError: (_error, _read, context) => {
      if (context?.before) {
        queryClient.setQueryData(key, context.before)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: articleKeys.all }),
  })
}
