import type { RatingOption } from '../types/study'

export function formatInterval({ intervalMinutes, intervalDays }: RatingOption) {
  if (intervalMinutes !== null) {
    return `${intervalMinutes} min`
  }

  const days = intervalDays ?? 0
  if (days < 30) {
    return days === 1 ? '1 day' : `${days} days`
  }
  if (days < 365) {
    return `${Math.round(days / 30)} mo`
  }
  return `${(days / 365).toFixed(1)} yr`
}
