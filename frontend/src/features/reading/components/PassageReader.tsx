import { useMemo } from 'react'
import { useReadAloud } from '../hooks/useReadAloud'
import { PassageText } from './PassageText'
import { ReadAloudControls } from './ReadAloudControls'
import { splitIntoSentences } from './splitPassage'

// The passage with its controls for reading it aloud, where the browser can.
export function PassageReader({ text }: { text: string }) {
  const { paragraphs, sentences } = useMemo(() => splitIntoSentences(text), [text])
  const aloud = useReadAloud(sentences)

  return (
    <>
      {aloud.supported ? (
        <ReadAloudControls
          accent={aloud.accent}
          onPause={aloud.pause}
          onResume={aloud.resume}
          onSpeed={aloud.setSpeed}
          onStart={aloud.start}
          onStop={aloud.stop}
          speed={aloud.speed}
          state={aloud.state}
        />
      ) : null}
      <div className="mt-6">
        <PassageText current={aloud.current} paragraphs={paragraphs} />
      </div>
    </>
  )
}
