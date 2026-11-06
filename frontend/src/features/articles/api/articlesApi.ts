import { apiClient } from '../../../shared/api/apiClient'
import type { Article, ArticleAlbum, ArticleAlbumDetail } from '../types/articles'

const articlesPath = '/api/v1/articles'

export function listArticleAlbums() {
  return apiClient<ArticleAlbum[]>(`${articlesPath}/albums`)
}

export function getArticleAlbum(id: string) {
  return apiClient<ArticleAlbumDetail>(`${articlesPath}/albums/${encodeURIComponent(id)}`)
}

export function getArticle(id: string) {
  return apiClient<Article>(`${articlesPath}/${encodeURIComponent(id)}`)
}

export function setArticleRead(id: string, read: boolean) {
  return apiClient<void>(`${articlesPath}/${encodeURIComponent(id)}/read`, { method: read ? 'PUT' : 'DELETE' })
}
