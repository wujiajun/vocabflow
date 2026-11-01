export interface PassagePart {
  text: string
  // A word the learner studied, marked [[like this]] in the text.
  target: boolean
}

export interface PassageSentence {
  // Counted across the whole passage, from 0: the order in which it is read aloud.
  index: number
  text: string
  parts: PassagePart[]
}

// Paragraphs are separated by a blank line; inside one, [[...]] marks a studied word.
export function splitPassage(text: string): PassagePart[][] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) =>
      paragraph
        .split(/\[\[(.+?)\]\]/gs)
        // split() puts the captured words at the odd positions.
        .map((part, index) => ({ text: part, target: index % 2 === 1 }))
        .filter((part) => part.text !== ''),
    )
}

// A full stop after one of these does not end a sentence: "Mr. Peters" is read straight on.
const abbreviation = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs|etc|e\.g|i\.e|a\.m|p\.m)\.\s*$/i

export function sentenceRanges(text: string): [number, number][] {
  const pieces: [number, number][] = []
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    for (const { index, segment } of segmenter.segment(text)) {
      pieces.push([index, index + segment.length])
    }
  } else {
    for (const match of text.matchAll(/[^.!?]+(?:[.!?]+["')\]]*\s*|$)/g)) {
      pieces.push([match.index, match.index + match[0].length])
    }
  }

  const ranges: [number, number][] = []
  for (const [start, end] of pieces) {
    const previous = ranges[ranges.length - 1]
    if (previous && abbreviation.test(text.slice(previous[0], previous[1]))) {
      previous[1] = end
    } else {
      ranges.push([start, end])
    }
  }
  return ranges.filter(([start, end]) => text.slice(start, end).trim() !== '')
}

// The passage as paragraphs of sentences, each keeping the studied words marked inside it, plus the
// sentences in reading order.
export function splitIntoSentences(text: string): { paragraphs: PassageSentence[][]; sentences: string[] } {
  const sentences: string[] = []
  const paragraphs = splitPassage(text).map((parts) => {
    const plain = parts.map((part) => part.text).join('')
    return sentenceRanges(plain).map(([start, end]) => {
      const pieces: PassagePart[] = []
      let position = 0
      for (const part of parts) {
        const from = Math.max(start, position)
        const to = Math.min(end, position + part.text.length)
        if (from < to) {
          pieces.push({ text: plain.slice(from, to), target: part.target })
        }
        position += part.text.length
      }
      const sentence = { index: sentences.length, text: plain.slice(start, end).trim(), parts: pieces }
      sentences.push(sentence.text)
      return sentence
    })
  })
  return { paragraphs, sentences }
}
