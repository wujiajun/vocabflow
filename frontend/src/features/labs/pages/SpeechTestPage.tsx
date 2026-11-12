import { useState } from 'react'
import { BackLink } from '../../../shared/BackLink'
import { usePageTitle } from '../../../shared/usePageTitle'
import { DialoguePrototype } from '../DialoguePrototype'
import { SentenceTest } from '../SentenceTest'

// Experimental, reached only by its address. Nothing is stored or sent by the app.
// One test at a time: two recognizers must never run together.
export function SpeechTestPage() {
  usePageTitle('Speech test')
  const [tab, setTab] = useState<'sentence' | 'dialogue'>('sentence')

  return (
    <div>
      <BackLink
        className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline underline-offset-4"
        fallback={{ path: '/app/settings', label: 'Back to Settings' }}
      />
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Speech test</h1>
      <p className="mt-1 text-sm text-slate-600">Experimental. Tests whether this device can hear you speak. Nothing is saved or sent by VocabFlow.</p>
      <div className="mt-3 flex gap-2" role="group" aria-label="Test">
        {(
          [
            ['sentence', 'One sentence'],
            ['dialogue', 'Conversation'],
          ] as const
        ).map(([id, label]) => (
          <button
            aria-pressed={tab === id}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${tab === id ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-800'}`}
            key={id}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'sentence' ? <SentenceTest /> : <DialoguePrototype onBack={() => setTab('sentence')} />}
    </div>
  )
}
