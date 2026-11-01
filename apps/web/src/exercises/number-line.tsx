import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Crown, Smartphone } from 'lucide-react'
import { flyFrom, popIn, pulse, shake, tapHint } from '@/lib/fx'
import type { Evidence, ExerciseDefinition, ExerciseProps } from './types'

type Who = 'mom' | 'brother'
const WHO: Who[] = ['mom', 'brother']

export interface NumberLineState {
  pos: Record<Who, number>
  /** false = parked in the tray, off the line. */
  moved: Record<Who, boolean>
  choice: Who | null
}

export const PHONES: Record<Who, { label: string; fraction: string; value: number; color: string; fill: string }> = {
  mom: { label: 'Mamá', fraction: '3/4', value: 3 / 4, color: 'bg-teal-700', fill: '#0f766e' },
  brother: { label: 'Hermano', fraction: '2/3', value: 2 / 3, color: 'bg-purple-700', fill: '#7e22ce' },
}

const TOLERANCE = 0.04
const KEY_STEP = 0.01
/** How far (px, vertically) from the line a phone can be dropped and still land on it. */
const DROP_BAND = 110
const clamp = (n: number) => Math.min(1, Math.max(0, n))
const fmt = (n: number) => n.toFixed(2).replace('.', ',')

/** Phone lands on the line at `pos`. */
export const dropPhone = (s: NumberLineState, w: Who, pos: number): NumberLineState => ({
  ...s,
  pos: { ...s.pos, [w]: clamp(pos) },
  moved: { ...s.moved, [w]: true },
})

/** Phone goes back to the tray; a crown on it is removed. */
export const parkPhone = (s: NumberLineState, w: Who): NumberLineState => ({
  ...s,
  moved: { ...s.moved, [w]: false },
  choice: s.choice === w ? null : s.choice,
})

/** Tapping a phone on the line crowns it as "lasts longer"; phones in the tray can't be chosen. */
export const choosePhone = (s: NumberLineState, w: Who): NumberLineState => (s.moved[w] ? { ...s, choice: w } : s)

/** Phones to shake after a failed check: misplaced ones first, else the wrongly crowned one. */
export function culprits(s: NumberLineState): Who[] {
  const misplaced = WHO.filter((w) => !s.moved[w] || Math.abs(s.pos[w] - PHONES[w].value) > TOLERANCE)
  if (misplaced.length) return misplaced
  return s.choice && s.choice !== 'mom' ? [s.choice] : []
}

function where(w: Who, state: NumberLineState): string {
  const name = `${PHONES[w].fraction} (${PHONES[w].label})`
  if (!state.moved[w]) return `${name} sin mover`
  const diff = state.pos[w] - PHONES[w].value
  if (Math.abs(diff) <= TOLERANCE) return `${name} en su lugar`
  return `${name} ${diff > 0 ? 'más cerca del 1' : 'más cerca del 0'} de lo que va`
}

function describe(state: NumberLineState): string {
  const placed = WHO.map((w) => where(w, state)).join('; ')
  const choice = state.choice ? ` Eligió que dura más el de ${PHONES[state.choice].label} (${PHONES[state.choice].fraction}).` : ' Todavía no eligió cuál dura más.'
  return `Recta de 0 a 1 (batería vacía a llena). Ubicó ${placed}.${choice}`
}

/** What a screen reader hears while the kid works: positions and choice, no verdict (unlike `describe`, which goes to the LLM). */
export function announce(state: NumberLineState): string {
  const at = WHO.map((w) => `${PHONES[w].label}: ${state.moved[w] ? `en ${fmt(state.pos[w])}` : 'en la bandeja'}`).join('; ')
  return `${at}.${state.choice ? ` Elegiste a ${PHONES[state.choice].label}.` : ''}`
}

