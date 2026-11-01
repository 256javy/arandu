import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { popIn, pulse, shake } from '@/lib/fx'
import { Diner, Egg, FlourCup, MilkCup, Pancakes } from './visuals/Kitchen'
import type { Evidence, ExerciseDefinition, ExerciseProps } from './types'

export type Ingredient = 'flour' | 'eggs' | 'milk'
export type Amounts = Record<Ingredient, number>
export const INGREDIENTS: Ingredient[] = ['flour', 'eggs', 'milk']

export interface RecipeState {
  /** Amounts for 8 people (step 'eight'). */
  eight: Amounts
  /** Amounts for 6 people (step 'six', once 'eight' is right). */
  six: Amounts
  /** The kid changed something in the 'six' step. */
  sixTouched: boolean
  /** A check confirmed the 8-people recipe: the 6-people step opens (never before, so the visual does not leak the answer). */
  eightDone: boolean
}

/** The recipe on the card: pancakes for 4 people. */
export const BASE: Amounts = { flour: 2, eggs: 4, milk: 2 }
export const BASE_PEOPLE = 4
const MAX = 12

const INFO: Record<Ingredient, { name: string; unit: [string, string]; Icon: React.ComponentType<{ className?: string }> }> = {
  flour: { name: 'Harina', unit: ['taza de harina', 'tazas de harina'], Icon: FlourCup },
  eggs: { name: 'Huevos', unit: ['huevo', 'huevos'], Icon: Egg },
  milk: { name: 'Leche', unit: ['taza de leche', 'tazas de leche'], Icon: MilkCup },
}

export const scaled = (people: number): Amounts =>
  Object.fromEntries(INGREDIENTS.map((k) => [k, (BASE[k] * people) / BASE_PEOPLE])) as Amounts

const same = (a: Amounts, b: Amounts) => INGREDIENTS.every((k) => a[k] === b[k])
export const isScaleOk = (s: Pick<RecipeState, 'eight'>) => same(s.eight, scaled(8))

/** How many people these amounts feed: the scarcest ingredient decides. */
export const feeds = (a: Amounts) => Math.floor(Math.min(...INGREDIENTS.map((k) => (a[k] / BASE[k]) * BASE_PEOPLE)))

/** Ingredients that differ from the right amount for `people`. */
export const wrongIngredients = (a: Amounts, people: number): Ingredient[] => {
  const want = scaled(people)
  return INGREDIENTS.filter((k) => a[k] !== want[k])
}

/** After a check confirms the doubled recipe, the 6-people step opens. */
export const confirmEight = (s: RecipeState): RecipeState => (!s.eightDone && isScaleOk(s) ? { ...s, eightDone: true } : s)

/**
 * Opens the 6-people step after `ms` (so the ✓ shows first), reading the latest state when it fires and
 * confirming only if it is still the right, unconfirmed 8-people recipe. Returns a cancel function.
 */
export function scheduleConfirm(latest: () => RecipeState, onChange: (s: RecipeState) => void, ms = 1200): () => void {
  const t = setTimeout(() => {
    const s = latest()
    const next = confirmEight(s)
    if (next !== s) onChange(next)
  }, ms)
  return () => clearTimeout(t)
}

/** Applies a +1/-1 to one ingredient of the active step, within 0..12. */
export function bump(s: RecipeState, k: Ingredient, delta: number): RecipeState {
  const key = s.eightDone ? 'six' : 'eight'
  const v = Math.min(MAX, Math.max(0, s[key][k] + delta))
  if (v === s[key][k]) return s
  return { ...s, [key]: { ...s[key], [k]: v }, sixTouched: s.sixTouched || key === 'six' }
}

const list = (a: Amounts) => INGREDIENTS.map((k) => `${a[k]} ${INFO[k].unit[a[k] === 1 ? 0 : 1]}`).join(', ')

/** Live text for screen readers: the same as the visual (amounts and how many people they feed), no verdict. */
export function describeAmounts(s: RecipeState): string {
  const people = s.eightDone ? 6 : 8
  const a = s.eightDone ? s.six : s.eight
  return `Receta para 4: ${list(BASE)}. Para ${people} personas tenés ${list(a)}; alcanza para ${Math.min(people, feeds(a))} de ${people}.`
}

