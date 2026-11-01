export interface PassagePart {
  text: string
  // A word the learner studied, marked [[like this]] in the text.
  target: boolean
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
