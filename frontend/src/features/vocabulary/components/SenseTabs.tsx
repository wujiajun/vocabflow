import { type KeyboardEvent, useId, useRef, useState } from 'react'
import type { VocabularySense } from '../types/vocabulary'
import { getShowChinese } from '../../../shared/showChinese'
import { PronounceButton } from '../../../shared/speech/PronounceButton'
import { MemoryHook } from './MemoryHook'
import { TappablePhrase } from './TappablePhrase'
import { TappableText } from './TappableText'

// Shows a word's meanings, one at a time when it has several. Follows the ARIA tabs pattern: Tab
// reaches the selected tab, and the arrow keys, Home and End move between tabs.
// `speakExamples` puts a play button beside each example sentence. The words of a sentence are already
// taps that offer to add them, so the sentence itself cannot be the press target.
export function SenseTabs({
  senses,
  headingLevel,
  speakExamples = false,
  initial = 0,
}: {
  senses: VocabularySense[]
  headingLevel: 'h2' | 'h3'
  speakExamples?: boolean
  // The meaning shown first, when it is not the first.
  initial?: number
}) {
  const [selected, setSelected] = useState(initial)
  // One choice for all the meanings of the word, so it stays as the learner moves between tabs.
  const [showChinese, setShowChinese] = useState(getShowChinese)
  // How the word is built is written once, on one meaning, and belongs to all of them.
  const parts = senses.find((sense) => sense.parts)?.parts
  const id = useId()
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])

  if (senses.length === 0) {
    return null
  }
  if (senses.length === 1) {
    return <SenseContent chinese={{ shown: showChinese, toggle: () => setShowChinese((on) => !on) }} headingLevel={headingLevel} parts={parts} sense={senses[0]} speakExamples={speakExamples} />
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
        <SenseContent
          chinese={{ shown: showChinese, toggle: () => setShowChinese((on) => !on) }}
          headingLevel={headingLevel}
          parts={parts}
          sense={senses[current]}
          speakExamples={speakExamples}
        />
      </div>
    </div>
  )
}

function SenseContent({
  sense,
  parts,
  headingLevel,
  speakExamples,
  chinese,
}: {
  sense: VocabularySense
  parts: string | null | undefined
  headingLevel: 'h2' | 'h3'
  speakExamples: boolean
  chinese: { shown: boolean; toggle: () => void }
}) {
  return (
    <div>
      {sense.phonetic ? <p className="text-sm text-slate-600">{sense.phonetic}</p> : null}
      <p className="mt-2 leading-7 text-slate-800">
        <TappableText text={sense.definition} />
      </p>
      {sense.chinese ? (
        <div className="mt-2">
          <button
            aria-expanded={chinese.shown}
            className="inline-flex min-h-11 items-center rounded-full border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            lang="zh-Hans"
            onClick={chinese.toggle}
            type="button"
          >
            中文
          </button>
          {chinese.shown ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-lg leading-7 font-medium text-amber-950" lang="zh-Hans">
              {sense.chinese}
            </p>
          ) : null}
        </div>
      ) : null}
      <MemoryHook headingLevel={headingLevel} parts={parts} sense={sense} speak={speakExamples} />
      <SenseList headingLevel={headingLevel} items={sense.examples} speakable={speakExamples} tappable title="Examples" />
      <SenseWords headingLevel={headingLevel} items={sense.synonyms} title="Similar words" />
      <SenseWords headingLevel={headingLevel} items={sense.antonyms} title="Opposites" />
      <SenseList headingLevel={headingLevel} items={sense.collocations} phrases title="Collocations" />
    </div>
  )
}

// Synonyms and antonyms as small chips. Each is a tap that offers to add the whole phrase, so a
// learner can pick up the neighbours of a word too.
function SenseWords({
  title,
  items,
  headingLevel: Heading,
}: {
  title: string
  items: string[] | null | undefined
  headingLevel: 'h2' | 'h3'
}) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <section className="mt-5">
      <Heading className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{title}</Heading>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li className="rounded-full bg-slate-100 px-3 py-1 text-slate-800" key={item}>
            <TappablePhrase text={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SenseList({
  title,
  items,
  tappable = false,
  speakable = false,
  phrases = false,
  headingLevel: Heading,
}: {
  title: string
  items: string[] | null
  tappable?: boolean
  speakable?: boolean
  // Each item is added as a whole phrase, not word by word.
  phrases?: boolean
  headingLevel: 'h2' | 'h3'
}) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <section className="mt-5">
      <Heading className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{title}</Heading>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-800">
        {items.map((item) => (
          <li key={item}>
            {speakable ? (
              <div className="flex items-start gap-1">
                <span className="min-w-0 flex-1">{tappable ? <TappableText text={item} /> : item}</span>
                <span className="-my-2 shrink-0">
                  <PronounceButton term={item} />
                </span>
              </div>
            ) : tappable ? (
              <TappableText text={item} />
            ) : phrases ? (
              <TappablePhrase text={item} />
            ) : (
              item
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
