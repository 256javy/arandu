import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/pizza-portions.json'
import { photo, initialPhotoState, type PhotoState } from './photo'
import { HttpError } from '@/api/client'
import {
  areaRatio, decodePortions, findPortions, keepPortions, looksEqual, merge, outline, type PhotoPortion, type SamPortions,
} from './photo-portions'

const portion = (id: string, area: number, confidence: number | null = 0.97, extra: Partial<PhotoPortion> = {}): PhotoPortion =>
  ({ id, area, path: `M0 0L1 0L1 1Z`, cx: 0, cy: 0, confidence, ...extra })
const state = (areas: number[], patch: Partial<PhotoState> = {}): PhotoState => ({
  ...initialPhotoState(),
  phase: 'eat',
  portions: areas.map((a, i) => portion(String(i), a)),
  ...patch,
})

describe('photo portions (real SAM response, pizza cut in 8)', () => {
  it('decodes the 8 one_bit masks and measures them like the Python reference', async () => {
    const ps = await decodePortions(fixture as SamPortions)
    expect(ps).toHaveLength(8)
    // Pixel counts from meta_sam_parser (docs: min/max 0.73 on this photo).
    expect(ps[0].area).toBe(53775)
    expect(areaRatio(ps)).toBeCloseTo(0.732, 2)
    expect(looksEqual(ps)).toBe(true)
    for (const p of ps) {
      expect(p.path.length).toBeLessThan(3000)
      expect(p.cx).toBeGreaterThan(0)
    }
  })
  it('simplifies outlines and moves them to the box origin', () => {
    const d = 'M0 0L5 0L10 0L10 5L10 10L5 10L0 10L0 5Z'
    expect(outline(d, 100, 200)).toBe('M100 200L110 200L110 210L100 210Z')
  })
  it('merges two portions into one', () => {
    const ps = merge([portion('a', 10), portion('b', 5), portion('c', 7)], ['a', 'c'])
    expect(ps.map((p) => [p.id, p.area])).toEqual([['a+c', 17], ['b', 5]])
  })
})

describe('portion filters', () => {
  it('drops low-confidence matches', () => {
    expect(keepPortions([portion('a', 10), portion('b', 10, 0.4), portion('c', 10, null)]).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('drops a whole-dish match that contains other matches, keeps a big real piece', () => {
    const whole = portion('w', 100, 0.8, { box: [0, 0, 100, 100], cx: 50, cy: 50 })
    const slices = [portion('a', 25, 0.97, { cx: 20, cy: 20 }), portion('b', 25, 0.97, { cx: 70, cy: 70 })]
    expect(keepPortions([whole, ...slices]).map((p) => p.id)).toEqual(['a', 'b'])
    const bar = portion('bar', 61, 0.9, { box: [200, 0, 400, 100], cx: 300, cy: 50 })
    const chunk = portion('chunk', 28, 0.9, { box: [0, 0, 100, 100], cx: 50, cy: 50 })
    expect(keepPortions([bar, chunk]).map((p) => p.id)).toEqual(['bar', 'chunk'])
  })
})

describe('photo upload retry', () => {
  const ok = () => new Response(JSON.stringify(fixture), { status: 200 })
  it('retries once on 5xx or network error, not on 4xx', async () => {
    let calls = 0
    await findPortions(new Blob(['x']), 'pizza', async () => (++calls === 1 ? new Response('', { status: 502 }) : ok()))
    expect(calls).toBe(2)
    calls = 0
    await findPortions(new Blob(['x']), undefined, async () => { if (++calls === 1) throw new TypeError('net'); return ok() })
    expect(calls).toBe(2)
    calls = 0
    await expect(findPortions(new Blob(['x']), undefined, async () => { calls++; return new Response('', { status: 429 }) }))
      .rejects.toBeInstanceOf(HttpError)
    expect(calls).toBe(1)
    calls = 0
    await expect(findPortions(new Blob(['x']), undefined, async () => { calls++; return new Response('', { status: 502 }) }))
      .rejects.toBeInstanceOf(HttpError)
    expect(calls).toBe(2)
  })
})

describe('photo check', () => {
  it('removing portions cannot fake equal parts and lowers confidence', () => {
    // SAM found 3 unequal pieces; the kid removes the big one and says "equal".
    const s = state([10, 10], { saysEqual: true, removed: [portion('big', 30)] })
    expect(photo.check(s)[0]).toMatchObject({ ok: false, confidence: 'low' })
    // Joining is legitimate: two halves of one slice become one.
    expect(photo.check(state([10, 10, 9], { saysEqual: true }))[0]).toMatchObject({ ok: true, confidence: 'high' })
  })
  it('equal-parts confidence is medium when SAM was unsure of some match', () => {
    const s = { ...state([10, 10]), saysEqual: true, portions: [portion('a', 10, 0.97), portion('b', 10, 0.7)] }
    expect(photo.check(s)[0].confidence).toBe('medium')
  })
  it('equal parts: right when the answer matches the areas (tolerance 0.7)', () => {
    expect(photo.check(state([10, 9, 8, 7.5], { saysEqual: true }))[0]).toMatchObject({ skill: 'fraction.equal-parts', ok: true, confidence: 'high' })
    expect(photo.check(state([44, 30, 26], { saysEqual: true }))[0].ok).toBe(false)
    expect(photo.check(state([44, 30, 26], { saysEqual: false }))[0].ok).toBe(true)
  })
  it('notation: k of n, only when parts look equal', () => {
    const s = state([10, 10, 10, 10], { saysEqual: true, eaten: ['0', '2'], num: '2', den: '4' })
    expect(photo.check(s)[1]).toMatchObject({ skill: 'fraction.notation', ok: true })
    expect(photo.check({ ...s, num: '1' })[1].ok).toBe(false)
    expect(photo.check(state([44, 30, 26], { saysEqual: false, eaten: ['0'], num: '1', den: '3' }))).toHaveLength(1)
  })
  it('submits only with eaten portions and a fraction', () => {
    expect(photo.canSubmit(state([1, 1], { eaten: ['0'], num: '1' }))).toBe(false)
    expect(photo.canSubmit(state([1, 1], { eaten: ['0'], num: '1', den: '2' }))).toBe(true)
    expect(photo.step!(state([1, 1], { phase: 'loading' }))).toBe('capture')
  })
  it('describes without percentages', () => {
    expect(photo.describe(state([10, 10], { saysEqual: true, eaten: ['0'] }))).not.toMatch(/%/)
  })
})
