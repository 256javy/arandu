import { Button } from '@/components/ui/button'
import type { ExerciseDefinition, ExerciseProps } from './types'

export interface ExplainState {
  text: string
}

interface Variant {
  id: string
  skill: string
  title: string
  prompt: string
  intro: string
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
  function Explain({ state, onChange, onSubmit, disabled }: ExerciseProps<ExplainState>) {
    const id = `${v.id}-answer`
    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (state.text.trim()) onSubmit(state.text.trim())
        }}
      >
        <p className="text-lg">{v.prompt}</p>
        <div className="flex flex-col gap-2">{v.visual}</div>
        <label htmlFor={id} className="font-semibold">Explicalo con tus palabras</label>
        <textarea
          id={id}
          rows={4}
          maxLength={600}
          value={state.text}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Yo creo que… porque…"
          className="rounded-lg border-2 border-border bg-card p-3 text-base"
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Musi lee tu explicación; no hay una sola forma correcta de decirlo.</p>
          <Button type="submit" size="lg" className="ml-auto" disabled={disabled || !state.text.trim()}>Listo</Button>
        </div>
      </form>
    )
  }
  return {
    id: v.id,
    mode: 'explain',
    skills: [v.skill],
    title: v.title,
    goal: v.prompt,
    intro: v.intro,
    initialState: () => ({ text: '' }),
    describe: (s) => (s.text.trim() ? `Escribió esta explicación: «${s.text.trim()}»` : 'Todavía no escribió nada.'),
    // Open-ended: the API judges the explanation with the LLM (medium confidence).
    check: () => [],
    Component: Explain,
  }
}

export const explainEquivalence = makeExplain({
  id: 'fractions.explain-equivalence',
  skill: 'fraction.equivalence',
  title: '¿2/4 o 1/2?',
  prompt: 'Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene números más grandes. ¿Tiene razón?',
  intro: 'Tu primo dice que dos cuartos de un chocolate es más que un medio, porque tiene números más grandes. ¿Tiene razón? Explicámelo con tus palabras.',
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
  prompt: 'El celular de tu mamá tiene 3/4 de batería y el de tu hermano, 2/3. ¿Cuál tiene más batería? ¿Por qué?',
  intro: 'Probemos de otra forma. El celular de tu mamá tiene tres cuartos y el de tu hermano, dos tercios. ¿Cuál tiene más batería? Contame cómo lo pensaste.',
  visual: (
    <>
      <Bar parts={4} filled={3} label="3/4" />
      <Bar parts={3} filled={2} label="2/3" />
    </>
  ),
})
