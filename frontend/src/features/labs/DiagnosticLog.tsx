import { useState } from 'react'
import type { Variant } from '../../shared/speech/useSpeechRecognition'

// The events of the recognizer, to be copied and sent back. Collapsed.
export function DiagnosticLog({ lines, onClear, onNote, variant, lang }: { lines: string[]; onClear: () => void; onNote: (line: string) => void; variant: Variant | string; lang: string }) {
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('')
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const header = [
    `variant ${variant}, lang ${lang}`,
    `secure ${window.isSecureContext}, home-screen app ${standalone ? 'yes' : 'no'}`,
    navigator.userAgent,
  ].join('\n')
  const all = `${header}\n${lines.join('\n')}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(all)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <details className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-700">Diagnostic log ({lines.length})</summary>
      <div className="flex gap-2">
        <button className="min-h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white" onClick={() => void copy()} type="button">
          Copy log
        </button>
        <button
          className="min-h-11 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800"
          onClick={() => {
            onClear()
            setCopied('')
          }}
          type="button"
        >
          Clear log
        </button>
        <button className="min-h-11 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800" onClick={() => onNote('--- mark ---')} type="button">
          Mark
        </button>
      </div>
      {copied === 'yes' && <p className="mt-1 text-emerald-800" role="status">Copied.</p>}
      {copied === 'no' && <p className="mt-1 text-amber-900" role="status">Could not copy. Select the text below and copy it by hand.</p>}
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{all}</pre>
    </details>
  )
}
