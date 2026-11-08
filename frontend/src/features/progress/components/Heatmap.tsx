import { useState } from 'react'
import { parseLocalDate } from '../../../shared/date'
import { level } from '../heatLevel'
import type { ProgressDay } from '../types/progress'

const shade = [
  'bg-slate-100 text-slate-600',
  'bg-indigo-100 text-indigo-900',
  'bg-indigo-300 text-indigo-950',
  'bg-indigo-500 text-white',
  'bg-indigo-800 text-white',
]

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function label(date: string, options: Intl.DateTimeFormatOptions) {
  return parseLocalDate(date).toLocaleDateString('en-US', options)
}

// Monday = 0. Built from local date parts so the weekday is the date's own, never shifted by a zone.
function mondayIndex(date: string) {
  return (parseLocalDate(date).getDay() + 6) % 7
}

// Rows are weeks (Monday to Sunday) and columns are weekdays, so every day is a full-size tap
// target on a phone; the last 12 weeks, oldest at the top.
export function Heatmap({ days }: { days: ProgressDay[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (days.length === 0) return null

  const pad = mondayIndex(days[0].date)
  const cells: (ProgressDay | null)[] = [...Array<null>(pad).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (ProgressDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const chosen = days.find((day) => day.date === (selected ?? days[days.length - 1].date)) ?? days[days.length - 1]
  const hasAny = days.some((day) => day.cards > 0 || day.rounds > 0)

  return (
    <section aria-labelledby="calendar-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold tracking-tight" id="calendar-heading">Study calendar</h2>
      <p className="text-xs text-slate-600">The last 12 weeks. Darker means more cards that day. Tap a day for details.</p>
      {!hasAny ? <p className="mt-2 text-sm text-slate-700">Nothing yet. Rate your first word and today’s square will light up.</p> : null}
      <div className="mt-2 grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1 text-center text-xs text-slate-600">
        <span />
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="mt-1 space-y-1">
        {weeks.map((week, index) => {
          const first = week.find((day) => day !== null)
          return (
            <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-1" key={first?.date ?? index}>
              <span className="text-xs text-slate-600">{first ? label(first.date, { month: 'short', day: 'numeric' }) : ''}</span>
              {week.map((day, column) =>
                day ? (
                  <button
                    aria-label={`${label(day.date, { month: 'long', day: 'numeric' })}: ${day.cards} ${day.cards === 1 ? 'card' : 'cards'}`}
                    aria-pressed={day.date === chosen.date}
                    className={`min-h-11 rounded-md text-xs font-semibold ${shade[level(day.cards)]} ${day.date === chosen.date ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                    key={day.date}
                    onClick={() => setSelected(day.date)}
                    type="button"
                  >
                    {parseLocalDate(day.date).getDate()}
                  </button>
                ) : (
                  <span aria-hidden="true" key={`gap-${column}`} />
                ),
              )}
            </div>
          )
        })}
      </div>
      <DayDetail day={chosen} />
    </section>
  )
}

function DayDetail({ day }: { day: ProgressDay }) {
  return (
    <div aria-live="polite" className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800" data-testid="day-detail">
      <p className="font-semibold">{label(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      {day.cards === 0 && day.rounds === 0 && day.points === 0 ? (
        <p>No study this day.</p>
      ) : (
        <ul className="mt-1 grid grid-cols-2 gap-x-3">
          <li>Reviewed <strong>{day.reviews}</strong> {day.reviews === 1 ? 'card' : 'cards'}</li>
          <li>Learned <strong>{day.newWords}</strong> new {day.newWords === 1 ? 'word' : 'words'}</li>
          <li>Played <strong>{day.rounds}</strong> {day.rounds === 1 ? 'game' : 'games'}</li>
          <li>Earned <strong>{day.points}</strong> {day.points === 1 ? 'point' : 'points'}</li>
        </ul>
      )}
    </div>
  )
}
