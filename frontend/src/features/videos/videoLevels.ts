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

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
