import { useEffect, useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { HttpError } from '@/api/client'
import {
  allConfident,
  decodePortions,
  findPortions,
  keepPortions,
  looksEqual,
  merge,
  prepareImage,
  type Hint,
  type PhotoPortion,
} from './photo-portions'
import type { Evidence, ExerciseDefinition, ExerciseProps } from './types'

export type PhotoPhase = 'capture' | 'loading' | 'confirm' | 'eat'

export interface PhotoState {
  phase: PhotoPhase
  /** What the photo shows, chosen before taking it; steers SAM's prompt. */
  hint: Hint | null
  /** Object URL of the downscaled photo: lives only in this tab's memory. */
  image: string | null
  width: number
  height: number
  /** Current portions: SAM's matches after the kid's joins and removals. */
  portions: PhotoPortion[]
  /** Portions the kid removed. They still count for "equal parts", so removing can't fake equality. */
  removed: PhotoPortion[]
  /** Confirm step: portions picked to join or remove. */
  selected: string[]
  /** The kid's answer to "are they equal parts?". */
  saysEqual: boolean | null
  eaten: string[]
  num: string
  den: string
  slot: 'num' | 'den'
  error: string | null
}

export const SAMPLE_PHOTO = '/samples/pizza.jpg'

export const HINTS: { id: Hint; emoji: string; label: string }[] = [
  { id: 'pizza', emoji: '🍕', label: 'Pizza' },
  { id: 'chocolate', emoji: '🍫', label: 'Chocolate' },
  { id: 'cake', emoji: '🎂', label: 'Torta' },
]

const COLORS = ['#f59e0b', '#14b8a6', '#8b5cf6', '#fb7185', '#22c55e', '#0ea5e9', '#eab308', '#ec4899', '#f97316', '#6366f1']

export const initialPhotoState = (): PhotoState => ({
  phase: 'capture', hint: null, image: null, width: 0, height: 0, portions: [], removed: [], selected: [],
  saysEqual: null, eaten: [], num: '', den: '', slot: 'num', error: null,
})

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

/** Equality is judged on everything SAM found (joins applied), including what the kid removed. */
export const judgedPortions = (s: Pick<PhotoState, 'portions' | 'removed'>) => [...s.portions, ...s.removed]

function describe(s: PhotoState): string {
  const n = s.portions.length
  if (s.phase === 'capture' || s.phase === 'loading') return 'Todavía no hay foto.'
  let text = `Sacó una foto con ${n} ${n === 1 ? 'porción' : 'porciones'}`
  text += looksEqual(judgedPortions(s)) ? ', que parecen casi iguales.' : ', de tamaños bastante distintos.'
  if (s.removed.length) text += ` Quitó ${s.removed.length} que no eran porciones.`
  if (s.saysEqual !== null) text += s.saysEqual ? ' Dijo que son partes iguales.' : ' Dijo que no son partes iguales.'
  if (s.eaten.length) text += ` Eligió ${s.eaten.length} para comer.`
  if (s.num || s.den) text += ` Escribió ${s.num || '?'}/${s.den || '?'}.`
  return text
}

function check(s: PhotoState): Evidence[] {
  const n = s.portions.length
  const judged = judgedPortions(s)
  const equal = looksEqual(judged)
  const evidence: Evidence[] = []
  if (s.saysEqual !== null) {
    const ok = s.saysEqual === equal
    evidence.push({
      skill: 'fraction.equal-parts',
      ok,
      // After removals the photo's verdict is shaky; otherwise trust it as much as SAM trusts every match.
      confidence: s.removed.length ? 'low' : allConfident(judged) ? 'high' : 'medium',
      detail: `Foto con ${n} porciones ${equal ? 'casi iguales' : 'distintas'}; dijo que ${s.saysEqual ? '' : 'no '}son iguales.`,
    })
  }
  if (equal && s.eaten.length && s.num.trim() && s.den.trim()) {
    const k = s.eaten.length
    const named = Number(s.num) === k && Number(s.den) === n
    evidence.push({
      skill: 'fraction.notation',
      ok: named,
      confidence: 'high',
      detail: named ? `Escribió ${k}/${n} para ${k} de ${n} porciones de su foto.` : `Escribió ${s.num}/${s.den} para ${k} de ${n} porciones de su foto.`,
    })
  }
  return evidence
}

function errorText(e: unknown): string {
  if (e instanceof HttpError && e.status === 429) return 'Muchas fotos por ahora. Probá más tarde.'
  if (e instanceof HttpError && (e.status === 413 || e.status === 415)) return 'Esa foto no sirve. Probá con otra.'
  return 'No pude mirar la foto. Probá de nuevo.'
}

function Photo({ state, onChange, disabled }: ExerciseProps<PhotoState>) {
  const latest = useRef(state)
  useLayoutEffect(() => {
    latest.current = state
  }, [state])
  // Async steps (upload, decode) patch the freshest state, not the one captured at click time.
  const set = (patch: Partial<PhotoState>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    onChange(next)
  }

  useEffect(() => () => {
    if (latest.current.image) URL.revokeObjectURL(latest.current.image)
  }, [])

  const reset = (patch: Partial<PhotoState> = {}) => {
    if (latest.current.image) URL.revokeObjectURL(latest.current.image)
    set({ ...initialPhotoState(), hint: latest.current.hint, ...patch })
  }

  async function analyze(source: Blob, hint: Hint | null) {
    reset({ phase: 'loading', hint })
    try {
      const blob = await prepareImage(source)
      const image = URL.createObjectURL(blob)
      const bmp = await createImageBitmap(blob)
      set({ image, width: bmp.width, height: bmp.height })
      bmp.close()
      const res = await findPortions(blob, hint ?? undefined)
      const portions = keepPortions(await decodePortions(res))
      if (portions.length < 2) {
        set({ phase: 'capture', portions: [], error: 'Probá con otra foto, desde arriba.' })
        return
      }
      set({ phase: 'confirm', portions, width: res.width ?? latest.current.width, height: res.height ?? latest.current.height })
    } catch (e) {
      set({ phase: 'capture', error: errorText(e) })
    }
  }

  const trySample = async () => {
    try {
      const res = await fetch(SAMPLE_PHOTO)
      if (!res.ok) throw new HttpError(res.status)
      await analyze(await res.blob(), 'pizza')
    } catch {
      set({ phase: 'capture', error: 'No pude abrir la foto de ejemplo.' })
    }
  }

  const tap = (id: string) => {
    if (disabled) return
    if (state.phase === 'confirm') set({ selected: toggle(state.selected, id) })
    else if (state.phase === 'eat') set({ eaten: toggle(state.eaten, id) })
  }

  const n = state.portions.length
  const chips = Array.from({ length: Math.max(8, n) }, (_, i) => String(i + 1))

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes photo-pop { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: scale(1) } }
        .photo-portion { transform-box: fill-box; transform-origin: center; animation: photo-pop 420ms cubic-bezier(.34,1.56,.64,1) both }
        @media (prefers-reduced-motion: reduce) { .photo-portion { animation: none } }
        .photo-focus { display: none; stroke: #000; stroke-width: 5px; vector-effect: non-scaling-stroke }
        .photo-portion:focus-visible > path:first-child { stroke: #fff; stroke-width: 12px; vector-effect: non-scaling-stroke }
        .photo-portion:focus-visible > .photo-focus { display: inline }
      `}</style>

      {state.image ? (
        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border-4 border-amber-700">
          <img src={state.image} alt={n ? `Tu foto, con ${n} ${n === 1 ? 'porción marcada' : 'porciones marcadas'}` : 'Tu foto'} className="block w-full" />
          {state.phase === 'loading' && (
            <div aria-hidden className="absolute inset-0 grid place-items-center bg-black/30 text-lg font-semibold text-white">
              Buscando porciones…
            </div>
          )}
          {n > 0 && (
            <svg
              viewBox={`0 0 ${state.width} ${state.height}`}
              className="absolute inset-0 h-full w-full"
              role="group"
              aria-label={`${n} porciones encontradas`}
            >
              {state.portions.map((p, i) => {
                const picked = state.phase === 'confirm' ? state.selected.includes(p.id) : state.eaten.includes(p.id)
                const label = `Porción ${i + 1}${picked ? (state.phase === 'eat' ? ', te la comés' : ', marcada') : ''}`
                return (
                  <g
                    key={p.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={label}
                    aria-pressed={picked}
                    onClick={() => tap(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        tap(p.id)
                      }
                    }}
                    className="photo-portion cursor-pointer outline-none"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <path
                      d={p.path}
                      fillRule="evenodd"
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={picked ? 0.75 : 0.35}
                      stroke={picked ? '#fff' : COLORS[i % COLORS.length]}
                      strokeWidth={picked ? 6 : 3}
                    />
                    {/* Focus ring: wide white under narrow black, visible on any photo. */}
                    <path d={p.path} fill="none" className="photo-focus" aria-hidden />
                    {state.phase === 'eat' && picked && (
                      <text x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(28, state.width / 25)} aria-hidden>
                        😋
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-xl border-4 border-dashed border-amber-700 bg-amber-50 text-6xl" aria-hidden>
          🍕📷
        </div>
      )}

      {state.error && (
        <p aria-hidden className="rounded-lg bg-amber-100 p-3 text-center text-lg font-semibold text-amber-900">
          {state.error}
        </p>
      )}

      {state.phase === 'capture' && (
        <div className="flex flex-wrap justify-center gap-3" role="radiogroup" aria-label="¿Qué vas a fotografiar?">
          {HINTS.map((h) => (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={state.hint === h.id}
              aria-label={h.label}
              disabled={disabled}
              onClick={() => set({ hint: state.hint === h.id ? null : h.id })}
              className={`grid size-20 place-items-center rounded-2xl border-4 text-5xl transition focus-visible:ring-4 focus-visible:ring-black focus-visible:outline-none ${state.hint === h.id ? 'border-primary bg-primary/15 ring-2 ring-primary' : 'border-border bg-card'}`}
            >
              <span aria-hidden>{h.emoji}</span>
            </button>
          ))}
        </div>
      )}

      {state.phase === 'capture' && (
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" disabled={disabled}>
            <label className="cursor-pointer has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-black">
              📷 Sacar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void analyze(f, state.hint)
                }}
              />
            </label>
          </Button>
          <Button size="lg" variant="outline" onClick={() => void trySample()} disabled={disabled}>
            Probar con una foto de ejemplo
          </Button>
        </div>
      )}

      {state.phase === 'confirm' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              disabled={disabled || state.selected.length < 2}
              onClick={() => set({ portions: merge(state.portions, state.selected), selected: [] })}
            >
              Unir
            </Button>
            <Button
              variant="outline"
              disabled={disabled || state.selected.length === 0 || n - state.selected.length < 2}
              onClick={() => set({
                portions: state.portions.filter((p) => !state.selected.includes(p.id)),
                removed: [...state.removed, ...state.portions.filter((p) => state.selected.includes(p.id))],
                selected: [],
              })}
            >
              Quitar
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={() => reset()}>
              Otra foto
            </Button>
          </div>
          <p className="text-xl font-semibold" id="photo-equal-q">¿Son partes iguales?</p>
          <div className="flex gap-3" role="group" aria-labelledby="photo-equal-q">
            <Button size="lg" disabled={disabled} onClick={() => set({ saysEqual: true, selected: [], phase: 'eat' })}>
              Sí
            </Button>
            <Button size="lg" variant="secondary" disabled={disabled} onClick={() => set({ saysEqual: false, selected: [], phase: 'eat' })}>
              No
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'eat' && (
        <fieldset className="flex flex-col items-center gap-3 rounded-lg bg-muted p-3">
          <legend className="sr-only">Fracción que te comés</legend>
          <div className="flex items-center gap-4">
            <span className="inline-flex flex-col items-center gap-1">
              {(['num', 'den'] as const).map((slot, i) => (
                <span key={slot} className="contents">
                  {i === 1 && <span aria-hidden className="h-1 w-16 rounded bg-foreground" />}
                  <button
                    type="button"
                    aria-label={slot === 'num' ? `Numerador: ${state.num || 'vacío'}` : `Denominador: ${state.den || 'vacío'}`}
                    aria-pressed={state.slot === slot}
                    disabled={disabled}
                    onClick={() => set({ slot })}
                    className={`h-14 w-16 rounded-lg border-2 bg-card text-center text-2xl font-bold ${state.slot === slot ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                  >
                    {state[slot] || '·'}
                  </button>
                </span>
              ))}
            </span>
          </div>
          <div className="flex max-w-sm flex-wrap justify-center gap-2" role="group" aria-label="Fichas de números">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => set({ [state.slot]: c, slot: state.slot === 'num' ? 'den' : 'num' })}
                className="size-12 rounded-full border-2 border-amber-700 bg-amber-200 text-lg font-bold hover:bg-amber-300"
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {/* Always mounted so screen readers announce loading, errors and progress. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state.phase === 'loading' ? 'Buscando porciones…' : state.error ?? describe(state)}
      </p>
    </div>
  )
}

export const photo: ExerciseDefinition<PhotoState> = {
  id: 'fractions.photo',
  mode: 'photo',
  skills: ['fraction.equal-parts', 'fraction.notation'],
  title: 'Tu pizza en fracciones',
  goal: 'Con una foto real de comida partida, decidir si las porciones son iguales y nombrar con una fracción las que se come.',
  prompt: 'Sacale una foto a algo partido.',
  intro:
    'Sacale una foto, desde arriba, a una pizza, un chocolate o una torta partida. Arandu marca las porciones. Decí si son partes iguales, tocá las que te comés y armá la fracción. La foto no se guarda.',
  firstBubble: '¡Mostrame tu comida partida!',
  answer: 'action',
  step: (s) => (s.phase === 'loading' ? 'capture' : s.phase),
  stepCopy: {
    confirm: { prompt: '¿Son partes iguales?', bubble: 'Tocá dos para unirlas si me equivoqué.' },
    eat: { prompt: 'Tocá las que te comés.', bubble: '¿Qué fracción te comiste?' },
  },
  canSubmit: (s) => s.phase === 'eat' && s.eaten.length > 0 && !!s.num && !!s.den,
  localFeedback: (ev) => {
    const bad = ev.find((e) => !e.ok)
    if (!bad) return '¡Eso es!'
    return bad.skill === 'fraction.notation' ? 'Casi. Contá las porciones de nuevo.' : 'Mirá bien los tamaños.'
  },
  initialState: initialPhotoState,
  describe,
  check,
  Component: Photo,
}
