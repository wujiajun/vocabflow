import { useNewVersion } from '../shared/useNewVersion'

// Shown above the page when the server has a newer build. It never reloads by itself, so nothing
// being typed is lost.
export function NewVersionNotice({ onReload = () => window.location.reload() }: { onReload?: () => void }) {
  const newVersion = useNewVersion()

  if (!newVersion) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-indigo-700 px-5 py-3 text-sm text-white sm:px-8" role="status">
      <p>A new version is available.</p>
      <button
        className="rounded-lg bg-white px-3 py-1.5 font-semibold text-indigo-800 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={onReload}
        type="button"
      >
        Reload
      </button>
    </div>
  )
}
