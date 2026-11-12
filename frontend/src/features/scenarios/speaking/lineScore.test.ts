import { expect, test } from 'vitest'
import { scoreLine } from './lineScore'

const share = (target: string, heard: string) => scoreLine(target, heard).share
const statuses = (target: string, heard: string) => scoreLine(target, heard).words.map((w) => w.status)

test('capitals and punctuation do not matter', () => {
  expect(share('Can I pay by card?', 'can i pay by card')).toBe(1)
})

test("a contraction and its long form are the same: I'd / I would, can't / cannot, it's / it is", () => {
  expect(share("I'd like a muffin.", 'I would like a muffin')).toBe(1)
  expect(share('I would like a muffin.', "I'd like a muffin")).toBe(1)
  expect(share("I can't wait.", 'I cannot wait')).toBe(1)
  expect(share("It's a big improvement.", 'it is a big improvement')).toBe(1)
  expect(share("The landlord's rule.", 'the landlord rule')).toBe(1)
})

test('numbers: $6.50, 6.50, six fifty and six dollars and fifty cents are the same', () => {
  const target = 'That will be six dollars and fifty cents.'
  expect(share(target, 'that will be $6.50')).toBe(1)
  expect(share(target, 'that will be 6.50')).toBe(1)
  expect(share(target, 'that will be six fifty')).toBe(1)
  expect(share('That will be $6.50.', 'that will be six dollars and fifty cents')).toBe(1)
  expect(share('It costs twenty five dollars.', 'it costs $25')).toBe(1)
  expect(share('It costs six dollars.', 'it costs seven dollars')).toBeLessThan(1)
})

test('small words may be left out, other words may not', () => {
  expect(share('Could you tell me about the lease?', 'could you tell me about lease')).toBe(1)
  expect(share('I went to the bank', 'I went bank')).toBe(1)
  expect(statuses('I need a new lease', 'I need a new')).toEqual(['correct', 'correct', 'correct', 'correct', 'missed'])
})

test('a plural or a one-letter spelling difference in a long word is accepted', () => {
  expect(share('I have two keys', 'I have two key')).toBe(1)
  expect(share('Renew my licence', 'renew my license')).toBe(1)
  expect(share('The rent is due', 'the rank is due')).toBeLessThan(1)
})

test('wrong, missed and extra words are told apart', () => {
  const score = scoreLine('My son has a fever', 'my sun has a very bad fever')
  expect(score.words.map((w) => [w.word, w.status])).toEqual([
    ['My', 'correct'],
    ['son', 'wrong'],
    ['has', 'correct'],
    ['a', 'correct'],
    ['fever', 'correct'],
  ])
  expect(score.words[1].heard).toBe('sun')
  expect(score.extra).toEqual(['very', 'bad'])
})

test('nothing heard scores nothing', () => {
  const score = scoreLine('Thank you very much', '')
  expect(score.share).toBe(0)
  expect(score.words.every((w) => w.status === 'missed')).toBe(true)
})
