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
  visual: React.ReactNode
}

function Bar({ parts, filled, label }: { parts: number; filled: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-right text-lg font-bold">{label}</span>
      <div aria-hidden className="flex h-10 flex-1 overflow-hidden rounded-md border-4 border-amber-900">
        {Array.from({ length: parts }, (_, i) => (
          <span key={i} className={`flex-1 border-amber-900 not-last:border-r-4 ${i < filled ? 'bg-amber-800' : 'bg-amber-100'}`} />
        ))}
      </div>
    </div>
  )
}

function makeExplain(v: Variant): ExerciseDefinition<ExplainState> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function Explain(_: ExerciseProps<ExplainState>) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">{v.visual}</div>
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
  prompt: '¿2/4 o 1/2? ¿Cuál es más?',
  goal: 'Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene números más grandes. ¿Tiene razón?',
  intro: 'Tu primo dice que dos cuartos de un chocolate es más que un medio, porque tiene números más grandes. ¿Tiene razón? Explicámelo con tus palabras.',
  firstBubble: 'Contame cómo lo pensaste.',
  visual: (
    <>
      <Bar parts={4} filled={2} label="2/4" />
      <Bar parts={2} filled={1} label="1/2" />
    </>
  ),
})

export const explainCompare = makeExplain({
  id: 'fractions.explain-compare',
  skill: 'fraction.compare',
  title: '¿Qué batería dura más?',
  prompt: '¿Cuál dura más? ¿Por qué?',
  goal: 'El celular de tu mamá tiene 3/4 de batería y el de tu hermano, 2/3. ¿Cuál tiene más batería? ¿Por qué?',
  intro: 'Probemos de otra forma. El celular de tu mamá tiene tres cuartos y el de tu hermano, dos tercios. ¿Cuál tiene más batería? Contame cómo lo pensaste.',
  firstBubble: 'Contame cómo lo pensaste.',
  visual: (
    <>
      <Bar parts={4} filled={3} label="3/4" />
      <Bar parts={3} filled={2} label="2/3" />
    </>
  ),
})
