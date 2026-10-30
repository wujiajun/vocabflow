import { authErrorMessage } from './AuthError'

interface AuthSessionErrorProps {
  error: unknown
  isRetrying: boolean
  onRetry: () => void
  onSignOut: () => void
}

export function AuthSessionError({ error, isRetrying, onRetry, onSignOut }: AuthSessionErrorProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-950">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold">We couldn’t check your session</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600" role="alert">
          {authErrorMessage(error, 'Something went wrong. Please try again.')}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRetrying}
            onClick={onRetry}
            type="button"
          >
            {isRetrying ? 'Trying again…' : 'Try again'}
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
