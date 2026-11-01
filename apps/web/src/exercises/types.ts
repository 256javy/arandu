export type Confidence = "high" | "medium" | "low";
export interface Evidence { skill: string; ok: boolean; confidence: Confidence; detail: string }
export interface ExerciseDefinition<S> {
  id: string; skills: string[]; goal: string;
  initialState(): S;
  describe(state: S): string;         // plain Spanish, for the LLM
  check(state: S): Evidence[];        // deterministic when possible
  Component: React.ComponentType<{ state: S; onChange(s: S): void; onSubmit(): void; highlight?: string }>;
}
