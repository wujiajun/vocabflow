import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

// How far this page is from the first one of the visit to the app. React Router keeps the count in
// the history state.
function depth() {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && idx > 0 ? idx : 0
}

// How long to wait for the history to move back before going on without it.
const unwindTimeoutMs = 500

// The tabs are the top level, so pressing one starts a fresh stack: the phone's swipe-back from a tab
// leaves the app, instead of returning to a page opened from another one (a list, then an entry, then a
// tab). The browser cannot delete entries, so they are walked back over first, and then the first one
// is replaced by the tab. While that happens, `pending` is set, so the page can show nothing and the
// page walked past is not drawn for a moment.
export function useTabNavigation() {
  const navigate = useNavigate()
  const { key } = useLocation()
  const [pending, setPending] = useState<string | null>(null)
  const startKey = useRef(key)

  useEffect(() => {
    if (pending !== null && key !== startKey.current) {
      setPending(null)
      navigate(pending, { replace: true })
    }
  }, [key, pending, navigate])

  // Should the history not move (the count was off), the tab is still opened.
  useEffect(() => {
    if (pending === null) {
      return
    }
    const timer = setTimeout(() => {
      setPending(null)
      navigate(pending, { replace: true })
    }, unwindTimeoutMs)
    return () => clearTimeout(timer)
  }, [pending, navigate])

  function pressTab(event: MouseEvent<HTMLAnchorElement>, path: string) {
    // A modified click (a new tab, say) is left to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()

    const steps = depth()
    if (steps === 0) {
      navigate(path, { replace: true })
      return
    }
    startKey.current = key
    setPending(path)
    navigate(-steps)
  }

  return { pending, pressTab }
}
