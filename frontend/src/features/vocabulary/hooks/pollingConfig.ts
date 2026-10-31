// Enrichment runs in the background on the server, so entries that are still being filled in are
// re-read until they settle. Kept in its own module so tests can shorten the timings.
export const enrichmentPollIntervalMs = 3_000
// Stop polling after this long; whatever is still unfinished then needs a manual check or a retry.
export const enrichmentPollWindowMs = 120_000
