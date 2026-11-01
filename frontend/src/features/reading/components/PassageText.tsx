import { useEffect, useRef } from 'react'
import { TappableText } from '../../vocabulary/components/TappableText'
import type { PassageSentence } from './splitPassage'

// The studied words are highlighted and plain; every other word can be tapped to add it. While the
// passage is read aloud, the sentence being read has a soft background and is kept in view.
export function PassageText({ paragraphs, current }: { paragraphs: PassageSentence[][]; current: number | null }) {
  const reading = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    reading.current?.scrollIntoView?.({ block: 'nearest' })
  }, [current])

  return (
    <div className="space-y-4 text-lg leading-8 text-slate-900">
      {paragraphs.map((sentences, paragraph) => (
        <p key={paragraph}>
          {sentences.map((sentence) => (
            <span
              className={current === sentence.index ? 'rounded bg-indigo-100 box-decoration-clone' : undefined}
              data-reading={current === sentence.index ? 'true' : undefined}
              key={sentence.index}
              ref={current === sentence.index ? reading : undefined}
            >
              {sentence.parts.map((part, index) =>
                part.target ? (
                  <mark className="rounded-sm bg-amber-100 px-0.5 font-semibold text-slate-950" key={index}>
                    {part.text}
                  </mark>
                ) : (
                  <TappableText key={index} text={part.text} />
                ),
              )}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}
