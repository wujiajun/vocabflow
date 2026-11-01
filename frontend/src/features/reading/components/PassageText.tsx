import { TappableText } from '../../vocabulary/components/TappableText'
import { splitPassage } from './splitPassage'

// The studied words are highlighted and plain; every other word can be tapped to add it.
export function PassageText({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-lg leading-8 text-slate-900">
      {splitPassage(text).map((parts, paragraph) => (
        <p key={paragraph}>
          {parts.map((part, index) =>
            part.target ? (
              <mark className="rounded-sm bg-amber-100 px-0.5 font-semibold text-slate-950" key={index}>
                {part.text}
              </mark>
            ) : (
              <TappableText key={index} text={part.text} />
            ),
          )}
        </p>
      ))}
    </div>
  )
}
