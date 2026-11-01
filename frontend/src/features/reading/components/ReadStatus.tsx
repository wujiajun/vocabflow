// Unread is the loud one: it is what the learner has still to do.
export function ReadStatus({ read }: { read: boolean }) {
  return read ? (
    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Read ✓</span>
  ) : (
    <span className="inline-block rounded-full bg-indigo-700 px-2.5 py-0.5 text-xs font-semibold text-white">Unread</span>
  )
}
