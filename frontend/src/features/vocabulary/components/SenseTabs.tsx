import { type KeyboardEvent, useId, useRef, useState } from 'react'
import type { VocabularySense } from '../types/vocabulary'

// Shows a word's meanings, one at a time when it has several. Follows the ARIA tabs pattern: Tab
// reaches the selected tab, and the arrow keys, Home and End move between tabs.
export function SenseTabs({ senses, headingLevel }: { senses: VocabularySense[]; headingLevel: 'h2' | 'h3' }) {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])

  if (senses.length === 0) {
    return null
  }
  if (senses.length === 1) {
    return <SenseContent headingLevel={headingLevel} sense={senses[0]} />
  }

  const current = Math.min(selected, senses.length - 1)

  function select(index: number) {
    setSelected(index)
    tabsRef.current[index]?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    const targets: Record<string, number> = {
      ArrowRight: (current + 1) % senses.length,
      ArrowLeft: (current - 1 + senses.length) % senses.length,
      Home: 0,
      End: senses.length - 1,
    }
    const target = targets[event.key]
    if (target !== undefined) {
      event.preventDefault()
      select(target)
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600">{senses.length} meanings</p>
      <div aria-label="Meanings" className="mt-2 flex flex-wrap gap-2" onKeyDown={onKeyDown} role="tablist">
        {senses.map((sense, index) => (
          <button
            aria-controls={`${id}-panel`}
            aria-selected={index === current}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-selected:border-indigo-700 aria-selected:bg-indigo-700 aria-selected:text-white"
            id={`${id}-tab-${index}`}
            key={index}
            onClick={() => setSelected(index)}
            ref={(element) => {
              tabsRef.current[index] = element
            }}
            role="tab"
            tabIndex={index === current ? 0 : -1}
            type="button"
          >
            {[sense.partOfSpeech, sense.label].filter(Boolean).join(' · ') || `Meaning ${index + 1}`}
          </button>
        ))}
      </div>
      <div aria-labelledby={`${id}-tab-${current}`} className="mt-4" id={`${id}-panel`} role="tabpanel">
        <SenseContent headingLevel={headingLevel} sense={senses[current]} />
      </div>
    </div>
  )
}

function SenseContent({ sense, headingLevel }: { sense: VocabularySense; headingLevel: 'h2' | 'h3' }) {
  return (
    <div>
      {sense.phonetic ? <p className="text-sm text-slate-600">{sense.phonetic}</p> : null}
      <p className="mt-2 leading-7 text-slate-800">{sense.definition}</p>
      <SenseList headingLevel={headingLevel} items={sense.examples} title="Examples" />
      <SenseList headingLevel={headingLevel} items={sense.collocations} title="Collocations" />
    </div>
  )
}

function SenseList({ title, items, headingLevel: Heading }: { title: string; items: string[] | null; headingLevel: 'h2' | 'h3' }) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <section className="mt-5">
      <Heading className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{title}</Heading>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
