export interface SceneLine {
  speaker: string
  text: string
}

// A spoken line starts with the speaker's name and a colon: "Ms. Patel: The lease is for one year."
const spoken = /^(\p{Lu}[^:\d\n]{0,29}): (\S[\s\S]*)$/u

/**
 * The conversation in a scenario's text, in order. The API gives the paragraphs of the scene, dialogue and
 * tips as one text, so the lines are found again here: a run of two or more paragraphs that start with a
 * name and a colon. Only names that speak at least twice count, so "Tip: …" is not taken for a speaker.
 * Fewer than two speakers means there is no conversation to practise.
 */
export function dialogueFromText(text: string): SceneLine[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim())
  const found: SceneLine[] = []
  let run: SceneLine[] = []
  const flush = () => {
    if (run.length >= 2) found.push(...run)
    run = []
  }
  for (const paragraph of paragraphs) {
    const match = spoken.exec(paragraph)
    if (match) run.push({ speaker: match[1].trim(), text: match[2].trim() })
    else flush()
  }
  flush()

  const counts = new Map<string, number>()
  for (const line of found) counts.set(line.speaker, (counts.get(line.speaker) ?? 0) + 1)
  const speakers = new Set([...counts].filter(([, n]) => n >= 2).map(([name]) => name))
  return speakers.size < 2 ? [] : found.filter((line) => speakers.has(line.speaker))
}

/** The speakers in the order they first speak. */
export function speakersOf(lines: readonly SceneLine[]): string[] {
  return [...new Set(lines.map((l) => l.speaker))]
}
