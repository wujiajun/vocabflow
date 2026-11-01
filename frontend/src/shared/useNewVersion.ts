import { useEffect, useState } from 'react'
import { latestBundle, loadedBundle } from './appVersion'

const checkEveryMs = 15 * 60_000
const quietForMs = 30_000

// Whether the server has a newer build than the page that is open. Looked at when the app comes back
// into view (which is when a phone returns to a page it kept) and now and then while it stays open.
export function useNewVersion() {
  const [newVersion, setNewVersion] = useState(false)

  useEffect(() => {
    const current = loadedBundle()
    if (current === null) {
      return
    }

    let lastCheck = 0
    let stopped = false

    async function check(force = false) {
      const now = Date.now()
      if (stopped || (!force && now - lastCheck < quietForMs)) {
        return
      }
      lastCheck = now
      const latest = await latestBundle()
      if (!stopped && latest !== null && latest !== current) {
        setNewVersion(true)
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') {
        void check()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void check(true)
      }
    }, checkEveryMs)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  return newVersion
}
