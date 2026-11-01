// Where the learner's day starts and ends. The Canadian zones come first, since this is a learner's
// aid for living in Canada; the rest are whatever this browser knows.
export const canadianTimeZones = [
  'America/St_Johns',
  'America/Halifax',
  'America/Toronto',
  'America/Winnipeg',
  'America/Regina',
  'America/Edmonton',
  'America/Vancouver',
]

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

let others: string[] | undefined

// Every zone this browser knows apart from the Canadian ones; about four hundred, so worked out once.
export function otherTimeZones(): string[] {
  if (others === undefined) {
    const known = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
    const all = known ? known('timeZone') : []
    others = all.filter((zone) => zone.includes('/') && !canadianTimeZones.includes(zone))
  }
  return others
}
