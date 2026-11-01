import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth, useLogoutMutation } from '../../features/auth/hooks/useAuth'
import { AddWordButton } from '../../features/vocabulary/components/AddWordButton'
import { WordSheetProvider } from '../../features/vocabulary/components/WordSheetProvider'

export function AppShell() {
  const navigate = useNavigate()
  const auth = useAuth()
  const logout = useLogoutMutation()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  // Following a link does not reload the page, so keyboard focus would stay on a control that has
  // just disappeared. Moving it to the content lets the next Tab continue from there.
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      mainRef.current?.focus()
    }
  }, [pathname])

  if (auth.status !== 'authenticated') {
    return null
  }

  return (
    <WordSheetProvider>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <a
          className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow focus:not-sr-only focus:m-3 focus:block focus:w-fit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault()
            mainRef.current?.focus()
          }}
        >
          Skip to main content
        </a>
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
          <nav aria-label="Main" className="mx-auto flex max-w-5xl gap-5 px-5 sm:px-8">
            <NavLink className={navLinkClass} to="/app/study">
              Study
            </NavLink>
            <NavLink className={navLinkClass} to="/app/vocabulary">
              Vocabulary
            </NavLink>
            <NavLink className={navLinkClass} to="/app/settings">
              Settings
            </NavLink>
            <AddWordButton />
          </nav>
        </header>
        <main
          className="mx-auto max-w-5xl px-5 py-8 outline-none sm:px-8 sm:py-10"
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </WordSheetProvider>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `border-b-2 pb-2.5 text-sm font-semibold ${
    isActive ? 'border-indigo-700 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
  }`
}
