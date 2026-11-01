export type Confidence = 'high' | 'medium' | 'low'
export type Mode = 'manipulable' | 'number-line' | 'explain' | 'photo'
export interface Evidence { skill: string; ok: boolean; confidence: Confidence; detail: string }

/** The exercise only renders the visual; the single action (check/send) lives in Learn's dock. */
export interface ExerciseProps<S> {
  state: S
  onChange(s: S): void
  disabled?: boolean
  /** Local result of the last check, so the visual can animate the culprit piece. */
  feedback?: { evidence: Evidence[]; at: number } | null
  /** Part of the visual Musi points at; ids are defined by each exercise. */
  highlight?: string | null
}

export interface ExerciseDefinition<S> {
  id: string
  mode: Mode
  skills: string[]
  title: string
  goal: string
  /** On-screen task, at most ~12 words. */
  prompt: string
  /** Long text: screen readers and LLM history only. */
  intro: string
  /** Musi's first bubble: one action sentence, never repeats `prompt`. */
  firstBubble: string
  /** What the dock shows: a check button or a text field. */
  answer: 'action' | 'text'
  /** Enables the dock action. */
  canSubmit(state: S): boolean
  /** One immediate sentence after a local check, without giving the answer away. */
  localFeedback(evidence: Evidence[]): string
  /** If set, free-text replies count as evidence for this skill. */
  explainSkill?: string
  /** Multi-step missions: id of the current step (e.g. 'cut' then 'notation'), so Learn can swap prompt/bubble. */
  step?(state: S): string
  /** On-screen copy for a step other than the first one; falls back to `prompt`/`firstBubble`. */
  stepCopy?: Record<string, { prompt: string; bubble: string }>
  initialState(): S
  /** Plain Spanish for the LLM, no percentages: pieces and comparisons. `lastAnswer` is the kid's text in 'text' mode. */
  describe(state: S, lastAnswer?: string): string
  /** Deterministic when possible; empty when the LLM judges. */
  check(state: S): Evidence[]
  Component: React.ComponentType<ExerciseProps<S>>
}
