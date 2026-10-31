import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../components/AuthError'
import { AuthPageLayout, FormError } from './LoginPage'
import { useRegisterMutation } from '../hooks/useAuth'
import type { ClbLevel } from '../types/auth'

const clbLevels: ClbLevel[] = [
  'CLB_1',
  'CLB_2',
  'CLB_3',
  'CLB_4',
  'CLB_5',
  'CLB_6',
  'CLB_7',
  'CLB_8',
  'CLB_9',
  'CLB_10',
  'CLB_11',
  'CLB_12',
]

export function RegisterPage() {
  usePageTitle('Create account')
  const navigate = useNavigate()
  const register = useRegisterMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [clbLevel, setClbLevel] = useState<ClbLevel>('CLB_4')
  const [dailyNewVocabularyGoal, setDailyNewVocabularyGoal] = useState(10)
  const [inviteCode, setInviteCode] = useState('')
  const [validationError, setValidationError] = useState<string>()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail || !password) {
      setValidationError('Enter your email and password.')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setValidationError('Enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setValidationError('Password must contain at least 8 characters.')
      return
    }

    if (!Number.isInteger(dailyNewVocabularyGoal) || dailyNewVocabularyGoal < 1 || dailyNewVocabularyGoal > 100) {
      setValidationError('Daily vocabulary goal must be between 1 and 100.')
      return
    }

    setValidationError(undefined)
    register.mutate(
      { email: trimmedEmail, password, clbLevel, dailyNewVocabularyGoal, inviteCode: inviteCode.trim() || undefined },
      { onSuccess: () => navigate('/login', { replace: true, state: { registered: true } }) },
    )
  }

  const error = validationError || (register.isError ? authErrorMessage(register.error, 'Unable to create your account.') : undefined)

  return (
    <AuthPageLayout title="Create your account" description="Set up your VocabFlow learning preferences.">
      <form className="mt-7 space-y-5" noValidate onSubmit={submit}>
        <FormError id="register-error" message={error} />
        <label className="block text-sm font-medium text-slate-800" htmlFor="register-email">
          Email
          <input
            autoComplete="email"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'register-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="register-email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800" htmlFor="register-password">
          Password
          <input
            autoComplete="new-password"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'register-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="register-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800" htmlFor="register-clb-level">
          CLB level
          <select
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            id="register-clb-level"
            onChange={(event) => setClbLevel(event.target.value as ClbLevel)}
            value={clbLevel}
          >
            {clbLevels.map((level) => (
              <option key={level} value={level}>
                {level.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800" htmlFor="register-daily-goal">
          Daily new vocabulary goal
          <input
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'register-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="register-daily-goal"
            max={100}
            min={1}
            onChange={(event) => setDailyNewVocabularyGoal(Number(event.target.value))}
            type="number"
            value={dailyNewVocabularyGoal}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800" htmlFor="register-invite-code">
          Invite code
          <input
            autoComplete="off"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'register-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="register-invite-code"
            onChange={(event) => setInviteCode(event.target.value)}
            type="text"
            value={inviteCode}
          />
        </label>
        <button
          className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={register.isPending}
          type="submit"
        >
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="font-semibold text-indigo-700 underline underline-offset-4" to="/login">
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  )
}
