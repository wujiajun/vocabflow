import type { VocabularyEntry } from '../types/vocabulary'
import { useTypedAs } from '../hooks/useVocabulary'

// A word saved under another name than the one typed: "walked" becomes "walk" once its details
// arrive. Without this the entry seems to change by itself.
export function TypedAsNote({
  entry,
  className = '',
}: {
  entry: Pick<VocabularyEntry, 'id' | 'term' | 'baseForm'>
  className?: string
}) {
  const typed = useTypedAs(entry)
  if (!typed) {
    return null
  }

  return (
    <p className={`text-sm text-slate-600 ${className}`}>
      You added <span className="font-semibold text-slate-800">“{typed}”</span>
    </p>
  )
}
