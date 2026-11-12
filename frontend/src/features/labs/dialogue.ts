import type { HeardResult } from './useSpeechRecognition'

export interface DialogueLine {
  speaker: 'other' | 'you'
  text: string
}

export interface Dialogue {
  id: string
  title: string
  yourRole: string
  otherRole: string
  lines: DialogueLine[]
}

// Built in, for the test only. The real scenes come from the scenario catalog later.
export const dialogues: Dialogue[] = [
  {
    id: 'coffee',
    title: 'At a coffee shop',
    yourRole: 'Customer',
    otherRole: 'Barista',
    lines: [
      { speaker: 'other', text: 'Hi there! What can I get for you?' },
      { speaker: 'you', text: 'Can I have a medium coffee with milk, please?' },
      { speaker: 'other', text: 'Sure. Would you like anything to eat?' },
      { speaker: 'you', text: "Yes, I'd like a blueberry muffin." },
      { speaker: 'other', text: 'That will be six dollars and fifty cents.' },
      { speaker: 'you', text: 'Can I pay by card?' },
      { speaker: 'other', text: 'Of course. Tap your card here.' },
      { speaker: 'you', text: 'Thank you. Have a nice day!' },
    ],
  },
  {
    id: 'directions',
    title: 'Asking the way',
    yourRole: 'Visitor',
    otherRole: 'Passer-by',
    lines: [
      { speaker: 'you', text: 'Excuse me, how do I get to the library?' },
      { speaker: 'other', text: 'Go straight and turn left at the traffic light.' },
      { speaker: 'you', text: 'Is it far from here?' },
      { speaker: 'other', text: "No, it's about a five minute walk." },
      { speaker: 'you', text: 'Is there a bus I can take?' },
      { speaker: 'other', text: 'Yes, the number twelve stops across the street.' },
      { speaker: 'you', text: 'How much is the fare?' },
      { speaker: 'other', text: 'It is three dollars and fifty cents.' },
    ],
  },
]

/** After the phone has spoken, what the microphone caught of it can still arrive for this long. */
export const graceMs = 1000

/** Results that came while the phone was speaking (or just after) are its own voice, not the learner's. */
export function isEchoWindow(now: number, speaking: boolean, spokeUntil: number): boolean {
  return speaking || now - spokeUntil < graceMs
}

/**
 * What the learner has said in this turn. In continuous mode the results pile up for the whole
 * conversation, so only those from `baseline` on belong to this turn; the turn is over when the
 * last of them is final.
 */
export function turnSaid(results: readonly HeardResult[], baseline: number): { text: string; final: boolean } {
  const mine = results.slice(baseline)
  return {
    text: mine
      .map((r) => r.transcript.trim())
      .filter(Boolean)
      .join(' '),
    final: mine.length > 0 && mine[mine.length - 1].isFinal,
  }
}
