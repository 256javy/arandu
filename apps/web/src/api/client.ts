import type { Evidence } from '@/exercises/types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const TOKEN_KEY = 'arandu.token'
const LEARNER_KEY = 'arandu.learnerId'

export interface Learner { id: string; nickname: string }
export interface Me { email: string; learners: Learner[] }
export type SkillStatus = 'new' | 'practicing' | 'stuck' | 'likely' | 'mastered'
export interface Mastery {
  skill: string
  label: string
  attempts: number
  successes: number
  mastery: number
  status: SkillStatus
  lastDetail: string | null
  lastExercise: string | null
  lastConfidence: Evidence['confidence'] | null
}
export interface EvidenceEntry {
  skill: string
  label: string
  ok: boolean
  confidence: Evidence['confidence']
  exercise: string
  detail: string | null
  at: string
}
export interface Plan { exerciseId: string; skill: string; reason: string }
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
export interface TurnResponse { reply: string; evidence: Evidence[]; next: Plan }

export class HttpError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export const getToken = () => read(TOKEN_KEY)
export const getStoredLearnerId = () => read(LEARNER_KEY)
export const storeLearnerId = (id: string | null) => write(LEARNER_KEY, id)

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401 && token) {
    write(TOKEN_KEY, null)
    storeLearnerId(null)
  }
  if (!res.ok) throw new HttpError(res.status)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

async function authenticate(path: string, email: string, password: string) {
  const { token } = await http<{ token: string }>(path, { method: 'POST', body: JSON.stringify({ email, password }) })
  write(TOKEN_KEY, token)
}

export const signup = (email: string, password: string) => authenticate('/api/auth/signup', email, password)
export const login = (email: string, password: string) => authenticate('/api/auth/login', email, password)

export async function logout() {
  try {
    await http<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    write(TOKEN_KEY, null)
    storeLearnerId(null)
  }
}

export const getMe = () => http<Me>('/api/me')

export const createLearner = (nickname: string) =>
  http<Learner>('/api/learners', { method: 'POST', body: JSON.stringify({ nickname }) })

export const deleteLearner = (id: string) =>
  http<void>(`/api/learners/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getMastery = (id: string) => http<Mastery[]>(`/api/learners/${encodeURIComponent(id)}/mastery`)

export const getEvidence = (id: string) => http<EvidenceEntry[]>(`/api/learners/${encodeURIComponent(id)}/evidence`)

export const getNext = (id: string) => http<Plan>(`/api/learners/${encodeURIComponent(id)}/next`)

export const tutorTurn = (req: TurnRequest) =>
  http<TurnResponse>('/api/tutor/turn', { method: 'POST', body: JSON.stringify(req) })