/** Full description for the LLM (includes whether it is the same recipe). */
function describe(s: RecipeState): string {
  let text = `Receta de panqueques para 4 personas: ${list(BASE)}. Para 8 personas puso ${list(s.eight)}`
  const f8 = feeds(s.eight)
  text += isScaleOk(s) ? ', justo para 8.' : f8 >= 8 ? ', que alcanza para 8 pero no es la misma receta (algo sobra).' : `, que alcanza solo para ${f8}.`
  if (s.eightDone && s.sixTouched) {
    const f6 = feeds(s.six)
    const ok6 = same(s.six, scaled(6))
    text += ` Para 6 personas puso ${list(s.six)}${ok6 ? ', justo para 6.' : f6 >= 6 ? ', que alcanza pero no es la misma receta (algo sobra).' : `, que alcanza solo para ${f6}.`}`
  }
  return text
}

function detailFor(a: Amounts, people: number): string {
  const wrong = wrongIngredients(a, people)
  if (!wrong.length) return `Ajustó bien los tres ingredientes para ${people} personas.`
  const want = scaled(people)
  return `Para ${people}: ` + wrong.map((k) => `${INFO[k].name.toLowerCase()} ${a[k]} (va ${want[k]})`).join('; ') + '.'
}

function check(s: RecipeState): Evidence[] {
  const ok = isScaleOk(s)
  const evidence: Evidence[] = [{ skill: 'proportion.scale', ok, confidence: 'high', detail: detailFor(s.eight, 8) }]
  if (ok && s.sixTouched) {
    evidence.push({ skill: 'proportion.unit-rate', ok: same(s.six, scaled(6)), confidence: 'high', detail: detailFor(s.six, 6) })
  }
  return evidence
}

