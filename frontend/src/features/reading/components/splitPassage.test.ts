import { expect, test } from 'vitest'
import { splitIntoSentences, splitPassage } from './splitPassage'

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

test('sentences keep the studied words marked and are numbered across paragraphs', () => {
  const { paragraphs, sentences } = splitIntoSentences('She read the [[lease]]. Then she signed.\n\nHer [[landlord]] left!')

  expect(sentences).toEqual(['She read the lease.', 'Then she signed.', 'Her landlord left!'])
  expect(paragraphs.map((paragraph) => paragraph.map((sentence) => sentence.index))).toEqual([[0, 1], [2]])
  expect(paragraphs[0][0].parts).toEqual([
    { text: 'She read the ', target: false },
    { text: 'lease', target: true },
    { text: '. ', target: false },
  ])
  expect(paragraphs[0][1].parts).toEqual([{ text: 'Then she signed.', target: false }])
})

test('a studied word at the start of a sentence, and a phrase across a full stop-free span', () => {
  const { sentences, paragraphs } = splitIntoSentences('[[Figure out]] the plan first. It is [[not easy]]!')

  expect(sentences).toEqual(['Figure out the plan first.', 'It is not easy!'])
  expect(paragraphs[0][0].parts[0]).toEqual({ text: 'Figure out', target: true })
})

test('a title or an abbreviation does not end a sentence', () => {
  const { sentences } = splitIntoSentences('The landlord, Mr. Kowalski, explained the terms. He was patient at 3 p.m. that day.')

  expect(sentences).toEqual(['The landlord, Mr. Kowalski, explained the terms.', 'He was patient at 3 p.m. that day.'])
})
