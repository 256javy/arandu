import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { flyFrom, knifeDown, popIn, pulse, shake, snapTo, tapHint } from '@/lib/fx'
import { Face, MiniPizza, PizzaArt } from './visuals/Pizza'
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

/** Once the split is equal, cuts "click" into the exact quarters (keeping each cut's identity/order in the array). */
export function snapEqual(cuts: number[]): number[] {
  if (!isEqualSplit({ cuts })) return cuts
  const order = cuts.map((c, i) => [c, i] as const).sort((a, b) => a[0] - b[0])
  const out = [...cuts]
  order.forEach(([, i], k) => (out[i] = (k + 1) / 4))
  return out
}

/** Index (in left-to-right order) of the biggest piece: the culprit shown on a bad split. */
export function largestPart(state: Pick<ShareBarState, 'cuts'>): number {
  const parts = partsOf(state)
  return parts.indexOf(Math.max(...parts))
}

/** Midpoint of the biggest piece, where the "+" button adds a cut. */
export function cutAtLargest(cuts: number[]): number {
  const pts = [0, ...[...cuts].sort((a, b) => a - b), 1]
  const i = largestPart({ cuts })
  return clamp((pts[i] + pts[i + 1]) / 2)
}

export type Slot = 'num' | 'den'
export const TILES = [1, 2, 3, 4, 5] as const

/** A tile flies to the given slot, or to the first empty one (top first). Both full and no slot: no change. */
export function placeTile(state: ShareBarState, n: number, slot?: Slot | null): ShareBarState {
  const target = slot ?? (!state.num ? 'num' : !state.den ? 'den' : null)
  return target ? { ...state, [target]: String(n) } : state
}

/** Tapping a full slot sends its tile back. */
export const clearSlot = (state: ShareBarState, slot: Slot): ShareBarState => ({ ...state, [slot]: '' })

