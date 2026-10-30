import { useEffect, useState } from 'react'
import { toLocalDateString } from './date'

// Give the timer a moment past midnight so the new day is certain to have started.
const midnightMarginMs = 1000

function msUntilNextMidnight(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
}

// Today's local calendar date. It moves on to the next day by itself when midnight passes, so a
// page left open overnight does not keep showing yesterday.
export function useToday() {
  const [today, setToday] = useState(() => toLocalDateString(new Date()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function refresh() {
      setToday(toLocalDateString(new Date()))
    }

    function scheduleNextMidnight() {
      timer = setTimeout(() => {
        refresh()
        scheduleNextMidnight()
      }, msUntilNextMidnight(new Date()) + midnightMarginMs)
    }

    scheduleNextMidnight()
    // Timers are delayed while a laptop sleeps or a tab is hidden, so check again on return.
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
