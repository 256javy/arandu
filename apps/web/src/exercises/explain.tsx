import { Smartphone } from 'lucide-react'
import type { ExerciseDefinition, ExerciseProps } from './types'

/** The kid's text lives in Learn's dock (`answer: 'text'`); the visual has no state of its own. */
export type ExplainState = Record<string, never>

interface Variant {
  id: string
  skill: string
  title: string
  prompt: string
  goal: string
  intro: string
  firstBubble: string
  kind: 'phone' | 'chocolate'
  items: Item[]
}

interface Item { owner: string; fraction: string; parts: number; filled: number }

/** A phone whose battery is split in `parts` equal segments, `filled` of them charged (bottom up). */
function Phone({ owner, fraction, parts, filled }: Item) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="flex items-center gap-1 text-lg font-bold"><Smartphone aria-hidden className="size-5" /> {owner}</figcaption>
      <div
        role="img"
        aria-label={`Celular de ${owner}: ${fraction} de batería`}
        className="flex h-44 w-24 flex-col rounded-2xl border-4 border-slate-800 bg-slate-800 p-1.5 sm:h-56 sm:w-28 lg:h-64 lg:w-32"
      >
        <div className="flex flex-1 flex-col-reverse gap-1 rounded-lg bg-white p-1">
          {Array.from({ length: parts }, (_, i) => (
            <span key={i} className={`flex-1 rounded ${i < filled ? 'bg-green-600' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
      <span aria-hidden className="text-4xl font-black sm:text-5xl">{fraction}</span>
    </figure>
  )
}

/** A chocolate bar split in `parts` equal squares, `filled` of them taken. */
function Chocolate({ owner, fraction, parts, filled }: Item) {
  return (
    <figure className="flex w-full items-center gap-3">
      <figcaption className="flex w-20 shrink-0 flex-col items-center sm:w-28">
        <span className="text-lg font-bold">{owner}</span>
        <span aria-hidden className="text-3xl font-black sm:text-4xl">{fraction}</span>
      </figcaption>
      <div
        role="img"
        aria-label={`Chocolate de ${owner}: ${fraction}`}
        className="flex h-16 flex-1 overflow-hidden rounded-lg border-4 border-amber-950 sm:h-20 lg:h-24"
      >
        {Array.from({ length: parts }, (_, i) => (
          <span key={i} className={`flex-1 border-amber-950 not-last:border-r-4 ${i < filled ? 'bg-amber-800' : 'bg-amber-100'}`} />
        ))}
      </div>
    </figure>
  )
}

function makeExplain(v: Variant): ExerciseDefinition<ExplainState> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function Explain(_: ExerciseProps<ExplainState>) {
    return v.kind === 'phone' ? (
      <div className="flex items-end justify-center gap-10 py-2 sm:gap-20">
        {v.items.map((it) => <Phone key={it.owner} {...it} />)}
      </div>
    ) : (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2">
        {v.items.map((it) => <Chocolate key={it.owner} {...it} />)}
      </div>
    )
  }
  return {
    id: v.id,
    mode: 'explain',
    skills: [v.skill],
    title: v.title,
    goal: v.goal,
    prompt: v.prompt,
    intro: v.intro,
    firstBubble: v.firstBubble,
    answer: 'text',
    explainSkill: v.skill,
    canSubmit: () => true,
    // Open-ended: there is no local check, so feedback waits for Musi.
    localFeedback: () => 'Musi está leyendo…',
    initialState: () => ({}),
    describe: (_s, lastAnswer) => (lastAnswer?.trim() ? `Escribió esta explicación: «${lastAnswer.trim()}»` : 'Todavía no escribió nada.'),
    // Open-ended: the API judges the explanation with the LLM (medium confidence).
    check: () => [],
    Component: Explain,
  }
}

export const explainEquivalence = makeExplain({
  id: 'fractions.explain-equivalence',
  skill: 'fraction.equivalence',
  title: '¿2/4 o 1/2?',
  prompt: 'Tu primo dice que 2/4 es más. ¿Tiene razón?',
  goal: 'Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene números más grandes. ¿Tiene razón?',
  intro: 'Tu primo dice que dos cuartos de un chocolate es más que un medio, porque tiene números más grandes. ¿Tiene razón? Explicámelo con tus palabras.',
  firstBubble: 'Contame cómo lo pensaste.',
  kind: 'chocolate',
  items: [
    { owner: 'Tu primo', fraction: '2/4', parts: 4, filled: 2 },
    { owner: 'Vos', fraction: '1/2', parts: 2, filled: 1 },
  ],
})

export const explainCompare = makeExplain({
  id: 'fractions.explain-compare',
  skill: 'fraction.compare',
  title: '¿Qué batería dura más?',
  prompt: '¿Cuál dura más? ¿Por qué?',
  goal: 'El celular de tu mamá tiene 3/4 de batería y el de tu hermano, 2/3. ¿Cuál tiene más batería? ¿Por qué?',
  intro: 'Probemos de otra forma. El celular de tu mamá tiene tres cuartos y el de tu hermano, dos tercios. ¿Cuál tiene más batería? Contame cómo lo pensaste.',
  firstBubble: 'Contame cómo lo pensaste.',
  kind: 'phone',
  items: [
    { owner: 'Mamá', fraction: '3/4', parts: 4, filled: 3 },
    { owner: 'Tu hermano', fraction: '2/3', parts: 3, filled: 2 },
  ],
})
