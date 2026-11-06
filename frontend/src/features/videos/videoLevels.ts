import type { ClbLevel } from '../auth/types/auth'

interface Range {
  clbMin: number
  clbMax: number
}

export interface LevelBand {
  param: string
  label: string
  min: number
  max: number
}

// The filter an "all levels" view offers. An album sits under every band its range touches.
export const levelBands: LevelBand[] = [
  { param: '1-3', label: 'CLB 1–3', min: 1, max: 3 },
  { param: '4-5', label: 'CLB 4–5', min: 4, max: 5 },
  { param: '6-7', label: 'CLB 6–7', min: 6, max: 7 },
  { param: '8+', label: 'CLB 8+', min: 8, max: 12 },
]

export function bandFromParam(param: string | null) {
  return levelBands.find((band) => band.param === param)
}

export function clbNumber(level: ClbLevel) {
  return Number(level.replace('CLB_', ''))
}

export function fitsLevel(album: Range, level: number) {
  return album.clbMin <= level && level <= album.clbMax
}

export function overlapsBand(album: Range, band: LevelBand) {
  return album.clbMin <= band.max && band.min <= album.clbMax
}

export function formatLevels(album: Range) {
  return album.clbMin === album.clbMax ? `CLB ${album.clbMin}` : `CLB ${album.clbMin}–${album.clbMax}`
}

// Up to ten minutes is a short video; the lists of an album are split there.
export const shortVideoSeconds = 600

export function isShort(seconds: number) {
  return seconds <= shortVideoSeconds
}

// Where a video stands: the first seconds are not kept, and about nine tenths of it counts as watched.
// The server applies the same rules; the page applies them at once, so it does not wait for the answer.
export const minPositionSeconds = 10
export const finishedShare = 0.9
// A video opened from its place starts a few seconds earlier, to catch the thread.
export const resumeRewindSeconds = 5

export function resumeFrom(positionSeconds: number | null) {
  return positionSeconds === null ? 0 : Math.max(0, positionSeconds - resumeRewindSeconds)
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
