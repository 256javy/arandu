import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { Evidence, ExerciseDefinition, ExerciseProps } from './types'

export interface ShareBarState {
  cuts: number[]
  /** Answer to "what part did Leo get?", once the parts are equal. */
  num: string
  den: string
}

const TOLERANCE = 0.03
const KEY_STEP = 0.01

export function partsOf(state: Pick<ShareBarState, 'cuts'>): number[] {
  const points = [0, ...[...state.cuts].sort((a, b) => a - b), 1]
  return points.slice(1).map((p, i) => p - points[i])
}

export const isEqualSplit = (state: Pick<ShareBarState, 'cuts'>) => {
  const parts = partsOf(state)
  return parts.length === 4 && parts.every((p) => Math.abs(p - 0.25) <= TOLERANCE)
}

const clamp = (n: number) => Math.min(0.99, Math.max(0.01, n))

function describe(state: ShareBarState): string {
  const parts = partsOf(state)
  const sizes = parts.map((p) => `${Math.round(p * 100)}%`).join(', ')
  let text = `La barra tiene ${parts.length} ${parts.length === 1 ? 'parte' : 'partes'} de tamaños ${sizes}.`
  if (isEqualSplit(state) && (state.num || state.den)) {
    text += ` Para la parte de Leo escribió ${state.num || '?'}/${state.den || '?'}.`
  }
  return text
}

function check(state: ShareBarState): Evidence[] {
  const parts = partsOf(state)
  const ok = isEqualSplit(state)
  let detail: string
  if (parts.length !== 4) detail = `Hay ${parts.length} partes en lugar de 4.`
  else if (ok) detail = 'Cortó 4 partes casi iguales.'
  else detail = 'Hay 4 partes pero no son iguales.'
  const evidence: Evidence[] = [{ skill: 'fraction.equal-parts', ok, confidence: 'high', detail }]
  if (ok && state.num.trim() && state.den.trim()) {
    const n = Number(state.num)
    const d = Number(state.den)
    const named = n === 1 && d === 4
    evidence.push({
      skill: 'fraction.notation',
      ok: named,
      confidence: 'high',
      detail: named ? 'Escribió 1/4 para una de cuatro partes.' : `Escribió ${state.num}/${state.den} para una de cuatro partes.`,
    })
  }
  return evidence
}

function ShareBar({ state, onChange, onSubmit, disabled }: ExerciseProps<ShareBarState>) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const equal = isEqualSplit(state)

  const posFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width)
  }
  const setCuts = (cuts: number[]) => onChange({ ...state, cuts })
  const setCut = (i: number, v: number) => setCuts(state.cuts.map((c, j) => (j === i ? clamp(v) : c)))

  const addAtLargest = () => {
    const sorted = [...state.cuts].sort((a, b) => a - b)
    const pts = [0, ...sorted, 1]
    let best = 0
    for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1] - pts[i] > pts[best + 1] - pts[best]) best = i
    setCuts([...state.cuts, clamp((pts[best] + pts[best + 1]) / 2)])
  }
  const firstCut = state.cuts.length ? Math.min(...state.cuts) : 0

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">Tenés una pizza larga y llegan tres amigos más. Cortala para que a los cuatro les toque lo mismo.</p>
      <div
        ref={barRef}
        role="group"
        aria-label="Pizza larga. Tocá la barra para agregar un corte."
        onClick={(e) => setCuts([...state.cuts, posFromEvent(e.clientX)])}
        className="relative h-24 w-full cursor-crosshair overflow-visible rounded-lg border-4 border-amber-700 bg-amber-300 select-none sm:h-32"
      >
        {equal && (
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-l bg-red-500/40"
            style={{ width: `${firstCut * 100}%` }}
          />
        )}
        {state.cuts.map((c, i) => (
          <button
            key={i}
            type="button"
            role="slider"
            aria-label={`Corte ${i + 1}`}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(c * 100)}
            aria-valuetext={`${Math.round(c * 100)}% de la barra`}
            style={{ left: `${c * 100}%`, touchAction: 'none' }}
            className="absolute top-[-8px] bottom-[-8px] w-11 -translate-x-1/2 cursor-ew-resize"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              dragging.current = i
            }}
            onPointerMove={(e) => {
              if (dragging.current === i) setCut(i, posFromEvent(e.clientX))
            }}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                setCut(i, c - (e.shiftKey ? 5 : 1) * KEY_STEP)
              } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                setCut(i, c + (e.shiftKey ? 5 : 1) * KEY_STEP)
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault()
                setCuts(state.cuts.filter((_, j) => j !== i))
              }
            }}
          >
            <span aria-hidden className="mx-auto block h-full w-1.5 rounded bg-red-800" />
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {describe({ ...state, num: '', den: '' })} Con el teclado: enfocá un corte y usá las flechas; Suprimir lo borra.
      </p>
      {equal && (
        <fieldset className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3">
          <legend className="sr-only">Notación</legend>
          <p className="w-full font-semibold">Le das el pedazo marcado a tu amigo Leo. ¿Qué parte de toda la pizza se llevó?</p>
          <span className="inline-flex flex-col items-center gap-1">
            <input
              aria-label="Numerador: cuántos pedazos se llevó"
              inputMode="numeric"
              maxLength={2}
              value={state.num}
              onChange={(e) => onChange({ ...state, num: e.target.value.replace(/\D/g, '') })}
              className="h-12 w-16 rounded-lg border-2 border-border bg-card text-center text-xl"
            />
            <span aria-hidden className="h-1 w-16 rounded bg-foreground" />
            <input
              aria-label="Denominador: en cuántos pedazos iguales está cortada"
              inputMode="numeric"
              maxLength={2}
              value={state.den}
              onChange={(e) => onChange({ ...state, den: e.target.value.replace(/\D/g, '') })}
              className="h-12 w-16 rounded-lg border-2 border-border bg-card text-center text-xl"
            />
          </span>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={addAtLargest} disabled={disabled}>Agregar corte</Button>
        <Button variant="outline" onClick={() => onChange({ cuts: [], num: '', den: '' })} disabled={disabled}>
          Empezar de nuevo
        </Button>
        <Button size="lg" onClick={() => onSubmit()} className="ml-auto" disabled={disabled}>Listo</Button>
      </div>
    </div>
  )
}

export const shareBar: ExerciseDefinition<ShareBarState> = {
  id: 'fractions.share-bar',
  mode: 'manipulable',
  skills: ['fraction.equal-parts', 'fraction.notation'],
  title: 'Repartir una pizza',
  goal: 'Cortar la barra en 4 partes iguales para repartirla entre 4 amigos y nombrar la parte de uno con una fracción.',
  intro: 'Tenés una pizza larga y llegan tres amigos más. Tocá la barra para cortarla, así a los cuatro les toca lo mismo. Cuando termines, apretá «Listo».',
  initialState: () => ({ cuts: [], num: '', den: '' }),
  describe,
  check,
  Component: ShareBar,
}
