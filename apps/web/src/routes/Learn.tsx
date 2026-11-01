import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { BatteryMedium, LifeBuoy, MessageCircle, MessagesSquare, Pizza, RotateCcw, Star, Volume2, VolumeX, X } from 'lucide-react'
import { getNext, getStoredLearnerId, getToken, tutorTurn, wakeApi, type Plan, type TurnRequest } from '@/api/client'
import { Button } from '@/components/ui/button'
import { EXERCISES } from '@/exercises'
import { confetti } from '@/lib/fx'
import { ChatDrawer } from '@/musi/ChatDrawer'
import { MusiCharacter, type MusiMood } from '@/musi/MusiCharacter'
import { useSpeech } from '@/musi/useSpeech'
import { COPY, initMission, missionReducer } from './mission'

/** The three stops of the path; explain variants share the last one. */
const PATH = [
  { label: 'Pizza', icon: Pizza, ids: ['fractions.share-bar'] },
  { label: 'Batería', icon: BatteryMedium, ids: ['fractions.number-line'] },
  { label: 'Explicar', icon: MessageCircle, ids: ['fractions.explain-compare', 'fractions.explain-equivalence'] },
]
const nodeOf = (exerciseId: string) => PATH.findIndex((p) => p.ids.includes(exerciseId))

/** How long a "check" reaction stays before Musi starts thinking about the API reply. */
const REACT_MS = 700
const TALK_MS = 900

export function Learn() {
  const learnerId = getStoredLearnerId()
  const token = getToken()
  useEffect(() => wakeApi(), [])
  const plan = useQuery({ queryKey: ['next', learnerId], queryFn: () => getNext(learnerId!), enabled: !!learnerId && !!token, gcTime: 0, refetchOnWindowFocus: false })
  // each "Continuar" mounts a fresh mission, even when the planner repeats an exercise
  const [current, setCurrent] = useState<{ plan: Plan; n: number } | null>(null)
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [stars, setStars] = useState(0)
  const complete = useCallback((exerciseId: string) => {
    setStars((n) => n + 1)
    setDone((d) => new Set(d).add(nodeOf(exerciseId)))
  }, [])

  if (!token) return <Navigate to="/entrar" />
  if (!learnerId) return <Navigate to="/" />
  if (plan.isError) return <p role="alert" className="text-red-700">No pudimos cargar la misión. <Link to="/" className="underline">Volver</Link></p>
  const active = current?.plan ?? plan.data
  if (!active) return <p>Cargando tu misión…</p>

  return (
    <Mission
      key={current?.n ?? 0}
      learnerId={learnerId}
      plan={active}
      done={done}
      stars={stars}
      onComplete={complete}
      onNext={(p) => setCurrent((c) => ({ plan: p, n: (c?.n ?? 0) + 1 }))}
    />
  )
}

