import { defaultReminderTime, ReminderPermissionError, useReminder } from '../hooks/useReminder'
import { useState } from 'react'

// Settings > Daily reminder: one gentle message a day, only on days the study is not done yet.
export function ReminderSettings() {
  const reminder = useReminder()
  const [time, setTime] = useState<string>()
  const shown = time ?? reminder.remindAt
  const busy = reminder.enable.isPending || reminder.disable.isPending || reminder.changeTime.isPending
  const denied = reminder.permission === 'denied' || reminder.enable.error instanceof ReminderPermissionError
  const problem = reminder.enable.isError || reminder.disable.isError || reminder.changeTime.isError

  const blocked = blockedMessage(reminder.support, reminder.serverReady, reminder.loadFailed)

  return (
    <section aria-label="Daily reminder" className="mt-4 max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-7">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Daily reminder</h2>
      {blocked ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{blocked}</p>
      ) : (
        <>
          <label className="mt-3 flex items-center gap-3 text-sm font-medium text-slate-800">
            <input
              checked={reminder.on}
              className="size-5 shrink-0 accent-indigo-700"
              disabled={busy || reminder.loading || (denied && !reminder.on)}
              onChange={(event) => {
                if (event.target.checked) {
                  reminder.enable.mutate(shown)
                } else {
                  reminder.disable.mutate()
                }
              }}
              type="checkbox"
            />
            Remind me to study
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-800" htmlFor="settings-reminder-time">
            Reminder time
            <input
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
              disabled={reminder.enable.isPending || reminder.disable.isPending || reminder.loading}
              id="settings-reminder-time"
              onChange={(event) => {
                const value = event.target.value || defaultReminderTime
                setTime(value)
                if (reminder.on) {
                  reminder.changeTime.mutate(value)
                }
              }}
              type="time"
              value={shown}
            />
          </label>
          {denied ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900" role="status">
              Notifications are blocked for VocabFlow on this device. Allow them in the device’s settings (on an iPhone: Settings, Notifications, VocabFlow), then switch this on again.
            </p>
          ) : null}
          {problem && !denied ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              The reminder could not be changed. Please try again.
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-slate-600">
            One short message a day at this time in your time zone, only if today’s study is not finished. Switch it off any time. This is kept per device.
          </p>
        </>
      )}
    </section>
  )
}

function blockedMessage(support: ReturnType<typeof useReminder>['support'], serverReady: boolean, loadFailed: boolean) {
  switch (support) {
    case 'insecure':
      return 'Reminders need a secure (https) address, and this page is opened over plain http. Open VocabFlow through its https address to use them.'
    case 'needs-install':
      return 'On an iPhone or iPad, reminders work once VocabFlow is added to the Home Screen: open it in Safari, tap Share, then Add to Home Screen, and open it from there.'
    case 'unsupported':
      return 'This browser cannot show reminders.'
    default:
      if (loadFailed) {
        return 'Could not check the reminder settings. Please reload the page.'
      }
      return serverReady ? undefined : 'Reminders are not set up on this server yet.'
  }
}
