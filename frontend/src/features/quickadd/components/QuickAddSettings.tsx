import { useState } from 'react'
import { useQuickAddKey } from '../hooks/useQuickAddKey'

const buttonClass =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'
const primaryClass =
  'min-h-11 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300'

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
}

// Settings > Add words from other apps: a key that can only add words, for a shortcut on the computer that sends the
// selected text to VocabFlow without opening it. The key is shown once, when it is made.
export function QuickAddSettings() {
  const { status, create, revoke } = useQuickAddKey()
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const made = create.data
  const busy = create.isPending || revoke.isPending
  const exists = status.data?.exists === true

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section aria-label="Add words from other apps" className="mt-4 max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-7">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Add words from other apps</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        A key lets a shortcut on your computer add the word you selected without opening VocabFlow. It can only add words: it cannot read your list or sign in. Keep it private, and make a new one if it gets out.
      </p>

      {status.isError ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          Could not check the key. Please reload the page.
        </p>
      ) : null}

      {made ? (
        <div className="mt-3 rounded-xl bg-indigo-50 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-950">Your new key. Copy it now: it is shown only this once.</p>
          <input
            aria-label="Your new key"
            className="mt-2 block w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-950"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={made.key}
          />
          <button className={`mt-2 ${primaryClass}`} onClick={() => void copy(made.key)} type="button">
            {copied ? 'Copied' : 'Copy the key'}
          </button>
        </div>
      ) : exists ? (
        <p className="mt-3 text-sm leading-6 text-slate-800">
          A key was made on {day(status.data?.createdAt ?? null)}.{' '}
          {status.data?.lastUsedAt ? `Last used on ${day(status.data.lastUsedAt)}.` : 'It has not been used yet.'}
        </p>
      ) : status.isSuccess ? (
        <p className="mt-3 text-sm leading-6 text-slate-800">
          No key yet.
        </p>
      ) : null}

      {create.isError || revoke.isError ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          That did not work. Please try again.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {exists && !made && !confirmRevoke ? (
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() => {
              setCopied(false)
              create.mutate()
            }}
            type="button"
          >
            Make a new key
          </button>
        ) : !exists && !made ? (
          <button className={primaryClass} disabled={busy || !status.isSuccess} onClick={() => create.mutate()} type="button">
            Make a key
          </button>
        ) : null}
        {exists && !confirmRevoke ? (
          <button className={buttonClass} disabled={busy} onClick={() => setConfirmRevoke(true)} type="button">
            Revoke the key
          </button>
        ) : null}
      </div>
      {exists && !made && !confirmRevoke ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">A new key stops the old one working at once.</p>
      ) : null}
      {confirmRevoke ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3" role="alertdialog" aria-label="Revoke the key">
          <p className="text-sm text-amber-950">The shortcut stops working until you make a new key and put it in. Revoke it?</p>
          <div className="mt-2 flex gap-2">
            <button
              className={primaryClass}
              disabled={busy}
              onClick={() =>
                revoke.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmRevoke(false)
                    create.reset()
                  },
                })
              }
              type="button"
            >
              Yes, revoke it
            </button>
            <button className={buttonClass} onClick={() => setConfirmRevoke(false)} type="button">
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-700">How to use it in a shortcut</summary>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
          <li>In the Shortcuts app, make a Quick Action that receives Text.</li>
          <li>
            Add <strong>Get Contents of URL</strong>: the URL is <code className="break-all">{window.location.origin}/api/v1/quick-add</code>, the method is POST.
          </li>
          <li>
            Headers: <code>X-Quick-Add-Key</code> with your key. Request body: JSON with the field <code>term</code> set to the Shortcut Input.
          </li>
          <li>
            Then add <strong>Get Dictionary Value</strong> for <code>message</code> and <strong>Show Notification</strong>.
          </li>
        </ol>
      </details>
    </section>
  )
}