function MissionPath({ currentNode, done, stars }: { currentNode: number; done: Set<number>; stars: number }) {
  return (
    <nav aria-label="Camino de misiones" className="flex items-center gap-3">
      <Button asChild variant="outline" size="icon" className="shrink-0 rounded-full">
        <Link to="/" aria-label="Salir"><X aria-hidden /></Link>
      </Button>
      <ol className="flex flex-1 items-center">
        {PATH.map((p, i) => {
          const isDone = done.has(i)
          const isCurrent = i === currentNode
          return (
            <li key={p.label} className="flex flex-1 items-center last:flex-none">
              <span
                aria-label={`${p.label}${isDone ? ', lista' : isCurrent ? ', ahora' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  isDone ? 'border-green-700 bg-green-600 text-white' : isCurrent ? 'border-amber-600 bg-amber-100 text-amber-900 ring-4 ring-amber-300' : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <p.icon aria-hidden className="size-5" />
              </span>
              {i < PATH.length - 1 && <span aria-hidden className={`mx-1 h-1.5 flex-1 rounded ${isDone ? 'bg-green-600' : 'bg-border'}`} />}
            </li>
          )
        })}
      </ol>
      <span className="flex shrink-0 items-center gap-1 text-lg font-bold" aria-label={`${stars} estrellas`}>
        <Star aria-hidden className="size-6 fill-amber-400 text-amber-600" /> {stars}
      </span>
    </nav>
  )
}

function Bubble({ text, bubbleKey, side }: { text: string; bubbleKey: number; side: 'left' | 'bottom' }) {
  return (
    <p
      key={bubbleKey}
      aria-hidden
      className={`bubble-in relative rounded-2xl border-2 border-amber-700 bg-white px-3 py-2 text-base font-semibold text-amber-950 sm:text-lg ${
        side === 'left'
          ? "before:absolute before:top-1/2 before:-left-2 before:size-3 before:-translate-y-1/2 before:rotate-45 before:border-b-2 before:border-l-2 before:border-amber-700 before:bg-white before:content-['']"
          : "before:absolute before:-bottom-2 before:left-1/2 before:size-3 before:-translate-x-1/2 before:rotate-45 before:border-r-2 before:border-b-2 before:border-amber-700 before:bg-white before:content-['']"
      }`}
    >
      {text}
    </p>
  )
}

function Mission({ learnerId, plan, done, stars, onComplete, onNext }: {
  learnerId: string
  plan: Plan
  done: Set<number>
  stars: number
  onComplete(exerciseId: string): void
  onNext(p: Plan): void
}) {
  const exercise = EXERCISES[plan.exerciseId]
  const queryClient = useQueryClient()
  const [state, setState] = useState(() => exercise.initialState())
  const [m, dispatch] = useReducer(missionReducer, undefined, () => initMission(exercise.intro, exercise.firstBubble))
  const [answer, setAnswer] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const closeChat = useCallback(() => setChatOpen(false), [])
  const [talking, setTalking] = useState(false)
  const speech = useSpeech()
  const musiRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isText = exercise.answer === 'text'

  // step-dependent copy (e.g. cut → notation)
  const step = exercise.step?.(state)
  const copy = (step && exercise.stepCopy?.[step]) || { prompt: exercise.prompt, bubble: exercise.firstBubble }
  const lastStep = useRef(step)
  useEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    dispatch({ type: 'step', bubble: copy.bubble })
  }, [step, copy.bubble])

  const turn = useMutation({
    mutationFn: (req: TurnRequest) => tutorTurn(req),
    // one automatic retry, then the kid gets a "Reintentar" button
    retry: 1,
    retryDelay: 1500,
    onSuccess: ({ reply, evidence, next }, req) => {
      dispatch({ type: 'reply', reply, evidence, next, exerciseId: exercise.id, skills: exercise.skills, submitted: req.event === 'submitted' })
      void queryClient.invalidateQueries({ queryKey: ['mastery', learnerId] })
    },
    onError: () => dispatch({ type: 'fail' }),
  })

  // after the local reaction, Musi thinks while the API answers
  useEffect(() => {
    if (m.phase !== 'checking') return
    const t = setTimeout(() => dispatch({ type: 'think' }), REACT_MS)
    return () => clearTimeout(t)
  }, [m.phase])

  // every new bubble: talk briefly, speak (if unmuted), focus the field for follow-up questions
  const speakRef = useRef(speech.speak)
  useEffect(() => { speakRef.current = speech.speak }, [speech.speak])
  useEffect(() => {
    setTalking(true)
    speakRef.current(m.bubble)
    const t = setTimeout(() => setTalking(false), TALK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.bubbleKey])
  useEffect(() => {
    if (isText && m.phase === 'working' && m.bubbleKey > 0) inputRef.current?.focus()
  }, [isText, m.phase, m.bubbleKey])

  const completed = useRef(false)
  useEffect(() => {
    if (m.phase !== 'done' || completed.current) return
    completed.current = true
    onComplete(exercise.id)
    if (musiRef.current) confetti(musiRef.current)
  }, [m.phase, exercise.id, onComplete])

  const send = (event: TurnRequest['event'], kidText?: string) => {
    const request: TurnRequest = {
      learnerId,
      exerciseId: exercise.id,
      goal: exercise.goal,
      stateDescription: exercise.describe(state, kidText),
      evidence: event === 'submitted' ? exercise.check(state) : [],
      event,
      message: kidText,
      history: m.messages,
    }
    dispatch({ type: 'send', request, kidText })
    turn.mutate(request)
  }

  const busy = m.phase === 'checking' || m.phase === 'waiting'
  const canSubmit = m.phase === 'working' && exercise.canSubmit(state) && (!isText || !!answer.trim())
  const submit = () => {
    if (!canSubmit) return
    if (isText) {
      send('submitted', answer.trim())
      setAnswer('')
      return
    }
    const evidence = exercise.check(state)
    dispatch({ type: 'check', evidence, bubble: exercise.localFeedback(evidence), at: Date.now() })
    send('submitted')
  }
  const onChange = (s: typeof state) => {
    setState(s)
    dispatch({ type: 'interact' })
  }

  const mood: MusiMood = m.mood
  const allDone = m.phase === 'done' && PATH.every((_, i) => done.has(i))
  const liveText = m.phase === 'waiting' ? COPY.thinking : m.bubble

  let primary: React.ReactNode
  if (m.phase === 'done' && m.next) primary = <Button size="lg" onClick={() => onNext(m.next!)} autoFocus>Continuar</Button>
  else if (m.phase === 'switch' && m.next) primary = <Button size="lg" onClick={() => onNext(m.next!)} autoFocus>Probar otra</Button>
  else if (m.phase === 'error')
    primary = (
      <Button size="lg" onClick={() => { dispatch({ type: 'retry' }); turn.mutate(m.lastRequest!) }} autoFocus>
        Reintentar
      </Button>
    )
  else primary = <Button type="submit" size="lg" disabled={!canSubmit}>{isText ? 'Enviar' : 'Comprobar'}</Button>

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-4">
      <MissionPath currentNode={nodeOf(exercise.id)} done={done} stars={stars} />

      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <section aria-labelledby="mission-prompt" className="flex flex-col gap-4">
          <h1 id="mission-prompt" className="text-2xl font-bold sm:text-3xl">{copy.prompt}</h1>
          <p id="mission-intro" className="sr-only">{exercise.intro}</p>
          <div aria-describedby="mission-intro">
            <exercise.Component state={state} onChange={onChange} disabled={busy || m.phase === 'done'} feedback={m.feedback} />
          </div>
          {m.phase === 'done' && (
            <div className="pop-in flex flex-col items-center gap-1 rounded-2xl bg-green-100 p-4 text-center text-green-950">
              <p className="text-2xl font-bold">{COPY.done}</p>
              {allDone && <p className="text-lg">{COPY.allDone}</p>}
            </div>
          )}
        </section>

        {/* desktop: Musi next to the visual, bubble pointing at it */}
        <aside className="sticky top-4 hidden flex-row-reverse items-center gap-2 lg:flex lg:flex-col-reverse">
          <div ref={musiRef}><MusiCharacter mood={mood} talking={talking || speech.speaking} className="size-28" /></div>
          <Bubble text={m.bubble} bubbleKey={m.bubbleKey} side="bottom" />
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">{liveText}</p>

      <form
        aria-label="Respuesta"
        className="sticky bottom-0 z-30 -mx-4 flex flex-col gap-2 border-t-2 bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {/* phone/tablet: Musi + one-sentence bubble live in the dock */}
        <div className="flex items-center gap-3 lg:hidden">
          <div className="shrink-0"><MusiCharacter mood={mood} talking={talking || speech.speaking} className="size-14" /></div>
          <Bubble text={m.bubble} bubbleKey={m.bubbleKey} side="left" />
        </div>
        {isText && (m.phase === 'working' || busy) && (
          <textarea
            ref={inputRef}
            aria-label="Tu respuesta"
            rows={2}
            maxLength={600}
            value={answer}
            disabled={busy}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Yo creo que…"
            className="w-full rounded-xl border-2 border-border bg-card p-3 text-base"
          />
        )}
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" aria-label="Me trabé" title="Me trabé" disabled={busy || m.phase !== 'working'} onClick={() => send('stuck')}>
            <LifeBuoy aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Ver charla" title="Ver charla" onClick={() => setChatOpen(true)}>
            <MessagesSquare aria-hidden />
          </Button>
          {!isText && (
            <Button type="button" variant="outline" size="icon" aria-label="De nuevo" title="De nuevo" disabled={busy || m.phase === 'done'} onClick={() => onChange(exercise.initialState())}>
              <RotateCcw aria-hidden />
            </Button>
          )}
          {speech.supported && (
            <Button type="button" variant="outline" size="icon" aria-pressed={!speech.muted} aria-label={speech.muted ? 'Activar voz' : 'Silenciar voz'} title={speech.muted ? 'Activar voz' : 'Silenciar voz'} onClick={speech.toggleMute}>
              {speech.muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </Button>
          )}
          <div className="ml-auto">{primary}</div>
        </div>
      </form>

      <ChatDrawer open={chatOpen} messages={m.messages} onClose={closeChat} />
    </div>
  )
}