function describe(state: ShareBarState): string {
  const parts = partsOf(state)
  let text = `La pizza tiene ${parts.length} ${parts.length === 1 ? 'pedazo' : 'pedazos'}`
  if (parts.length === 1) text += ' (sin cortar).'
  else if (parts.every((p) => Math.abs(p - 1 / parts.length) <= TOLERANCE)) text += ', todos iguales.'
  else {
    const max = Math.max(...parts)
    const min = Math.min(...parts)
    text += max > 2 * min ? ', y algunos son mucho más grandes que otros.' : ', y no son todos iguales: algunos son un poco más grandes.'
  }
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

const FRIENDS = ['Leo', 'Vos', 'Ana', 'Tito']
const ring = (on: boolean) => (on ? 'ring-4 ring-sky-500 ring-offset-2' : '')

function ShareBar({ state, onChange, disabled, feedback, highlight }: ExerciseProps<ShareBarState>) {
  const barRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<HTMLSpanElement>(null)
  const okRef = useRef<HTMLSpanElement>(null)
  const leoRef = useRef<HTMLDivElement>(null)
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([])
  const cutRefs = useRef<(HTMLButtonElement | null)[]>([])
  const slotRefs = useRef<Record<Slot, HTMLButtonElement | null>>({ num: null, den: null })
  const slotValRefs = useRef<Record<Slot, HTMLSpanElement | null>>({ num: null, den: null })
  const flying = useRef<{ slot: Slot; x: number; y: number } | null>(null)
  const pendingSnap = useRef<number[] | null>(null)
  const dragging = useRef<number | null>(null)
  const [active, setActive] = useState<Slot | null>(null)
  const [culprit, setCulprit] = useState<number | null>(null)
  const [ok, setOk] = useState(false)
  const [badSlot, setBadSlot] = useState<Slot | null>(null)

  const equal = isEqualSplit(state)
  const parts = partsOf(state)
  const sorted = [...state.cuts].sort((a, b) => a - b)
  const starts = [0, ...sorted]

  const posFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width)
  }
  const emit = (s: ShareBarState) => {
    setCulprit(null)
    setOk(false)
    setBadSlot(null)
    onChange(s)
  }
  /** Commits cuts; when they become equal they click into the exact quarters (with spring + pulse). */
  const commitCuts = (cuts: number[], snap: boolean) => {
    const snapped = snap ? snapEqual(cuts) : cuts
    if (snapped !== cuts) pendingSnap.current = cuts
    emit({ ...state, cuts: snapped })
  }
  const setCut = (i: number, v: number, snap: boolean) => commitCuts(state.cuts.map((c, j) => (j === i ? clamp(v) : c)), snap)

  // Snap "click": each cut springs from where the finger left it, and the pizza pulses once.
  useLayoutEffect(() => {
    const before = pendingSnap.current
    if (!before) return
    pendingSnap.current = null
    const w = barRef.current?.getBoundingClientRect().width ?? 0
    state.cuts.forEach((c, i) => {
      const el = cutRefs.current[i]
      if (el && before[i] !== undefined) snapTo(el, (before[i] - c) * w)
    })
    if (wrapRef.current) pulse(wrapRef.current)
  }, [state.cuts])

  // Leo's piece jumps toward his face when the notation step opens.
  useEffect(() => {
    if (!equal) return
    const el = pieceRefs.current[0]
    if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-22px) scale(1.05)' }, { transform: 'translateY(0)' }], { duration: 500, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    if (leoRef.current) popIn(leoRef.current)
  }, [equal])

  // Invite to touch: the hand taps twice, only on the untouched pizza.
  useEffect(() => {
    if (handRef.current) tapHint(handRef.current)
  }, [])

  // Tile flies from the tray into its slot (FLIP).
  useLayoutEffect(() => {
    const f = flying.current
    if (!f) return
    flying.current = null
    const el = slotValRefs.current[f.slot]
    if (!el) return
    const r = el.getBoundingClientRect()
    flyFrom(el, f.x - (r.left + r.width / 2), f.y - (r.top + r.height / 2))
  }, [state.num, state.den])

  // Feedback from the dock's «Comprobar».
  useEffect(() => {
    if (!feedback) return
    const bad = feedback.evidence.find((e) => !e.ok)
    if (!bad) {
      setOk(true)
      requestAnimationFrame(() => {
        if (okRef.current) popIn(okRef.current)
        if (wrapRef.current) pulse(wrapRef.current)
      })
      return
    }
    if (bad.skill === 'fraction.notation') {
      const slot: Slot = Number(state.num) !== 1 ? 'num' : 'den'
      const which: Slot = Number(state.den) !== 4 ? 'den' : slot
      setBadSlot(which)
      requestAnimationFrame(() => {
        const el = slotRefs.current[which]
        if (el) shake(el)
        pieceRefs.current.forEach((p, k) => p?.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 400, delay: k * 120 }))
      })
    } else {
      const i = largestPart(state)
      setCulprit(i)
      requestAnimationFrame(() => {
        const el = pieceRefs.current[i] ?? barRef.current
        if (el) shake(el)
      })
    }
    // Only react to a new check result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.at])

  const pickTile = (n: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const next = placeTile(state, n, active)
    if (next === state) return
    const target: Slot = next.num !== state.num ? 'num' : 'den'
    const r = e.currentTarget.getBoundingClientRect()
    flying.current = { slot: target, x: r.left + r.width / 2, y: r.top + r.height / 2 }
    setActive(null)
    emit(next)
  }

  const slotButton = (slot: Slot) => {
    const value = state[slot]
    const label =
      slot === 'num'
        ? `Arriba: cuántos pedazos se llevó Leo. ${value ? `Tiene ${value}; tocá para sacarlo.` : 'Vacía.'}`
        : `Abajo: en cuántos pedazos iguales está cortada la pizza. ${value ? `Tiene ${value}; tocá para sacarlo.` : 'Vacía.'}`
    const bad = badSlot === slot
    return (
      <button
        ref={(el) => {
          slotRefs.current[slot] = el
        }}
        type="button"
        aria-label={label}
        aria-pressed={active === slot}
        disabled={disabled}
        onClick={() => (value ? emit(clearSlot(state, slot)) : setActive(active === slot ? null : slot))}
        onKeyDown={(e) => {
          if (/^[1-5]$/.test(e.key)) {
            e.preventDefault()
            emit(placeTile(state, Number(e.key), slot))
          } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            emit(clearSlot(state, slot))
          }
        }}
        onPointerEnter={slot === 'den' ? () => pieceRefs.current.forEach((p, k) => p?.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 350, delay: k * 150 })) : undefined}
        onFocus={slot === 'den' ? () => pieceRefs.current.forEach((p, k) => p?.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 350, delay: k * 150 })) : undefined}
        className={`flex h-20 w-36 items-center justify-center gap-2 rounded-2xl border-4 outline-2 outline-transparent transition-colors sm:h-24 sm:w-44 ${
          bad ? 'border-red-700 bg-red-50' : active === slot ? 'border-sky-600 bg-sky-50' : value ? 'border-amber-700 bg-amber-50' : 'border-dashed border-stone-500 bg-white'
        } ${ring(highlight === `slot-${slot}`)}`}
      >
        <MiniPizza parts={4} only={slot === 'num'} className={slot === 'num' ? 'h-12 w-8' : 'h-10 w-20'} />
        <span
          ref={(el) => {
            slotValRefs.current[slot] = el
          }}
          className="min-w-8 text-4xl font-black text-stone-900"
        >
          {value || ''}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Friends above their quarter of the pizza; Leo gets the first one. */}
      <div aria-hidden className="grid w-full max-w-2xl grid-cols-4">
        {FRIENDS.map((name, i) => (
          <div key={name} ref={i === 0 ? leoRef : undefined} className="flex flex-col items-center">
            <Face i={i} happy={ok || (equal && i === 0)} className={`size-11 sm:size-14 ${equal && i === 0 ? 'drop-shadow-[0_0_6px_#0ea5e9]' : ''}`} />
            <span className={`text-xs font-bold ${i === 0 ? 'text-sky-800' : 'text-stone-600'}`}>{name}</span>
          </div>
        ))}
      </div>

      <div ref={wrapRef} className={`relative w-full max-w-2xl rounded-[28px] outline-4 outline-transparent ${ring(highlight === 'pizza')}`}>
        <div
          ref={barRef}
          role="group"
          aria-label="Pizza para repartir entre 4. Tocá la pizza para agregar un corte."
          aria-describedby="share-bar-help"
          onClick={(e) => !disabled && commitCuts([...state.cuts, posFromEvent(e.clientX)], true)}
          className="relative aspect-[5/2] w-full cursor-crosshair select-none"
          style={{ touchAction: 'manipulation' }}
        >
          <PizzaArt className="absolute inset-0 size-full" />
          {/* Piece overlays: culprit tint, Leo's piece and the counting hint. */}
          {parts.map((p, k) => (
            <div
              key={`p${k}`}
              ref={(el) => {
                pieceRefs.current[k] = el
              }}
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 rounded-md ${
                culprit === k ? 'bg-red-700/45 outline-4 outline-red-800' : equal && k === 0 ? 'bg-sky-400/30 outline-4 outline-sky-600' : 'bg-white/35 opacity-0'
              } ${culprit !== k && !(equal && k === 0) ? '' : 'opacity-100'} ${highlight === 'largest' && k === largestPart(state) ? 'outline-4 outline-sky-500' : ''}`}
              style={{ left: `${starts[k] * 100}%`, width: `${p * 100}%` }}
            />
          ))}
          {state.cuts.map((c, i) => (
            <button
              key={i}
              ref={(el) => {
                cutRefs.current[i] = el
              }}
              type="button"
              role="slider"
              disabled={disabled}
              aria-label={`Corte ${i + 1}`}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(c * 100)}
              aria-valuetext={`${Math.round(c * 100)} de 100`}
              style={{ left: `${c * 100}%`, touchAction: 'none' }}
              className={`absolute -top-3 -bottom-3 w-11 -translate-x-1/2 cursor-ew-resize rounded-full outline-none focus-visible:bg-sky-500/25 ${ring(highlight === 'cuts')}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                dragging.current = i
              }}
              onPointerMove={(e) => {
                if (dragging.current === i) setCut(i, posFromEvent(e.clientX), false)
              }}
              onPointerUp={() => {
                if (dragging.current === i) commitCuts(state.cuts, true)
                dragging.current = null
              }}
              onPointerCancel={() => (dragging.current = null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  setCut(i, c - (e.shiftKey ? 5 : 1) * KEY_STEP, true)
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setCut(i, c + (e.shiftKey ? 5 : 1) * KEY_STEP, true)
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault()
                  emit({ ...state, cuts: state.cuts.filter((_, j) => j !== i) })
                }
              }}
            >
              <CutLine />
            </button>
          ))}
          {state.cuts.length === 0 && !disabled && (
            <span ref={handRef} aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 text-5xl drop-shadow">
              👆
            </span>
          )}
        </div>
        {ok && (
          <span ref={okRef} aria-hidden className="absolute -top-4 -right-3 grid size-12 place-items-center rounded-full bg-green-700 text-white shadow-lg">
            <Check className="size-8" strokeWidth={3.5} />
          </span>
        )}
      </div>

      <p id="share-bar-help" className="sr-only" aria-live="polite">
        {describe({ ...state, num: '', den: '' })} Con el teclado: enfocá un corte y usá las flechas; Suprimir lo borra.
        {equal && ' Armá la fracción de Leo: enfocá una ranura y apretá un número del 1 al 5.'}
      </p>

      {!equal && (
        <div className="flex gap-3">
          <button type="button" aria-label="Agregar corte" disabled={disabled} onClick={() => commitCuts([...state.cuts, cutAtLargest(state.cuts)], true)} className="grid size-12 place-items-center rounded-full border-2 border-amber-800 bg-white text-amber-900 shadow-sm active:scale-95 disabled:opacity-50">
            <Plus className="size-6" />
          </button>
        </div>
      )}

      {equal && (
        <fieldset className="flex flex-col items-center gap-4">
          <legend className="sr-only">¿Qué parte de toda la pizza se llevó Leo?</legend>
          <div className="flex flex-col items-center gap-2">
            {slotButton('num')}
            <span aria-hidden className="h-1.5 w-40 rounded bg-stone-900 sm:w-48" />
            {slotButton('den')}
          </div>
          <div role="group" aria-label="Fichas" className={`flex gap-2 rounded-2xl p-1 sm:gap-3 ${ring(highlight === 'tiles')}`}>
            {TILES.map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                aria-label={`Ficha ${n}`}
                onClick={(e) => pickTile(n, e)}
                className="grid size-14 place-items-center rounded-2xl border-b-4 border-amber-800 bg-amber-400 text-3xl font-black text-stone-900 shadow-md transition-transform active:translate-y-0.5 active:scale-95 disabled:opacity-50 sm:size-16"
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}

/** The knife line drops in (~150 ms) when the cut mounts. */
function CutLine() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (ref.current) knifeDown(ref.current)
  }, [])
  return <span ref={ref} aria-hidden className="mx-auto block h-full w-1.5 rounded bg-stone-900 shadow-[0_0_0_2px_#fef3c7]" />
}

