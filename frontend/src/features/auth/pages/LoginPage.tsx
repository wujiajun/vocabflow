import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { usePageTitle } from '../../../shared/usePageTitle'
import { authErrorMessage } from '../components/AuthError'
import { useAuthToken } from '../hooks/authTokenContext'
import { useLoginMutation } from '../hooks/useAuth'

export function LoginPage() {
  usePageTitle('Sign in')
  const navigate = useNavigate()
  const login = useLoginMutation()
  const { signedOutUnexpectedly } = useAuthToken()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string>()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail || !password) {
      setValidationError('Enter your email and password.')
      return
    }

    if (!isEmailAddress(trimmedEmail)) {
      setValidationError('Enter a valid email address.')
      return
    }

    setValidationError(undefined)
    login.mutate(
      { email: trimmedEmail, password },
      { onSuccess: () => navigate('/app', { replace: true }) },
    )
  }

  const error = validationError || (login.isError ? authErrorMessage(login.error, 'Unable to sign in.') : undefined)

  return (
    <AuthPageLayout title="Welcome back" description="Sign in to continue learning with VocabFlow.">
      {signedOutUnexpectedly ? (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          You’ve been signed out. Please sign in again to continue.
        </p>
      ) : null}
      <form className="mt-7 space-y-5" noValidate onSubmit={submit}>
        <FormError id="login-error" message={error} />
        <label className="block text-sm font-medium text-slate-800" htmlFor="login-email">
          Email
          <input
            autoComplete="email"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'login-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800" htmlFor="login-password">
          Password
          <input
            autoComplete="current-password"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
            aria-describedby={error ? 'login-error' : undefined}
            aria-invalid={error ? true : undefined}
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <button
          className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New to VocabFlow?{' '}
        <Link className="font-semibold text-indigo-700 underline underline-offset-4" to="/register">
          Create an account
        </Link>
      </p>
    </AuthPageLayout>
  )
}

export function AuthPageLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">VocabFlow</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        {children}
      </section>
    </main>
  )
}

export function FormError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p aria-live="polite" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" id={id} role="alert">
      {message}
    </p>
  )
}

function isEmailAddress(value: string) {
  return /^\S+@\S+\.\S+$/.test(value)
}
