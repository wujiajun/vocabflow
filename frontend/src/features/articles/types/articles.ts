export interface ArticleAlbum {
  id: string
  title: string
  source: string
  description: string
  clbMin: number
  clbMax: number
  articleCount: number
  readCount: number
}

export interface ArticleSummary {
  id: string
  title: string
  publishedOn: string
  readingMinutes: number
  read: boolean
}

export interface ArticleAlbumDetail {
  id: string
  title: string
  source: string
  description: string
  clbMin: number
  clbMax: number
  readCount: number
  articles: ArticleSummary[]
}

export interface GlossaryWord {
  word: string
  definition: string
  // A Chinese meaning, when the list has one (scenarios do).
  zh?: string
}

export interface Article {
  id: string
  title: string
  albumId: string
  albumTitle: string
  source: string
  publishedOn: string
  readingMinutes: number
  // Where the original is, for credit and for the link back.
  sourceUrl: string
  audioUrl: string | null
  // Paragraphs separated by a blank line.
  text: string
  glossary: GlossaryWord[]
  read: boolean
  readAt: string | null
}
