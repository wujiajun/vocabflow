// Calendar dates travel as plain `YYYY-MM-DD` strings. Build them from local date parts, because
// `toISOString()` converts to UTC and gives the wrong day in the evening west of Greenwich.
export function toLocalDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
