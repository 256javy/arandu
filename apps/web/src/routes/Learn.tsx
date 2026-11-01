import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { getStoredLearnerId, tutorTurn, type HistoryItem, type TurnRequest } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { shareBar } from '@/exercises/share-bar'
import { MusiPanel } from '@/musi/MusiPanel'
import { useSpeech } from '@/musi/useSpeech'

const exercise = shareBar

export function Learn() {
  const learnerId = getStoredLearnerId()
  const [state, setState] = useState(exercise.initialState)
  const [messages, setMessages] = useState<HistoryItem[]>([
    { role: 'tutor', text: '¡Hola! Tocá la barra para hacer cortes. Cuando termines, apretá «Listo».' },
  ])
  const speech = useSpeech()
  const speakRef = useRef(speech.speak)
  useEffect(() => { speakRef.current = speech.speak }, [speech.speak])

  const turn = useMutation({
    mutationFn: (req: TurnRequest) => tutorTurn(req),
    onSuccess: ({ reply }) => {
      setMessages((m) => [...m, { role: 'tutor', text: reply }])
      speakRef.current(reply)
    },
  })

  if (!learnerId) return <Navigate to="/" />

  const send = (event: TurnRequest['event'], message?: string) => {
    if (message) setMessages((m) => [...m, { role: 'kid', text: message }])
    turn.mutate({
      learnerId,
      exerciseId: exercise.id,
      goal: exercise.goal,
      stateDescription: exercise.describe(state),
      evidence: exercise.check(state),
      event,
      message,
      history: messages,
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <exercise.Component
            state={state}
            onChange={setState}
            onSubmit={() => send('submitted')}
          />
        </CardContent>
      </Card>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <MusiPanel
          messages={messages}
          thinking={turn.isPending}
          speaking={speech.speaking}
          muted={speech.muted}
          speechSupported={speech.supported}
          error={turn.isError ? 'Musi no pudo responder ahora. Probá de nuevo.' : null}
          onToggleMute={speech.toggleMute}
          onSend={(t) => send('message', t)}
        />
      </div>
    </div>
  )
}
