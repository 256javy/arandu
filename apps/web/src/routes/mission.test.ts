import { describe, expect, it } from 'vitest'
import type { TurnRequest } from '@/api/client'
import { COPY, completes, initMission, missionReducer, type MissionAction, type MissionState } from './mission'

const req = (event: TurnRequest['event'] = 'submitted', message?: string): TurnRequest => ({
  learnerId: 'l', exerciseId: 'ex', goal: 'g', stateDescription: 'd', evidence: [], event, message, history: [],
})
const ok = (skill: string) => ({ skill, ok: true, confidence: 'high' as const, detail: '' })
const bad = (skill: string) => ({ skill, ok: false, confidence: 'high' as const, detail: '' })
const reply = (evidence: ReturnType<typeof ok>[], nextId = 'ex', submitted = true): MissionAction => ({
  type: 'reply', reply: 'r', evidence, next: { exerciseId: nextId, skill: 's', reason: 'why' }, exerciseId: 'ex', skills: ['a', 'b'], submitted,
})
const run = (s: MissionState, ...as: MissionAction[]) => as.reduce(missionReducer, s)
const start = () => initMission('intro', 'first')

describe('mission reducer', () => {
  it('starts idle with the first bubble and the intro in history', () => {
    const s = start()
    expect(s).toMatchObject({ phase: 'working', mood: 'idle', bubble: 'first' })
    expect(s.messages).toEqual([{ role: 'tutor', text: 'intro' }])
  })

  it('looks at the exercise once the kid interacts', () => {
    expect(run(start(), { type: 'interact' }).mood).toBe('looking')
  })

  it('reacts locally before the api answers, then thinks', () => {
    let s = run(start(), { type: 'check', evidence: [bad('a')], bubble: 'Mmm', at: 1 })
    expect(s).toMatchObject({ phase: 'checking', mood: 'encourage', bubble: 'Mmm', feedback: { at: 1 } })
    s = run(s, { type: 'send', request: req() })
    expect(s.mood).toBe('encourage')
    s = run(s, { type: 'think' })
    expect(s).toMatchObject({ phase: 'waiting', mood: 'thinking' })
    expect(run(start(), { type: 'check', evidence: [ok('a')], bubble: '¡Sí!', at: 1 }).mood).toBe('happy')
  })

  it('adds the kid text once and thinks right away in text mode', () => {
    const s = run(start(), { type: 'send', request: req('submitted', 'porque sí'), kidText: 'porque sí' })
    expect(s.messages.filter((m) => m.role === 'kid')).toHaveLength(1)
    expect(s).toMatchObject({ phase: 'waiting', mood: 'thinking' })
  })

  it('celebrates only when every skill of the mission is ok', () => {
    const partial = run(start(), { type: 'send', request: req() }, reply([ok('a')]))
    expect(partial).toMatchObject({ phase: 'working', misses: 0, bubble: 'r' })
    const done = run(start(), { type: 'send', request: req() }, reply([ok('a'), ok('b')]))
    expect(done).toMatchObject({ phase: 'done', mood: 'cheer', next: { exerciseId: 'ex' } })
  })

  it('offers another exercise after two misses only if the planner changed it', () => {
    const miss = reply([bad('a')], 'other')
    expect(run(start(), miss).phase).toBe('working')
    const s = run(start(), miss, miss)
    expect(s).toMatchObject({ phase: 'switch', bubble: COPY.switch })
    expect(run(start(), reply([bad('a')]), reply([bad('a')])).phase).toBe('working')
  })

  it('does not count stuck turns as misses', () => {
    const stuck = reply([], 'other', false)
    expect(run(start(), stuck, stuck, stuck).misses).toBe(0)
  })

  it('shows the error bubble and retries the same request', () => {
    const r = req()
    let s = run(start(), { type: 'send', request: r }, { type: 'fail' })
    expect(s).toMatchObject({ phase: 'error', bubble: COPY.error })
    s = run(s, { type: 'retry' })
    expect(s).toMatchObject({ phase: 'waiting', mood: 'thinking', lastRequest: r })
  })

  it('stuck makes Musi doubt', () => {
    expect(run(start(), { type: 'send', request: req('stuck') }).mood).toBe('hmm')
  })

  it('completes() needs evidence', () => {
    expect(completes([], [])).toBe(false)
  })
})
