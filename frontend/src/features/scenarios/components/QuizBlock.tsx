import { useState } from 'react'
import type { ScenarioQuestion } from '../types/scenarios'

// A small quiz: pick an answer for each question, check them all, see which were right and why.
// Grading happens here; only the number of right answers is sent on.
export function QuizBlock({ questions, onChecked }: { questions: ScenarioQuestion[]; onChecked: (score: number) => void }) {
  const [picked, setPicked] = useState<(number | undefined)[]>(() => questions.map(() => undefined))
  const [checked, setChecked] = useState(false)
  const complete = picked.every((choice) => choice !== undefined)
  const score = picked.filter((choice, index) => choice === questions[index].answer).length

  function check() {
    setChecked(true)
    onChecked(score)
  }

  function again() {
    setPicked(questions.map(() => undefined))
    setChecked(false)
  }

  return (
    <section aria-label="Quick quiz" className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">Quick quiz</h2>
      <ol className="mt-3 space-y-5">
        {questions.map((question, index) => (
          <li key={question.question}>
            <fieldset disabled={checked}>
              <legend className="text-base leading-6 font-semibold text-slate-900">
                {index + 1}. {question.question}
              </legend>
              <div className="mt-2 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const right = checked && optionIndex === question.answer
                  const wrong = checked && picked[index] === optionIndex && optionIndex !== question.answer
                  return (
                    <label
                      className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm leading-5 ${
                        right ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : wrong ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white text-slate-800'
                      }`}
                      key={option}
                    >
                      <input
                        checked={picked[index] === optionIndex}
                        className="size-4 shrink-0 accent-indigo-700"
                        name={`question-${index}`}
                        onChange={() => setPicked((current) => current.map((choice, i) => (i === index ? optionIndex : choice)))}
                        type="radio"
                      />
                      <span>
                        {option}
                        {right ? <span className="ml-2 font-semibold">✓</span> : null}
                        {wrong ? <span className="ml-2 font-semibold">✗</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
              {checked && question.explainZh ? <p className="mt-2 text-sm leading-6 text-slate-700">{question.explainZh}</p> : null}
            </fieldset>
          </li>
        ))}
      </ol>
      {checked ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="text-base font-semibold text-slate-900" role="status">
            {score} of {questions.length} right
          </p>
          <button
            className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
            onClick={again}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <button
          aria-disabled={!complete}
          className="mt-5 min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 aria-disabled:bg-slate-400 aria-disabled:hover:bg-slate-400"
          onClick={() => complete && check()}
          type="button"
        >
          Check answers
        </button>
      )}
    </section>
  )
}
