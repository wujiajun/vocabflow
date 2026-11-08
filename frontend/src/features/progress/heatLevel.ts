// Shade by the number of cards studied that day (0 = none, 4 = the most).
export function level(cards: number) {
  if (cards <= 0) return 0
  if (cards < 10) return 1
  if (cards < 20) return 2
  if (cards < 40) return 3
  return 4
}
