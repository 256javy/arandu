import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Compass, LifeBuoy, XCircle } from 'lucide-react'
import { getMe, getNext, getStoredLearnerId, getToken, tutorTurn, type HistoryItem, type Plan, type TurnRequest } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EXERCISES, MODE_LABEL } from '@/exercises'
import type { Evidence } from '@/exercises/types'
import { MusiPanel } from '@/musi/MusiPanel'
import { useSpeech } from '@/musi/useSpeech'
import { SKILL_LABEL } from '@/routes/skills'

export function Learn() {
  const learnerId = getStoredLearnerId()
  const token = getToken()
  const plan = useQuery({ queryKey: ['next', learnerId], queryFn: () => getNext(learnerId!), enabled: !!learnerId && !!token, gcTime: 0, refetchOnWindowFocus: false })
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !!token })
  // each "Seguir" mounts a fresh mission, even when the planner repeats an exercise
  const [current, setCurrent] = useState<{ plan: Plan; n: number } | null>(null)

  if (!token) return <Navigate to="/entrar" />
  if (!learnerId) return <Navigate to="/" />
  if (plan.isError) return <p role="alert" className="text-red-700">No pudimos cargar la misión. <Link to="/" className="underline">Volver</Link></p>
  const active = current?.plan ?? plan.data
  if (!active) return <p>Cargando tu misión…</p>
  const nickname = me.data?.learners.find((l) => l.id === learnerId)?.nickname

  return (
    <Mission
      key={current?.n ?? 0}
      learnerId={learnerId}
      nickname={nickname}
      plan={active}
      onNext={(p) => setCurrent((c) => ({ plan: p, n: (c?.n ?? 0) + 1 }))}
    />
  )
}

function Mission({ learnerId, nickname, plan, onNext }: { learnerId: string; nickname?: string; plan: Plan; onNext(p: Plan): void }) {
  const exercise = EXERCISES[plan.exerciseId]
  const queryClient = useQueryClient()
  const [state, setState] = useState(() => exercise.initialState())
  const [messages, setMessages] = useState<HistoryItem[]>([{ role: 'tutor', text: exercise.intro }])
  const [lastEvidence, setLastEvidence] = useState<Evidence[]>([])
  const [next, setNext] = useState<Plan | null>(null)
  const speech = useSpeech()
  const speakRef = useRef(speech.speak)
  useEffect(() => { speakRef.current = speech.speak }, [speech.speak])
  useEffect(() => { speakRef.current(exercise.intro) }, [exercise.intro])

  const turn = useMutation({
    mutationFn: (req: TurnRequest) => tutorTurn(req),
    onSuccess: ({ reply, evidence, next }) => {
      setMessages((m) => [...m, { role: 'tutor', text: reply }])
      setLastEvidence(evidence)
      setNext(next.exerciseId !== exercise.id ? next : null)
      speakRef.current(reply)
      void queryClient.invalidateQueries({ queryKey: ['mastery', learnerId] })
    },
  })

  const send = (event: TurnRequest['event'], message?: string) => {
    if (message) setMessages((m) => [...m, { role: 'kid', text: message }])
    turn.mutate({
      learnerId,
      exerciseId: exercise.id,
      goal: exercise.goal,
      stateDescription: exercise.describe(state, exercise.answer === 'text' ? message : undefined),
      evidence: event === 'submitted' ? exercise.check(state) : [],
      event,
      message,
      history: messages,
    })
  }
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ evidence: Evidence[]; at: number } | null>(null)
  const canSubmit = !turn.isPending && exercise.canSubmit(state) && (exercise.answer !== 'text' || !!answer.trim())
  const submit = () => {
    if (!canSubmit) return
    if (exercise.answer === 'text') {
      send('submitted', answer.trim())
      setAnswer('')
    } else {
      setFeedback({ evidence: exercise.check(state), at: Date.now() })
      send('submitted')
    }
  }
  const happy = lastEvidence.length > 0 && lastEvidence.every((e) => e.ok)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="flex flex-col gap-4">
        <section aria-labelledby="mission-title" className="flex flex-wrap items-start gap-3 rounded-lg border-2 border-dashed border-border p-3">
          <Compass aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 id="mission-title" className="text-xl font-bold">
              {nickname ? `${nickname}: ` : ''}{exercise.title}
            </h1>
            <p className="text-sm">
              <span className="font-semibold">{MODE_LABEL[exercise.mode]}</span> · {exercise.skills.map((s) => SKILL_LABEL[s] ?? s).join(', ')}
            </p>
            <p className="text-sm text-muted-foreground">Por qué esta misión: {plan.reason}</p>
          </div>
          <Button variant="outline" onClick={() => send('stuck')} disabled={turn.isPending}>
            <LifeBuoy aria-hidden /> Me trabé
          </Button>
        </section>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <exercise.Component
              state={state}
              onChange={setState}
              disabled={turn.isPending}
              feedback={feedback}
            />
            {/* Provisional action area until the dock lands. */}
            <form
              className="mt-5 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {exercise.answer === 'text' && (
                <textarea
                  aria-label="Tu respuesta"
                  rows={2}
                  maxLength={600}
                  value={answer}
                  disabled={turn.isPending}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Yo creo que… porque…"
                  className="min-w-0 flex-1 rounded-lg border-2 border-border bg-card p-3 text-base"
                />
              )}
              <Button type="submit" size="lg" className="ml-auto" disabled={!canSubmit}>
                {exercise.answer === 'text' ? 'Enviar' : 'Comprobar'}
              </Button>
            </form>
          </CardContent>
        </Card>
        {lastEvidence.length > 0 && (
          <section aria-label="Lo que Musi anotó" className="flex flex-wrap gap-2">
            {lastEvidence.map((e, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${e.ok ? 'bg-green-100 text-green-900' : 'bg-orange-100 text-orange-900'}`}>
                {e.ok ? <CheckCircle2 aria-hidden className="size-4" /> : <XCircle aria-hidden className="size-4" />}
                {SKILL_LABEL[e.skill] ?? e.skill}: {e.ok ? 'demostrado' : 'todavía no'}
                {e.confidence !== 'high' && ` (confianza ${e.confidence === 'medium' ? 'media' : 'baja'})`}
              </span>
            ))}
          </section>
        )}
        {next && (
          <section aria-live="polite" className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary p-4 text-secondary-foreground">
            <p className="min-w-0 flex-1">
              <strong>Próxima misión: {EXERCISES[next.exerciseId]?.title}.</strong> {next.reason}
            </p>
            <Button size="lg" onClick={() => onNext(next)}>
              Seguir <ArrowRight aria-hidden />
            </Button>
          </section>
        )}
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <MusiPanel
          messages={messages}
          thinking={turn.isPending}
          happy={happy}
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
