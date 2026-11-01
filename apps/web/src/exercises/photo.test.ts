import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/pizza-portions.json'
import { photo, initialPhotoState, type PhotoState } from './photo'
import { areaRatio, decodePortions, looksEqual, merge, outline, type SamPortions } from './photo-portions'

const portion = (id: string, area: number) => ({ id, area, path: `M0 0L1 0L1 1Z`, cx: 0, cy: 0 })
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

describe('photo check', () => {
  it('equal parts: right when the answer matches the areas (tolerance 0.7)', () => {
    expect(photo.check(state([10, 9, 8, 7.5], { saysEqual: true }))[0]).toMatchObject({ skill: 'fraction.equal-parts', ok: true, confidence: 'medium' })
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
