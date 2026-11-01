import { useRef } from 'react'
import { BatteryMedium, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Evidence, ExerciseDefinition, ExerciseProps } from './types'

type Who = 'mom' | 'brother'

export interface NumberLineState {
  pos: Record<Who, number>
  moved: Record<Who, boolean>
  choice: Who | null
}

export const PHONES: Record<Who, { label: string; fraction: string; value: number; color: string }> = {
  mom: { label: 'Mamá', fraction: '3/4', value: 3 / 4, color: 'bg-teal-700' },
  brother: { label: 'Hermano', fraction: '2/3', value: 2 / 3, color: 'bg-purple-700' },
}

const TOLERANCE = 0.04
const KEY_STEP = 0.01
const clamp = (n: number) => Math.min(1, Math.max(0, n))
const fmt = (n: number) => n.toFixed(2).replace('.', ',')

function describe(state: NumberLineState): string {
  const placed = (Object.keys(PHONES) as Who[])
    .map((w) => (state.moved[w] ? `${PHONES[w].fraction} (${PHONES[w].label}) en ${fmt(state.pos[w])}` : `${PHONES[w].fraction} (${PHONES[w].label}) sin mover`))
    .join('; ')
  const choice = state.choice ? ` Eligió que dura más el de ${PHONES[state.choice].label} (${PHONES[state.choice].fraction}).` : ' Todavía no eligió cuál dura más.'
  return `Recta de 0 a 1 (batería vacía a llena). Ubicó ${placed}.${choice}`
}

function check(state: NumberLineState): Evidence[] {
  const errors = (Object.keys(PHONES) as Who[]).map((w) => ({ w, err: Math.abs(state.pos[w] - PHONES[w].value) }))
  const misplaced = errors.filter((e) => !state.moved[e.w] || e.err > TOLERANCE)
  const choiceOk = state.choice === 'mom'
  const ok = misplaced.length === 0 && choiceOk
  let detail: string
  if (ok) detail = 'Ubicó 3/4 y 2/3 bien en la recta y eligió 3/4 como mayor.'
  else if (misplaced.length)
    detail = misplaced
      .map((e) => (state.moved[e.w] ? `${PHONES[e.w].fraction} quedó en ${fmt(state.pos[e.w])} (error ${fmt(e.err)})` : `${PHONES[e.w].fraction} sin ubicar`))
      .join('; ') + '.'
  else if (!state.choice) detail = 'Ubicó bien las dos, pero no eligió cuál dura más.'
  else detail = 'Ubicó bien las dos, pero eligió 2/3 como mayor.'
  return [{ skill: 'fraction.compare', ok, confidence: 'high', detail }]
}

function NumberLine({ state, onChange, onSubmit, disabled }: ExerciseProps<NumberLineState>) {
  const lineRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<Who | null>(null)
  const setPos = (w: Who, v: number) =>
    onChange({ ...state, pos: { ...state.pos, [w]: clamp(v) }, moved: { ...state.moved, [w]: true } })
  const posFromEvent = (clientX: number) => {
    const rect = lineRef.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width)
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">
        El celular de tu mamá tiene <strong>3/4</strong> de batería y el de tu hermano, <strong>2/3</strong>. Arrastrá cada uno a
        donde va en la barra de 0 (vacía) a 1 (llena). ¿Cuál dura más?
      </p>
      <div className="px-10 pt-20 pb-20">
        <div ref={lineRef} className="relative h-3 rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-green-400">
          <span aria-hidden className="absolute top-1/2 -left-7 -translate-y-1/2 text-lg font-bold">0</span>
          <span aria-hidden className="absolute top-1/2 -right-7 -translate-y-1/2 text-lg font-bold">1</span>
          <span aria-hidden className="absolute -top-2 left-0 h-7 w-1 bg-foreground" />
          <span aria-hidden className="absolute -top-2 right-0 h-7 w-1 bg-foreground" />
          {(Object.keys(PHONES) as Who[]).map((w, i) => (
            <button
              key={w}
              type="button"
              role="slider"
              disabled={disabled}
              aria-label={`Celular de ${PHONES[w].label}, ${PHONES[w].fraction} de batería`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(state.pos[w] * 100)}
              aria-valuetext={state.moved[w] ? `en ${fmt(state.pos[w])}` : 'sin ubicar'}
              style={{ left: `${state.pos[w] * 100}%`, touchAction: 'none', top: i === 0 ? '-4.25rem' : '1.5rem' }}
              className={`absolute flex min-h-12 min-w-12 -translate-x-1/2 cursor-ew-resize flex-col items-center rounded-lg px-2 py-1 text-white shadow-md ${PHONES[w].color}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                dragging.current = w
              }}
              onPointerMove={(e) => {
                if (dragging.current === w) setPos(w, posFromEvent(e.clientX))
              }}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
              onKeyDown={(e) => {
                const step = (e.shiftKey ? 5 : 1) * KEY_STEP
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  setPos(w, state.pos[w] - step)
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setPos(w, state.pos[w] + step)
                }
              }}
            >
              <span className="flex items-center gap-1 text-sm font-bold">
                <Smartphone aria-hidden className="size-4" />
                {PHONES[w].label}
              </span>
              <span className="text-base font-bold">{PHONES[w].fraction}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Con el teclado: enfocá un celular y usá las flechas (con Mayúsculas, pasos grandes).
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex items-center gap-2 font-semibold">
          <BatteryMedium aria-hidden /> ¿Cuál celular tiene más batería?
        </legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(PHONES) as Who[]).map((w) => (
            <Button
              key={w}
              variant={state.choice === w ? 'default' : 'outline'}
              aria-pressed={state.choice === w}
              disabled={disabled}
              onClick={() => onChange({ ...state, choice: w })}
            >
              El de {PHONES[w].label} ({PHONES[w].fraction})
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => onSubmit()} className="ml-auto" disabled={disabled}>Listo</Button>
      </div>
    </div>
  )
}

export const numberLine: ExerciseDefinition<NumberLineState> = {
  id: 'fractions.number-line',
  mode: 'number-line',
  skills: ['fraction.compare'],
  title: 'La batería del celular',
  goal: 'Ubicar 3/4 y 2/3 en la recta de 0 a 1 y decidir cuál es mayor.',
  intro: 'El celular de tu mamá tiene tres cuartos de batería y el de tu hermano, dos tercios. Arrastrá cada celular a su lugar en la barra y decime cuál dura más.',
  initialState: () => ({ pos: { mom: 0.05, brother: 0.05 }, moved: { mom: false, brother: false }, choice: null }),
  describe,
  check,
  Component: NumberLine,
}
