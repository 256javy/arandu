import type { HistoryItem, Plan, TurnRequest } from '@/api/client'
import type { Evidence } from '@/exercises/types'
import type { MusiMood } from '@/musi/MusiCharacter'

/**
 * Pure state machine for one mission screen.
 * working → (check) → checking → (api) → waiting → working | done | switch
 *                                         ↘ error → (retry) → waiting
 */
export type Phase = 'working' | 'checking' | 'waiting' | 'error' | 'done' | 'switch'

export interface MissionState {
  phase: Phase
  mood: MusiMood
  /** The one sentence Musi is saying right now. */
  bubble: string
  /** Bumps on every new bubble, so the view can animate it. */
  bubbleKey: number
  messages: HistoryItem[]
  feedback: { evidence: Evidence[]; at: number } | null
  /** Submitted answers with some evidence that was not ok. */
  misses: number
  next: Plan | null
  lastRequest: TurnRequest | null
}

export type MissionAction =
  | { type: 'interact' }
  | { type: 'step'; bubble: string }
  | { type: 'check'; evidence: Evidence[]; bubble: string; at: number }
  | { type: 'send'; request: TurnRequest; kidText?: string }
  | { type: 'think' }
  | { type: 'reply'; reply: string; evidence: Evidence[]; next: Plan; exerciseId: string; skills: string[]; submitted: boolean }
  | { type: 'fail' }
  | { type: 'retry' }

export const COPY = {
  error: 'Se me cortó. ¿Probamos de nuevo?',
  switch: 'Probemos de otra forma.',
  done: '¡Lo lograste!',
  thinking: 'Musi está pensando',
  allDone: '¡Misiones completas! Mañana seguimos.',
}

/** Misses before Musi offers a different exercise (only if the planner already chose one). */
export const MISSES_TO_SWITCH = 2

export function initMission(intro: string, firstBubble: string): MissionState {
  return {
    phase: 'working',
    mood: 'idle',
    bubble: firstBubble,
    bubbleKey: 0,
    messages: [{ role: 'tutor', text: intro }],
    feedback: null,
    misses: 0,
    next: null,
    lastRequest: null,
  }
}

/** A mission is complete when every skill it practices has ok evidence and nothing failed. */
export function completes(evidence: Evidence[], skills: string[]): boolean {
  return evidence.length > 0 && evidence.every((e) => e.ok) && skills.every((s) => evidence.some((e) => e.skill === s))
}

const say = (s: MissionState, bubble: string, mood: MusiMood): MissionState => ({ ...s, bubble, mood, bubbleKey: s.bubbleKey + 1 })

export function missionReducer(s: MissionState, a: MissionAction): MissionState {
  switch (a.type) {
    case 'interact':
      return s.phase === 'working' && s.mood !== 'looking' ? { ...s, mood: 'looking' } : s
    case 'step':
      return s.phase === 'working' ? say(s, a.bubble, 'happy') : s
    case 'check': {
      const ok = a.evidence.length > 0 && a.evidence.every((e) => e.ok)
      return { ...say(s, a.bubble, ok ? 'happy' : 'encourage'), phase: 'checking', feedback: { evidence: a.evidence, at: a.at } }
    }
    case 'send': {
      const stuck = a.request.event === 'stuck'
      const messages = a.kidText ? [...s.messages, { role: 'kid' as const, text: a.kidText }] : s.messages
      // text answers have no local check: go straight to thinking
      const mood: MusiMood = stuck ? 'hmm' : s.phase === 'checking' ? s.mood : 'thinking'
      return { ...s, phase: s.phase === 'checking' ? 'checking' : 'waiting', mood, messages, lastRequest: a.request }
    }
    case 'think':
      return s.phase === 'checking' || s.phase === 'waiting' ? { ...s, phase: 'waiting', mood: 'thinking' } : s
    case 'reply': {
      const base = { ...s, messages: [...s.messages, { role: 'tutor' as const, text: a.reply }], next: a.next }
      if (completes(a.evidence, a.skills)) return { ...say(base, a.reply, 'cheer'), phase: 'done' }
      // progress on a multi-step mission (all ok, not complete yet) is not a miss
      const misses = a.submitted && a.evidence.some((e) => !e.ok) ? s.misses + 1 : s.misses
      if (misses >= MISSES_TO_SWITCH && a.next.exerciseId !== a.exerciseId)
        return { ...say({ ...base, misses }, COPY.switch, 'encourage'), phase: 'switch' }
      const mood: MusiMood = a.evidence.some((e) => !e.ok) ? 'encourage' : 'looking'
      return { ...say({ ...base, misses }, a.reply, mood), phase: 'working' }
    }
    case 'fail':
      return { ...say(s, COPY.error, 'hmm'), phase: 'error' }
    case 'retry':
      return s.phase === 'error' && s.lastRequest ? { ...s, phase: 'waiting', mood: 'thinking' } : s
  }
}
