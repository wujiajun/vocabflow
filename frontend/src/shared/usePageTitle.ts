import { useEffect } from 'react'

// A single-page app never reloads, so without this a screen reader user hears the same title on
// every page and the browser history lists every page as "VocabFlow".
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · VocabFlow`
  }, [title])
}
