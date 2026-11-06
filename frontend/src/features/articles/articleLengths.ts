// Up to five minutes is a short article; the lists of an album are split there.
export const shortArticleMinutes = 5

export function isShortArticle(readingMinutes: number) {
  return readingMinutes <= shortArticleMinutes
}

// An article counts as read once its end has been on screen this long, so a short one that fits in
// the window is not marked the moment it opens. Tests set it to zero.
export const articleTimings = { endDwellMs: 8000 }
