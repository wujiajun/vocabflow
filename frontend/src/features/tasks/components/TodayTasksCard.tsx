import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { backState } from '../../../shared/navigation'
import { playRight } from '../../../shared/sound/effects'
import { authErrorMessage } from '../../auth/components/AuthError'
import { useTodayTasks } from '../hooks/useTasks'
import { taskPath, taskTitle } from '../taskText'
import type { DailyTask, TaskDay } from '../types/tasks'

// The day's tasks: the base task first, then the others. Reading them asks the server, which counts
// what was done and awards the points, so the card only shows what it is told.
export function TodayTasksCard({ date, compact = false }: { date: string; compact?: boolean }) {
  const tasks = useTodayTasks(date)
  const [open, setOpen] = useState(false)
  const celebration = useCelebration(tasks.data)

  if (tasks.isPending) {
    return null
  }

  if (tasks.isError) {
    return (
      <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
        <p>{authErrorMessage(tasks.error, 'Unable to load today’s tasks.')}</p>
        <button className="mt-1 min-h-11 font-semibold underline underline-offset-4" onClick={() => void tasks.refetch()} type="button">
          Try again
        </button>
      </div>
    )
  }

  const day = tasks.data
  if (day.tasks.length === 0) {
    return null
  }

  const done = day.tasks.filter((task) => task.completed).length
  const showList = !compact || open

  return (
    <section aria-labelledby="today-tasks-heading" className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight" id="today-tasks-heading">
          Today’s tasks <span className="font-semibold text-slate-600">{done}/{day.tasks.length}</span>
        </h2>
        {compact ? (
          <button
            aria-expanded={open}
            className="min-h-11 px-2 text-sm font-semibold text-indigo-700 underline underline-offset-4"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      <SummaryLine day={day} />
      {celebration ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 motion-safe:animate-pop" role="status">
          {celebration}
        </p>
      ) : null}
      {showList ? (
        <ul className="mt-2 divide-y divide-slate-100">
          {day.tasks.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function SummaryLine({ day }: { day: TaskDay }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
      <span>
        <span aria-hidden="true">🔥 </span>
        <strong>{day.streak}</strong> {day.streak === 1 ? 'day' : 'days'} in a row
      </span>
      <span>
        Today <strong>+{day.earnedToday}</strong>
      </span>
      <span>
        Total <strong>{day.balance}</strong> points
      </span>
      <Link className="font-semibold text-indigo-700 underline underline-offset-4" state={backState('/app/study', 'Back to study')} to="/app/points">
        History
      </Link>
    </p>
  )
}

function TaskRow({ task }: { task: DailyTask }) {
  const showBar = task.target > 1
  return (
    <li>
      <Link className="flex min-h-11 items-center gap-3 py-2" state={backState('/app/study', 'Back to study')} to={taskPath(task)}>
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
            task.completed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
            {taskTitle(task)}
            <span className="sr-only">{task.completed ? ' (done)' : ' (not done yet)'}</span>
          </span>
          {showBar && !task.completed ? (
            <span className="mt-1 flex items-center gap-2">
              <span
                aria-label={`${taskTitle(task)} progress`}
                aria-valuemax={task.target}
                aria-valuemin={0}
                aria-valuenow={task.current}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
              >
                <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${(task.current / task.target) * 100}%` }} />
              </span>
              <span className="text-xs text-slate-600">
                {task.current}/{task.target}
              </span>
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs font-semibold text-amber-800">+{task.points}</span>
      </Link>
    </li>
  )
}

// A small message and a ding when a task, or the whole day, turns done while the card is showing. The
// first answer after opening is never celebrated: those tasks were done earlier.
function useCelebration(day: TaskDay | undefined) {
  const previous = useRef<TaskDay | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = day
    if (!day || !before || before.date !== day.date) {
      return
    }
    const wasDone = new Set(before.tasks.filter((task) => task.completed).map((task) => task.key))
    const newlyDone = day.tasks.filter((task) => task.completed && !wasDone.has(task.key))
    if (newlyDone.length === 0) {
      return
    }
    playRight()
    const points = newlyDone.reduce((sum, task) => sum + task.points, 0)
    const text = day.allDone
      ? 'All done for today! Bonus points added. 🎉'
      : `${newlyDone.length === 1 ? taskTitle(newlyDone[0]) : `${newlyDone.length} tasks`} — done! +${points}`
    setMessage(text)
    const timer = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [day])

  return message
}
