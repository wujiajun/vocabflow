export function formatWritten(createdAt: string) {
  return `Written ${new Date(createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
}

export function formatWordCount(count: number) {
  return count === 1 ? '1 word' : `${count} words`
}