function check(state: NumberLineState): Evidence[] {
  const errors = WHO.map((w) => ({ w, err: Math.abs(state.pos[w] - PHONES[w].value) }))
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

/** Battery icon whose charge follows the phone's position on the line. */
function Battery({ level, color }: { level: number; color: string }) {
  return (
    <svg viewBox="0 0 40 20" className="h-5 w-10" aria-hidden focusable="false">
      <rect x="1" y="2" width="34" height="16" rx="3" fill="#fff" stroke="#1c1917" strokeWidth="2" />
      <rect x="36" y="7" width="3" height="6" rx="1" fill="#1c1917" />
      <rect x="3.5" y="4.5" width={29 * level} height="11" rx="1.5" fill={color} />
    </svg>
  )
}

type Drag = { w: Who; x0: number; y0: number; x: number; y: number; active: boolean }

function NumberLine({ state, onChange, disabled, feedback, highlight }: ExerciseProps<NumberLineState>) {
  const lineRef = useRef<HTMLDivElement>(null)
  const phoneRefs = useRef<Record<Who, HTMLButtonElement | null>>({ mom: null, brother: null })
  const handRef = useRef<HTMLSpanElement>(null)
  const okRef = useRef<HTMLSpanElement>(null)
  const landing = useRef<{ w: Who; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [bad, setBad] = useState<Who[]>([])
  const [ok, setOk] = useState(false)
  // Any state change (including the dock's ↺ reset) clears the last check's marks.
  const [seen, setSeen] = useState(state)
  if (seen !== state) {
    setSeen(state)
    setBad([])
    setOk(false)
  }

  const emit = (s: NumberLineState) => {
    setBad([])
    setOk(false)
    onChange(s)
  }
  // A phone moving between tray and line remounts under another parent: keep keyboard focus on it.
  const refocus = useRef<Who | null>(null)
  useLayoutEffect(() => {
    const w = refocus.current
    refocus.current = null
    if (w && document.activeElement !== phoneRefs.current[w]) phoneRefs.current[w]?.focus()
  }, [state.moved])
  const posFromX = (clientX: number) => {
    const r = lineRef.current!.getBoundingClientRect()
    return clamp((clientX - r.left) / r.width)
  }
  const nearLine = (clientY: number) => {
    const r = lineRef.current!.getBoundingClientRect()
    return Math.abs(clientY - (r.top + r.height / 2)) <= DROP_BAND
  }

  useEffect(() => {
    if (handRef.current) tapHint(handRef.current)
  }, [])

  // Landing bounce: the phone springs from where it was dropped to its slot on the line.
  useLayoutEffect(() => {
    const l = landing.current
    if (!l) return
    landing.current = null
    const el = phoneRefs.current[l.w]
    if (!el) return
    const r = el.getBoundingClientRect()
    flyFrom(el, l.x - (r.left + r.width / 2), l.y - (r.top + r.height / 2), 380)
  }, [state.pos, state.moved])

  useEffect(() => {
    if (!feedback) return
    if (feedback.evidence.every((e) => e.ok)) {
      setOk(true)
      requestAnimationFrame(() => {
        if (okRef.current) popIn(okRef.current)
        if (lineRef.current) pulse(lineRef.current)
      })
      return
    }
    const who = culprits(state)
    setBad(who)
    requestAnimationFrame(() => who.forEach((w) => phoneRefs.current[w] && shake(phoneRefs.current[w]!)))
    // Only react to a new check result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.at])

  const phone = (w: Who, ghost = false) => {
    const placed = state.moved[w]
    const level = ghost && drag ? (nearLine(drag.y) ? posFromX(drag.x) : 0) : placed ? state.pos[w] : 0
    const chosen = state.choice === w
    const isBad = bad.includes(w)
    return (
      <>
        {chosen && <Crown aria-hidden className="absolute -top-5 left-1/2 size-6 -translate-x-1/2 fill-yellow-400 text-yellow-700" />}
        <span className="flex items-center gap-1 text-sm font-bold">
          <Smartphone aria-hidden className="size-4" />
          <span aria-hidden>{PHONES[w].fraction}</span>
        </span>
        <Battery level={level} color={isBad ? '#b91c1c' : PHONES[w].fill} />
      </>
    )
  }

  const handlers = (w: Who) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      // a touch drag doesn't fire a click, so a stale flag would eat the next tap
      suppressClick.current = false
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ w, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false })
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.w !== w) return
      const active = drag.active || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6
      setDrag({ ...drag, x: e.clientX, y: e.clientY, active })
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.w !== w) return
      setDrag(null)
      if (!drag.active) {
        // A touch tap on a captured pointer may never produce a click (seen in Chrome with touch
        // emulation), so a tap chooses the phone here and the click, if it comes, is ignored.
        if (e.pointerType !== 'mouse' && state.moved[w]) {
          suppressClick.current = true
          emit(choosePhone(state, w))
        }
        return
      }
      suppressClick.current = true
      if (nearLine(e.clientY)) {
        landing.current = { w, x: e.clientX, y: e.clientY }
        emit(dropPhone(state, w, posFromX(e.clientX)))
      } else if (state.moved[w]) emit(parkPhone(state, w))
    },
    onPointerCancel: () => setDrag(null),
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      if (state.moved[w]) emit(choosePhone(state, w))
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      refocus.current = w
      const step = (e.shiftKey ? 5 : 1) * KEY_STEP
      const base = state.moved[w] ? state.pos[w] : 0.5
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        emit(dropPhone(state, w, state.moved[w] ? base - step : base))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        emit(dropPhone(state, w, state.moved[w] ? base + step : base))
      } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        emit(parkPhone(state, w))
      }
    },
  })

  const phoneButton = (w: Who, onLine: boolean) => {
    const hidden = drag?.active && drag.w === w
    return (
      <button
        key={w}
        ref={(el) => {
          phoneRefs.current[w] = el
        }}
        type="button"
        role="slider"
        disabled={disabled}
        aria-label={`Celular de ${PHONES[w].label}, ${PHONES[w].fraction} de batería${state.choice === w ? ', elegido como el que dura más' : ''}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((state.moved[w] ? state.pos[w] : 0) * 100)}
        aria-valuetext={state.moved[w] ? `en ${fmt(state.pos[w])}` : 'en la bandeja, sin ubicar'}
        aria-describedby="number-line-help"
        style={{ touchAction: 'none', ...(onLine ? { left: `${state.pos[w] * 100}%` } : {}) }}
        className={`${onLine ? `absolute -translate-x-1/2 ${w === 'mom' ? 'bottom-6' : 'top-6'}` : 'relative'} flex min-h-14 min-w-16 cursor-grab flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-white shadow-md outline-4 outline-transparent ${PHONES[w].color} ${
          state.choice === w ? 'shadow-[0_0_0_4px_#facc15,0_0_18px_#facc15]' : ''
        } ${bad.includes(w) ? 'outline-red-700' : ''} ${highlight === w ? 'ring-4 ring-sky-500 ring-offset-2' : ''} ${hidden ? 'opacity-0' : ''}`}
        {...handlers(w)}
      >
        {phone(w)}
      </button>
    )
  }

  const parked = WHO.filter((w) => !state.moved[w])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative w-full max-w-2xl px-8 pt-24 pb-24 ${highlight === 'line' ? 'rounded-2xl ring-4 ring-sky-500' : ''}`}>
        <div ref={lineRef} className="relative h-3 rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-green-400">
          {Array.from({ length: 11 }, (_, k) => (
            <span
              key={k}
              aria-hidden
              className={`absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-stone-800 ${k === 0 || k === 10 ? 'h-8 w-1' : k === 5 ? 'h-6' : 'h-4'}`}
              style={{ left: `${k * 10}%` }}
            />
          ))}
          <span aria-hidden className="absolute top-1/2 -left-7 -translate-y-1/2 text-xl font-black">0</span>
          <span aria-hidden className="absolute top-1/2 -right-7 -translate-y-1/2 text-xl font-black">1</span>
          {WHO.filter((w) => state.moved[w]).map((w) => phoneButton(w, true))}
          {ok && (
            <span ref={okRef} aria-hidden className="absolute -top-20 -right-6 grid size-12 place-items-center rounded-full bg-green-700 text-white shadow-lg">
              <Check className="size-8" strokeWidth={3.5} />
            </span>
          )}
        </div>
      </div>

      <div
        aria-hidden={parked.length === 0}
        className={`relative flex min-h-20 w-full max-w-xs items-center justify-center gap-6 rounded-2xl border-2 border-dashed border-stone-400 bg-stone-100 px-4 py-3 ${highlight === 'tray' ? 'ring-4 ring-sky-500' : ''}`}
      >
        {parked.map((w) => phoneButton(w, false))}
        {parked.length === 2 && !disabled && (
          <span ref={handRef} aria-hidden className="pointer-events-none absolute -top-4 right-2 text-4xl drop-shadow">
            👆
          </span>
        )}
      </div>

      {drag?.active && (
        <div
          aria-hidden
          className={`pointer-events-none fixed top-0 left-0 z-40 flex min-h-14 min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-white shadow-xl ${PHONES[drag.w].color}`}
          style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%) scale(1.08)` }}
        >
          {phone(drag.w, true)}
        </div>
      )}

      <p id="number-line-help" className="sr-only">
        Con el teclado: enfocá un celular y usá las flechas para ubicarlo (con Mayúsculas, pasos grandes); Escape lo devuelve a la bandeja; Enter lo elige como el que dura más.
      </p>
      {/* Neutral state only: where each phone is and which one is chosen, never whether it is right. */}
      <p className="sr-only" aria-live="polite">{announce(state)}</p>
    </div>
  )
}

export const numberLine: ExerciseDefinition<NumberLineState> = {
  id: 'fractions.number-line',
  mode: 'number-line',
  skills: ['fraction.compare'],
  title: 'La batería del celular',
  goal: 'Ubicar 3/4 y 2/3 en la recta de 0 a 1 y decidir cuál es mayor.',
  prompt: '¿Dónde va cada batería?',
  intro: 'El celular de tu mamá tiene tres cuartos de batería y el de tu hermano, dos tercios. Arrastrá cada celular desde la bandeja a su lugar en la recta y tocá el que dura más.',
  firstBubble: 'Arrastrá cada celu a su lugar.',
  answer: 'action',
  // 'place' until both phones are on the line, then 'choose' (tap the one that lasts longer).
  step: (s) => (s.moved.mom && s.moved.brother ? 'choose' : 'place'),
  stepCopy: { choose: { prompt: '¿Cuál dura más?', bubble: '¿Cuál dura más? Tocalo.' } },
  canSubmit: (s) => s.moved.mom && s.moved.brother && s.choice !== null && s.moved[s.choice],
  localFeedback: (ev) => (ev.every((e) => e.ok) ? '¡Eso es!' : 'Mirá dónde quedó cada uno.'),
  initialState: () => ({ pos: { mom: 0.05, brother: 0.05 }, moved: { mom: false, brother: false }, choice: null }),
  describe,
  check,
  Component: NumberLine,
}
