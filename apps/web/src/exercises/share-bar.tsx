import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { Evidence, ExerciseDefinition } from './types'

export interface ShareBarState {
  cuts: number[]
}

const TOLERANCE = 0.03
const KEY_STEP = 0.01

export function partsOf(state: ShareBarState): number[] {
  const points = [0, ...[...state.cuts].sort((a, b) => a - b), 1]
  return points.slice(1).map((p, i) => p - points[i])
}

const clamp = (n: number) => Math.min(0.99, Math.max(0.01, n))

function describe(state: ShareBarState): string {
  const parts = partsOf(state)
  const sizes = parts.map((p) => `${Math.round(p * 100)}%`).join(', ')
  return `La barra tiene ${parts.length} ${parts.length === 1 ? 'parte' : 'partes'} de tamaños ${sizes}.`
}

function check(state: ShareBarState): Evidence[] {
  const parts = partsOf(state)
  const ok = parts.length === 4 && parts.every((p) => Math.abs(p - 0.25) <= TOLERANCE)
  let detail: string
  if (parts.length !== 4) detail = `Hay ${parts.length} partes en lugar de 4.`
  else if (ok) detail = 'Las 4 partes son casi iguales.'
  else detail = 'Hay 4 partes pero no son iguales.'
  return [{ skill: 'fraction.equal-parts', ok, confidence: 'high', detail }]
}

function ShareBar({
  state,
  onChange,
  onSubmit,
  highlight,
}: {
  state: ShareBarState
  onChange(s: ShareBarState): void
  onSubmit(): void
  highlight?: string
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)

  const posFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width)
  }
  const setCut = (i: number, v: number) =>
    onChange({ cuts: state.cuts.map((c, j) => (j === i ? clamp(v) : c)) })

  const addAtLargest = () => {
    const sorted = [...state.cuts].sort((a, b) => a - b)
    const pts = [0, ...sorted, 1]
    let best = 0
    for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1] - pts[i] > pts[best + 1] - pts[best]) best = i
    onChange({ cuts: [...state.cuts, clamp((pts[best] + pts[best + 1]) / 2)] })
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">Tenés una pizza larga y llegan tres amigos más. Cortala para que a los cuatro les toque lo mismo.</p>
      <div
        ref={barRef}
        role="group"
        aria-label="Pizza larga. Tocá la barra para agregar un corte."
        onClick={(e) => onChange({ cuts: [...state.cuts, posFromEvent(e.clientX)] })}
        className={`relative h-24 w-full cursor-crosshair rounded-lg border-4 border-amber-700 bg-amber-300 select-none sm:h-32 ${
          highlight === 'cuts' ? 'ring-4 ring-ring' : ''
        }`}
      >
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
                onChange({ cuts: state.cuts.filter((_, j) => j !== i) })
              }
            }}
          >
            <span aria-hidden className="mx-auto block h-full w-1.5 rounded bg-red-800" />
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {describe(state)} Con el teclado: enfocá un corte y usá las flechas; Suprimir lo borra.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={addAtLargest}>Agregar corte</Button>
        <Button variant="outline" onClick={() => onChange({ cuts: [] })}>Empezar de nuevo</Button>
        <Button size="lg" onClick={onSubmit} className="ml-auto">Listo</Button>
      </div>
    </div>
  )
}

export const shareBar: ExerciseDefinition<ShareBarState> = {
  id: 'fractions.share-bar',
  skills: ['fraction.equal-parts'],
  goal: 'Cortar la barra en 4 partes iguales para repartirla entre 4 amigos.',
  initialState: () => ({ cuts: [] }),
  describe,
  check,
  Component: ShareBar,
}
