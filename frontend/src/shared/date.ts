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

// The calendar date, and how far into it, in a named time zone (such as America/Toronto); the
// device's own zone when none is given or the name is not known here.
function clock(timeZone: string | null | undefined, now: Date) {
  if (!timeZone) {
    return {
      date: toLocalDateString(now),
      secondsIntoDay: now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(),
    }
  }
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    )
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      secondsIntoDay: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
    }
  } catch {
    return clock(null, now)
  }
}

export function todayIn(timeZone: string | null | undefined, now = new Date()) {
  return clock(timeZone, now).date
}

export function msUntilMidnightIn(timeZone: string | null | undefined, now = new Date()) {
  return (24 * 3600 - clock(timeZone, now).secondsIntoDay) * 1000 - now.getMilliseconds()
}
