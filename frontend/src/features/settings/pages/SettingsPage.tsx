import { type FormEvent, useState } from 'react'
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
    const clbChanged = clbLevel !== auth.user?.clbLevel
    const settings: UpdateSettingsRequest = {}
    if (parsedGoal !== auth.user?.dailyNewVocabularyGoal || !clbChanged) {
      settings.dailyNewVocabularyGoal = parsedGoal
    }
    if (clbChanged) {
      settings.clbLevel = clbLevel
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
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <form className="mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" noValidate onSubmit={submit}>
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
          Your Canadian Language Benchmarks level. Reading passages are written one level below it, so that they read
          easily and the words you studied stand out.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-800" htmlFor="settings-daily-goal">
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
          A higher goal adds words to today’s study, unless today’s study is already complete. A lower goal keeps the
          words already added today.
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
    </div>
  )
}
