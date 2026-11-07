// One to three stars for the share of answers that were right (the first time).
export function starsForShare(share: number) {
  return share >= 0.9 ? 3 : share >= 0.6 ? 2 : 1
}
