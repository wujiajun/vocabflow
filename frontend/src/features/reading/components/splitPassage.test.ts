import { expect, test } from 'vitest'
import { splitPassage } from './splitPassage'

test('splits paragraphs on blank lines and marks the studied words', () => {
  const paragraphs = splitPassage('Maya read the [[lease]] twice.\n\nHer [[landlord]] waited, then left.')

  expect(paragraphs).toEqual([
    [
      { text: 'Maya read the ', target: false },
      { text: 'lease', target: true },
      { text: ' twice.', target: false },
    ],
    [
      { text: 'Her ', target: false },
      { text: 'landlord', target: true },
      { text: ' waited, then left.', target: false },
    ],
  ])
})

test('a word at the very start or end, a phrase, and text without marks', () => {
  expect(splitPassage('[[Figure out]] the plan [[now]]')).toEqual([
    [
      { text: 'Figure out', target: true },
      { text: ' the plan ', target: false },
      { text: 'now', target: true },
    ],
  ])
  expect(splitPassage('Nothing marked here.')).toEqual([[{ text: 'Nothing marked here.', target: false }]])
  expect(splitPassage('  \n\n ')).toEqual([])
})
