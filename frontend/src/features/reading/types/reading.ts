// What the API returns. In `text`, each use of a studied word is wrapped as [[word]].
export interface ReadingPassage {
  id: number
  studyDate: string
  createdAt: string
  title: string
  text: string
  words: string[]
  read: boolean
  readAt: string | null
}

export interface ReadingSummary {
  id: number
  studyDate: string
  createdAt: string
  title: string
  wordCount: number
  read: boolean
}

export interface ReadingPage {
  content: ReadingSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ReadingToday {
  passageId: number | null
}
