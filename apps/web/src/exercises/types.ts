export type Confidence = 'high' | 'medium' | 'low'
export type Mode = 'manipulable' | 'number-line' | 'explain'
export interface Evidence { skill: string; ok: boolean; confidence: Confidence; detail: string }

export interface ExerciseProps<S> {
  state: S
  onChange(s: S): void
  /** `message` carries the kid's free-text answer in open-ended modes. */
  onSubmit(message?: string): void
  disabled?: boolean
}

export interface ExerciseDefinition<S> {
  id: string
  mode: Mode
  skills: string[]
  title: string
  goal: string
  /** Musi's opening line, spoken out loud. */
  intro: string
  initialState(): S
  describe(state: S): string // plain Spanish, for the LLM
  check(state: S): Evidence[] // deterministic when possible; empty when the LLM judges
  Component: React.ComponentType<ExerciseProps<S>>
}
