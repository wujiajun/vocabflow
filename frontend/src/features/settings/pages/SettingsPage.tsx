import { type FormEvent, memo, useState } from 'react'
import { getSpeakOnAnswer, getSpeakOnCard, setSpeakOnAnswer, setSpeakOnCard } from '../../../shared/speech/autoSpeak'
import { todayIn } from '../../../shared/date'
import { isSpeechSupported } from '../../../shared/speech/pronunciation'
import { canadianTimeZones, deviceTimeZone, otherTimeZones } from '../../../shared/timeZones'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../../auth/components/AuthError'
import { clbLabel, clbLevels } from '../../auth/clbLevels'
import { useAuth, useUpdateSettings } from '../../auth/hooks/useAuth'
import type { ClbLevel, UpdateSettingsRequest } from '../../auth/types/auth'

export function SettingsPage() {
  usePageTitle('Settings')
  const auth = useAuth()
  const update = useUpdateSettings()
  // Kept as typed, so the field can be emptied: turning it into a number would show 0 instead.
  const [goal, setGoal] = useState(String(auth.user?.dailyNewVocabularyGoal ?? 10))
  const [clbLevel, setClbLevel] = useState<ClbLevel>(auth.user?.clbLevel ?? 'CLB_4')
  // An empty text is the device's own zone.
  const [timeZone, setTimeZone] = useState(auth.user?.timeZone ?? '')
  const [speakOnCard, setSpeakOnCardState] = useState(getSpeakOnCard)
  const [speakOnAnswer, setSpeakOnAnswerState] = useState(getSpeakOnAnswer)
  const [validationError, setValidationError] = useState<string>()
  const [saved, setSaved] = useState('')
  const error = validationError || (update.isError ? authErrorMessage(update.error, 'Unable to save your settings.') : undefined)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved('')

    const parsedGoal = goal.trim() === '' ? Number.NaN : Number(goal)
    if (!Number.isInteger(parsedGoal) || parsedGoal < 1 || parsedGoal > 100) {
      setValidationError('Daily goal must be a whole number between 1 and 100.')
      return
    }

    setValidationError(undefined)
    // Only what changed is sent. With nothing changed the goal goes, so that saving still answers.
    const settings: UpdateSettingsRequest = {}
    if (parsedGoal !== auth.user?.dailyNewVocabularyGoal) {
      settings.dailyNewVocabularyGoal = parsedGoal
    }
    if (clbLevel !== auth.user?.clbLevel) {
      settings.clbLevel = clbLevel
    }
    if (timeZone !== (auth.user?.timeZone ?? '')) {
      settings.timeZone = timeZone
    }
    if (Object.keys(settings).length === 0) {
      settings.dailyNewVocabularyGoal = parsedGoal
    }
    update.mutate(settings, {
      onSuccess: () => {
        setGoal(String(parsedGoal))
        setSaved('Saved.')
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
      <form className="mt-4 max-w-md sm:mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7" noValidate onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-800" htmlFor="settings-clb-level">
          CLB level
          <select
            aria-describedby="settings-clb-hint"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            id="settings-clb-level"
            onChange={(event) => {
              setClbLevel(event.target.value as ClbLevel)
              setSaved('')
            }}
            value={clbLevel}
          >
            {clbLevels.map((level) => (
              <option key={level} value={level}>
                {clbLabel(level)}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-600" id="settings-clb-hint">
          Reading passages are written one level below it, so they read easily and the words you studied stand out.
        </p>
        <label className="mt-4 block sm:mt-6 text-sm font-medium text-slate-800" htmlFor="settings-time-zone">
          Time zone
          <select
            aria-describedby="settings-time-zone-hint"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            id="settings-time-zone"
            onChange={(event) => {
              setTimeZone(event.target.value)
              setSaved('')
            }}
            value={timeZone}
          >
            <TimeZoneOptions current={timeZone} />
          </select>
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-600" id="settings-time-zone-hint">
          Your study day starts and ends at midnight in this zone, on every device. Now it is {todayIn(timeZone || null)} for you.
        </p>
        <label className="mt-4 block sm:mt-6 text-sm font-medium text-slate-800" htmlFor="settings-daily-goal">
          Daily new vocabulary goal
          <input
            aria-describedby={error ? 'settings-error settings-goal-hint' : 'settings-goal-hint'}
            aria-invalid={error ? true : undefined}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            id="settings-daily-goal"
            max={100}
            min={1}
            onChange={(event) => {
              setGoal(event.target.value)
              setSaved('')
            }}
            type="number"
            value={goal}
          />
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-600" id="settings-goal-hint">
          A higher goal adds words to today’s study unless it is already complete; a lower one keeps the words already added.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" id="settings-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center gap-3">
          <button
            className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={update.isPending}
            type="submit"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          <p className="text-sm text-slate-600" role="status">
            {saved}
          </p>
        </div>
      </form>

      {isSpeechSupported() ? (
        <section aria-label="On this device" className="mt-4 max-w-md sm:mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">On this device</h2>
          <fieldset aria-describedby="settings-speak-hint" className="mt-3">
            <legend className="text-sm font-medium text-slate-800">Read the word aloud</legend>
            <label className="mt-2 flex items-center gap-3 text-sm text-slate-800">
              <input
                checked={speakOnCard}
                className="size-5 shrink-0 accent-indigo-700"
                onChange={(event) => {
                  setSpeakOnCardState(event.target.checked)
                  setSpeakOnCard(event.target.checked)
                }}
                type="checkbox"
              />
              When a card appears
            </label>
            <label className="mt-2 flex items-center gap-3 text-sm text-slate-800">
              <input
                checked={speakOnAnswer}
                className="size-5 shrink-0 accent-indigo-700"
                onChange={(event) => {
                  setSpeakOnAnswerState(event.target.checked)
                  setSpeakOnAnswer(event.target.checked)
                }}
                type="checkbox"
              />
              When I show the answer
            </label>
          </fieldset>
          <p className="mt-2 text-sm leading-6 text-slate-600" id="settings-speak-hint">
            Uses this device’s voice. The choice is kept in this browser only.
          </p>
        </section>
      ) : null}
    </div>
  )
}

// Hundreds of options: kept apart and remembered, so that typing in another field does not draw them
// all again.
const TimeZoneOptions = memo(function TimeZoneOptions({ current }: { current: string }) {
  const others = otherTimeZones()

  return (
    <>
      <option value="">{deviceTimeZone() ? `Automatic (this device: ${deviceTimeZone()})` : 'Automatic (this device)'}</option>
      {current !== '' && !canadianTimeZones.includes(current) && !others.includes(current) ? (
        <option value={current}>{current}</option>
      ) : null}
      <optgroup label="Canada">
        {canadianTimeZones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </optgroup>
      {others.length > 0 ? (
        <optgroup label="Everywhere else">
          {others.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
})
