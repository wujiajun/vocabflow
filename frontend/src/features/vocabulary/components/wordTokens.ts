export interface TextPart {
  text: string
  // Set for a word that can be tapped: the text to add, which is the word as written, except that a
  // capital which only starts a sentence is dropped.
  word?: string
}

const wordPattern = /\p{L}+(?:['’-]\p{L}+)*/gu
const sentenceEnd = /[.!?]["')\]]*\s+$/

export function splitWords(text: string): TextPart[] {
  const parts: TextPart[] = []
  let position = 0

  for (const match of text.matchAll(wordPattern)) {
    const start = match.index
    if (start > position) {
      parts.push({ text: text.slice(position, start) })
    }
    parts.push({ text: match[0], word: wordToAdd(match[0], text.slice(0, start)) })
    position = start + match[0].length
  }
  if (position < text.length) {
    parts.push({ text: text.slice(position) })
  }
  return parts
}

function wordToAdd(written: string, before: string) {
  const word = written.replaceAll('’', "'")
  const onlyFirstLetterCapital = /^\p{Lu}[^\p{Lu}]*$/u.test(word)
  const startsSentence = before.trim() === '' || sentenceEnd.test(before)
  return onlyFirstLetterCapital && startsSentence ? word.toLowerCase() : word
}
