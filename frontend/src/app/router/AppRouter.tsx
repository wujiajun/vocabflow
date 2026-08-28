import { Link, Navigate, Route, Routes } from 'react-router'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function FoundationPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">
          VocabFlow
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Frontend foundation ready
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          Routing, server-state infrastructure, styling, and test tooling are configured. Product
          features will be added in the next milestone.
        </p>
        <Link
          className="mt-7 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          to="/login"
        >
          View login placeholder
        </Link>
      </section>
    </main>
  )
}

function LoginPlaceholder() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Login</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Authentication UI is intentionally deferred.
        </p>
        <Link
          className="mt-7 inline-flex text-sm font-semibold text-indigo-700 underline underline-offset-4"
          to="/"
        >
          Return to foundation
        </Link>
      </section>
    </main>
  )
}
