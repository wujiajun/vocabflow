import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { type BackTarget, readBackTarget } from './navigation'

// A page opened from a list or the study page can say where it came from. Pressing this then goes back
// through the history, one step, as the phone's own swipe does, so going there and back does not add
// an entry each time. Opened any other way (a bookmark, a refresh), it goes to the place itself and
// takes this page's entry, since there is nothing behind it to return to.
export function BackLink({
  fallback,
  className = 'text-sm font-semibold text-indigo-700 underline underline-offset-4',
  children,
}: {
  fallback: BackTarget
  className?: string
  children?: ReactNode
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const target = readBackTarget(location.state, fallback)
  const cameFromThere = target !== fallback

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    // A modified click (a new tab, say) is left to the browser.
    if (cameFromThere && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      navigate(-1)
    }
  }

  return (
    <Link className={className} onClick={goBack} replace={!cameFromThere} to={target.path}>
      {children ?? <>← {target.label}</>}
    </Link>
  )
}
