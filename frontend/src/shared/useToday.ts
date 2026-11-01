import { useEffect, useState } from 'react'
import { msUntilMidnightIn, todayIn } from './date'

// Give the timer a moment past midnight so the new day is certain to have started.
const midnightMarginMs = 1000

// Today's calendar date, in the given time zone or the device's own. It moves on to the next day by
// itself when midnight passes, so a page left open overnight does not keep showing yesterday. On a
// night when the clocks change, the timer may fire early; it then simply sets itself again.
export function useToday(timeZone?: string | null) {
  const [today, setToday] = useState(() => todayIn(timeZone))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function refresh() {
      setToday(todayIn(timeZone))
    }

    function scheduleNextMidnight() {
      timer = setTimeout(() => {
        refresh()
        scheduleNextMidnight()
      }, msUntilMidnightIn(timeZone) + midnightMarginMs)
    }

    // A change of zone changes the date at once.
    refresh()
    scheduleNextMidnight()
    // Timers are delayed while a laptop sleeps or a tab is hidden, so check again on return.
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [timeZone])

  return today
}
