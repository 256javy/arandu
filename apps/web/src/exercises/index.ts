import { explainCompare, explainEquivalence } from './explain'
import { numberLine } from './number-line'
import { photo } from './photo'
import { shareBar } from './share-bar'
import type { ExerciseDefinition, Mode } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyExercise = ExerciseDefinition<any>

export const EXERCISES: Record<string, AnyExercise> = Object.fromEntries(
  [shareBar, numberLine, explainCompare, explainEquivalence, photo].map((e) => [e.id, e]),
)

export const MODE_LABEL: Record<Mode, string> = {
  manipulable: 'Manipulable',
  'number-line': 'Recta numérica',
  explain: 'Explicar con palabras',
  photo: 'Foto del mundo real',
}

export const exerciseTitle = (id: string | null | undefined) => (id && EXERCISES[id]?.title) || id || ''
