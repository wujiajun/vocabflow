import { useNavigate } from 'react-router'
import { useAuth, useLogoutMutation } from '../hooks/useAuth'

export function AuthenticatedAppPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const logout = useLogoutMutation()

  if (auth.status !== 'authenticated') {
    return null
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-lg font-bold">VocabFlow</p>
            <p className="text-sm text-slate-600">{auth.user.email}</p>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
            type="button"
          >
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight">Your learning space is ready</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">
          Vocabulary and daily learning plan experiences will appear here in later milestones.
        </p>
      </section>
    </main>
  )
}
