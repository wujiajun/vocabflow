import { useEffect } from 'react'
import { useNavigate } from 'react-router'

// Lets a test press "back" as the phone's swipe does: one step through the history, which in a
// MemoryRouter that has only the entry it started with goes nowhere.
export function BackProbe({ onReady }: { onReady: (back: () => void) => void }) {
  const navigate = useNavigate()
  useEffect(() => {
    onReady(() => navigate(-1))
  }, [navigate, onReady])
  return null
}
