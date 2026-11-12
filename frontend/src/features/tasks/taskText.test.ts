import { expect, test } from 'vitest'
import { taskPath, taskTitle } from './taskText'
import type { DailyTask } from './types/tasks'

function task(type: DailyTask['type']): DailyTask {
  return { key: type, type, category: 'CANADA', game: null, target: 1, current: 0, points: 4, completed: false, completedAt: null, challenge: false }
}

test('the Canada tasks lead to the scenario list', () => {
  expect(taskTitle(task('READ_SCENARIO'))).toBe('Finish a new Life in Canada scenario')
  expect(taskTitle(task('SPEAK_SCENARIO'))).toBe('Speak a Life in Canada scene')
  expect(taskPath(task('READ_SCENARIO'))).toBe('/app/reading/scenarios')
  expect(taskPath(task('SPEAK_SCENARIO'))).toBe('/app/reading/scenarios')
})