export const shareBar: ExerciseDefinition<ShareBarState> = {
  id: 'fractions.share-bar',
  mode: 'manipulable',
  skills: ['fraction.equal-parts', 'fraction.notation'],
  title: 'Repartir una pizza',
  goal: 'Cortar la pizza en 4 partes iguales para repartirla entre 4 amigos y nombrar la parte de uno con una fracción.',
  prompt: 'Repartí la pizza entre 4.',
  intro: 'Tenés una pizza larga y llegan tres amigos más. Tocá la pizza para cortarla, así a los cuatro les toca lo mismo. Cuando termines, apretá «Comprobar».',
  firstBubble: '¡Tocá la pizza para cortarla!',
  answer: 'action',
  // 'cut' until the 4 parts are equal, then 'notation' (name Leo's piece).
  step: (s) => (isEqualSplit(s) ? 'notation' : 'cut'),
  canSubmit: (s) => (isEqualSplit(s) ? !!(s.num.trim() && s.den.trim()) : s.cuts.length > 0),
  localFeedback: (ev) => {
    const bad = ev.find((e) => !e.ok)
    if (!bad) return ev.some((e) => e.skill === 'fraction.notation') ? '¡Eso es!' : '¡Cuatro partes iguales!'
    if (bad.skill === 'fraction.notation') return 'Contá los pedazos de toda la pizza.'
    return /en lugar de 4/.test(bad.detail) ? 'Mmm, contá los pedazos.' : 'Fijate: ¿son todos del mismo tamaño?'
  },
  stepCopy: { notation: { prompt: '¿Qué parte se llevó Leo?', bubble: 'Armala con las fichas.' } },
  initialState: () => ({ cuts: [], num: '', den: '' }),
  describe,
  check,
  Component: ShareBar,
}
