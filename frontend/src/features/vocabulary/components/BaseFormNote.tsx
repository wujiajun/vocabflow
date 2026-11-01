// For a word that is a form of another, such as a plural: its meanings are those of the base word.
export function BaseFormNote({ baseForm, className = '' }: { baseForm: string | null; className?: string }) {
  if (!baseForm) {
    return null
  }

  return (
    <p className={`text-sm text-slate-600 ${className}`}>
      Form of <span className="font-semibold text-slate-800">{baseForm}</span>
    </p>
  )
}
