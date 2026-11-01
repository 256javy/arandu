import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import {
  createLearner,
  deleteLearner,
  getEvidence,
  getMastery,
  getMe,
  getNext,
  getStoredLearnerId,
  getToken,
  logout,
  storeLearnerId,
  type Learner,
  type SkillStatus,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EXERCISES, MODE_LABEL, exerciseTitle } from '@/exercises'

const STATUS: Record<SkillStatus, { text: string; cls: string }> = {
  new: { text: 'Sin empezar', cls: 'bg-muted text-foreground' },
  practicing: { text: 'Practicando', cls: 'bg-amber-100 text-amber-950' },
  stuck: { text: 'Trabado', cls: 'bg-orange-100 text-orange-950' },
  likely: { text: 'Probable (falta confirmar)', cls: 'bg-sky-100 text-sky-950' },
  mastered: { text: 'Demostrado', cls: 'bg-green-100 text-green-950' },
}

const CONFIDENCE = { high: 'alta', medium: 'media', low: 'baja' } as const

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-PY', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const modeOf = (exerciseId: string | null) => {
  const e = exerciseId ? EXERCISES[exerciseId] : undefined
  return e ? MODE_LABEL[e.mode].toLowerCase() : ''
}

export function Family() {
  const token = getToken()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !!token })
  const [selected, setSelected] = useState<string | null>(getStoredLearnerId())
  const [nickname, setNickname] = useState('')
  const create = useMutation({
    mutationFn: createLearner,
    onSuccess: (l) => {
      setNickname('')
      setSelected(l.id)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  if (!token) return <Navigate to="/entrar" />
  const learners = me.data?.learners ?? []
  const current = learners.find((l) => l.id === selected) ?? learners[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Familia</h1>
        <div className="flex items-center gap-3">
          {me.data && <span className="text-sm text-muted-foreground">{me.data.email}</span>}
          <Button
            variant="outline"
            onClick={async () => {
              await logout().catch(() => undefined)
              queryClient.clear()
              void navigate({ to: '/' })
            }}
          >
            Salir
          </Button>
        </div>
      </div>
      {me.isError && <p role="alert" className="text-red-700">No pudimos cargar la cuenta.</p>}

      <Card>
        <CardHeader><CardTitle>Perfiles</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {learners.length > 0 && (
            <div role="tablist" aria-label="Perfiles" className="flex flex-wrap gap-2">
              {learners.map((l) => (
                <Button
                  key={l.id}
                  role="tab"
                  aria-selected={current?.id === l.id}
                  variant={current?.id === l.id ? 'default' : 'outline'}
                  onClick={() => setSelected(l.id)}
                >
                  {l.nickname}
                </Button>
              ))}
            </div>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (nickname.trim()) create.mutate(nickname.trim())
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="nickname" className="font-semibold">Nuevo perfil (solo un apodo)</label>
              <input
                id="nickname"
                value={nickname}
                maxLength={40}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="off"
                aria-describedby="nickname-hint"
                className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-base"
              />
              <p id="nickname-hint" className="text-sm text-muted-foreground">Sin apellido, sin foto, sin email.</p>
            </div>
            <Button type="submit" disabled={create.isPending} className="mb-6">Crear perfil</Button>
          </form>
          {create.isError && <p role="alert" className="text-red-700">No pudimos crear el perfil.</p>}
        </CardContent>
      </Card>

      {current && <LearnerProgress key={current.id} learner={current} />}
    </div>
  )
}

function LearnerProgress({ learner }: { learner: Learner }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const mastery = useQuery({ queryKey: ['mastery', learner.id], queryFn: () => getMastery(learner.id) })
  const evidence = useQuery({ queryKey: ['evidence', learner.id], queryFn: () => getEvidence(learner.id) })
  const next = useQuery({ queryKey: ['next-family', learner.id], queryFn: () => getNext(learner.id) })
  const remove = useMutation({
    mutationFn: () => deleteLearner(learner.id),
    onSuccess: () => {
      if (getStoredLearnerId() === learner.id) storeLearnerId(null)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Progreso de {learner.nickname}</CardTitle>
          <Button
            onClick={() => {
              storeLearnerId(learner.id)
              void navigate({ to: '/aprender' })
            }}
          >
            Aprender como {learner.nickname}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mastery.isPending && <p>Cargando…</p>}
          {mastery.isError && <p role="alert" className="text-red-700">No pudimos cargar el progreso.</p>}
          <ul className="flex flex-col gap-4">
            {mastery.data?.map((m) => {
              const pct = Math.round(m.mastery * 100)
              return (
                <li key={m.skill} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                    <span>{m.label.charAt(0).toUpperCase() + m.label.slice(1)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-sm ${STATUS[m.status].cls}`}>{STATUS[m.status].text}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Dominio de ${m.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="h-4 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {m.attempts === 0
                      ? 'Todavía sin intentos.'
                      : `${m.successes} de ${m.attempts} bien. Último: ${m.lastDetail ?? ''} (${modeOf(m.lastExercise)}, confianza ${CONFIDENCE[m.lastConfidence ?? 'high']})`}
                  </p>
                </li>
              )
            })}
          </ul>
          {next.data && (
            <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">
              <strong>Arandu eligió como próxima misión:</strong> {exerciseTitle(next.data.exerciseId)}. {next.data.reason}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Evidencia reciente</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Se guarda lo que demostró en cada habilidad, no las conversaciones. Confianza alta: lo corrigió el ejercicio; media: lo juzgó el modelo.
          </p>
          {evidence.data?.length === 0 && <p>Todavía no hay evidencia.</p>}
          <ol className="flex flex-col gap-2">
            {evidence.data?.map((e, i) => (
              <li key={i} className="border-l-4 pl-3" style={{ borderColor: e.ok ? '#15803d' : '#c2410c' }}>
                <p className="font-semibold">
                  {e.ok ? '✓' : '✗'} {e.label} <span className="font-normal text-muted-foreground">· {exerciseTitle(e.exercise)} · {fmtDate(e.at)}</span>
                </p>
                <p className="text-sm">{e.detail} <span className="text-muted-foreground">(confianza {CONFIDENCE[e.confidence]})</span></p>
              </li>
            ))}
          </ol>
          <div className="mt-2 border-t pt-4">
            {!confirming ? (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden /> Borrar perfil
              </Button>
            ) : (
              <div role="alertdialog" aria-labelledby="del-title" className="flex flex-col gap-3 rounded-lg border-2 border-red-700 p-3">
                <p id="del-title">¿Borrar el perfil de {learner.nickname} y toda su evidencia? No se puede deshacer.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>Sí, borrar</Button>
                  <Button variant="outline" onClick={() => setConfirming(false)} autoFocus>Cancelar</Button>
                </div>
                {remove.isError && <p role="alert" className="text-red-700">No pudimos borrar el perfil.</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