function Recipe({ state, onChange, disabled, feedback, highlight }: ExerciseProps<RecipeState>) {
  const six = state.eightDone
  const people = six ? 6 : 8
  const amounts = six ? state.six : state.eight
  const fed = Math.min(people, feeds(amounts))
  const cardRefs = useRef<Record<Ingredient, HTMLDivElement | null>>({ flour: null, eggs: null, milk: null })
  const dinersRef = useRef<HTMLDivElement>(null)
  const okRef = useRef<HTMLSpanElement>(null)
  const [bad, setBad] = useState<Ingredient[]>([])
  const [ok, setOk] = useState(false)
  const [seen, setSeen] = useState(state)
  if (seen !== state) {
    setSeen(state)
    setBad([])
    setOk(false)
  }
  // Latest state for the delayed step confirmation; any edit cancels a pending one.
  const stateRef = useRef(state)
  const confirmTimer = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (stateRef.current !== state) {
      confirmTimer.current?.()
      confirmTimer.current = null
    }
    stateRef.current = state
  }, [state])
  useEffect(() => () => confirmTimer.current?.(), [])

  useEffect(() => {
    if (!feedback) return
    const last = feedback.evidence[feedback.evidence.length - 1]
    if (feedback.evidence.every((e) => e.ok)) {
      setOk(true)
      requestAnimationFrame(() => {
        if (okRef.current) popIn(okRef.current)
        if (dinersRef.current) pulse(dinersRef.current)
      })
      // the 8-people recipe is confirmed: after the ✓ shows, open the 6-people step
      if (!state.eightDone && isScaleOk(state)) {
        confirmTimer.current?.()
        confirmTimer.current = scheduleConfirm(() => stateRef.current, onChange)
      }
      return
    }
    const wrong = last.skill === 'proportion.unit-rate' ? wrongIngredients(state.six, 6) : wrongIngredients(state.eight, 8)
    setBad(wrong)
    requestAnimationFrame(() => wrong.forEach((k) => cardRefs.current[k] && shake(cardRefs.current[k]!)))
    // Only react to a new check result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.at])

  const ring = (id: string) => (highlight === id ? 'ring-4 ring-sky-500 ring-offset-2' : '')

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Recipe card: for 4 people (and, in the second step, the 8-people version already solved). */}
      <div className={`flex flex-wrap justify-center gap-2 ${ring('recipe')}`}>
        <RecipeCard people={4} amounts={BASE} />
        {six && <RecipeCard people={8} amounts={state.eight} />}
      </div>

      {/* Diners: who gets pancakes with these amounts. */}
      <div ref={dinersRef} aria-hidden className={`relative flex max-w-md flex-wrap justify-center gap-1 rounded-2xl bg-white/70 px-3 py-2 ${ring('diners')}`}>
        {Array.from({ length: people }, (_, i) => (
          <Diner key={`${people}-${i}`} i={i} fed={i < fed} className="h-12 w-9 sm:h-14 sm:w-11" />
        ))}
        {ok && (
          <span ref={okRef} className="absolute -top-4 -right-4 grid size-11 place-items-center rounded-full bg-green-700 text-white shadow-lg">
            <Check className="size-7" strokeWidth={3.5} />
          </span>
        )}
      </div>

      {/* Ingredient cards with +/- and a stack of units. */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-2 sm:gap-4">
        {INGREDIENTS.map((k) => {
          const { name, unit, Icon } = INFO[k]
          const n = amounts[k]
          const isBad = bad.includes(k)
          return (
            <div
              key={k}
              ref={(el) => {
                cardRefs.current[k] = el
              }}
              role="group"
              aria-label={`${name}: ${n} ${unit[n === 1 ? 0 : 1]}`}
              className={`flex flex-col items-center gap-2 rounded-2xl border-4 bg-white p-2 outline-2 outline-transparent ${isBad ? 'border-red-700 bg-red-50' : 'border-amber-200'} ${ring(k)}`}
            >
              <div aria-hidden className="grid min-h-28 w-full grid-cols-3 content-end justify-items-center gap-0.5 sm:min-h-32 sm:grid-cols-4">
                {Array.from({ length: n }, (_, i) => (
                  <Unit key={i} Icon={Icon} />
                ))}
              </div>
              <span aria-hidden className="text-3xl font-black text-stone-900">{n}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Menos ${name.toLowerCase()}`}
                  disabled={disabled || n === 0}
                  onClick={() => onChange(bump(state, k, -1))}
                  className="grid size-11 place-items-center rounded-full border-2 border-stone-500 bg-white text-stone-800 active:scale-95 disabled:opacity-40"
                >
                  <Minus className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={`Más ${name.toLowerCase()}`}
                  disabled={disabled || n === MAX}
                  onClick={() => onChange(bump(state, k, +1))}
                  className="grid size-11 place-items-center rounded-full border-b-4 border-amber-800 bg-amber-400 text-stone-900 active:scale-95 disabled:opacity-40"
                >
                  <Plus className="size-5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {describeAmounts(state)} Con el teclado: usá Tab hasta los botones Más y Menos de cada ingrediente.
      </p>
    </div>
  )
}

/** One unit (cup or egg) that pops in when added. */
function Unit({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (ref.current) popIn(ref.current)
  }, [])
  return (
    <span ref={ref} className="block">
      <Icon className="size-7 sm:size-8" />
    </span>
  )
}

function RecipeCard({ people, amounts }: { people: number; amounts: Amounts }) {
  return (
    <div aria-hidden className="flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-700 bg-amber-50 px-3 py-1.5 text-lg font-bold text-stone-900">
      <Pancakes className="h-6 w-10" />
      <span className="flex items-center gap-0.5">{people}<Diner i={0} fed className="h-7 w-5" /></span>
      <span className="text-stone-500">→</span>
      {INGREDIENTS.map((k) => {
        const Icon = INFO[k].Icon
        return (
          <span key={k} className="flex items-center gap-0.5">
            {amounts[k]}
            <Icon className="size-6" />
          </span>
        )
      })}
    </div>
  )
}

export const recipe: ExerciseDefinition<RecipeState> = {
  id: 'proportions.recipe',
  mode: 'manipulable',
  skills: ['proportion.scale', 'proportion.unit-rate'],
  title: 'Panqueques para todos',
  goal: 'Ajustar una receta para 4 personas a 8 (duplicar) y después a 6 (pasando por cuánto va para 2).',
  prompt: 'Hacé panqueques para 8.',
  intro:
    'La receta de panqueques es para 4 personas: 2 tazas de harina, 4 huevos y 2 tazas de leche. Vienen 8 amigos. Tocá más o menos en cada ingrediente para que alcance justo para 8, y después apretá «Comprobar».',
  firstBubble: '¡Tocá + para sumar!',
  answer: 'action',
  // 'eight' until a check confirms the doubled recipe, then 'six'.
  step: (s) => (s.eightDone ? 'six' : 'eight'),
  stepCopy: { six: { prompt: '¿Y para 6?', bubble: 'Pensá cuánto va para 2.' } },
  canSubmit: (s) => (s.eightDone ? s.sixTouched : !same(s.eight, BASE)),
  localFeedback: (ev) => {
    const bad = ev.find((e) => !e.ok)
    if (!bad) return ev.length > 1 ? '¡Justo para 6!' : '¡Alcanza para 8!'
    return bad.skill === 'proportion.unit-rate' ? 'Pensá cuánto va para 2 personas.' : 'Mirá: ¿es la misma receta para todos?'
  },
  initialState: () => ({ eight: { ...BASE }, six: { ...BASE }, sixTouched: false, eightDone: false }),
  describe,
  check,
  Component: Recipe,
}
