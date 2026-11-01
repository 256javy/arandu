import type { Evidence } from '@/exercises/types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const KEY = 'arandu.learnerId'

export interface Learner { id: string; nickname: string }
export interface Mastery { skill: string; attempts: number; successes: number; mastery: number; lastDetail: string }
export interface HistoryItem { role: 'tutor' | 'kid'; text: string }
export interface TurnRequest {
  learnerId: string
  exerciseId: string
  goal: string
  stateDescription: string
  evidence: Evidence[]
  event: 'submitted' | 'stuck' | 'message'
  message?: string
  history: HistoryItem[]
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export const createLearner = (nickname: string) =>
  http<Learner>('/api/learners', { method: 'POST', body: JSON.stringify({ nickname }) })

export const getMastery = (id: string) => http<Mastery[]>(`/api/learners/${encodeURIComponent(id)}/mastery`)

export const tutorTurn = (req: TurnRequest) =>
  http<{ reply: string }>('/api/tutor/turn', { method: 'POST', body: JSON.stringify(req) })

export function getStoredLearnerId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function storeLearnerId(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable */
  }
}
