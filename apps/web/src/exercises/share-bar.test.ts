import { describe, expect, it } from 'vitest'
import { clearSlot, cutAtLargest, largestPart, placeTile, shareBar, snapEqual } from './share-bar'

const s = (cuts: number[], num = '', den = '') => ({ cuts, num, den })

describe('share-bar', () => {
  it('accepts 4 equal parts', () => {
    const [e] = shareBar.check(s([0.25, 0.5, 0.75]))
    expect(e).toMatchObject({ skill: 'fraction.equal-parts', ok: true, confidence: 'high' })
  })
  it('accepts within tolerance and rejects outside', () => {
    expect(shareBar.check(s([0.27, 0.5, 0.75]))[0].ok).toBe(true)
    expect(shareBar.check(s([0.36, 0.57, 0.79]))[0].ok).toBe(false)
  })
  it('rejects wrong number of parts', () => {
    expect(shareBar.check(s([0.5]))[0].ok).toBe(false)
  })
  it('describes pieces in Spanish without percentages', () => {
    expect(shareBar.describe(s([0.36, 0.57, 0.79]))).toBe('La pizza tiene 4 pedazos, y no son todos iguales: algunos son un poco más grandes.')
    expect(shareBar.describe(s([0.25, 0.5, 0.75]))).toBe('La pizza tiene 4 pedazos, todos iguales.')
    expect(shareBar.describe(s([0.25, 0.5, 0.75]))).not.toMatch(/%/)
  })
  it('checks notation only once the parts are equal and answered', () => {
    expect(shareBar.check(s([0.25, 0.5, 0.75]))).toHaveLength(1)
    expect(shareBar.check(s([0.3, 0.5, 0.75], '1', '4'))).toHaveLength(1)
    expect(shareBar.check(s([0.25, 0.5, 0.75], '1', '4'))[1]).toMatchObject({ skill: 'fraction.notation', ok: true })
    expect(shareBar.check(s([0.25, 0.5, 0.75], '1', '3'))[1]).toMatchObject({ skill: 'fraction.notation', ok: false })
  })
})

describe('share-bar interactions', () => {
  it('snaps an almost-equal split into exact quarters, keeping cut order', () => {
    expect(snapEqual([0.74, 0.26, 0.51])).toEqual([0.75, 0.25, 0.5])
    const uneven = [0.3, 0.5, 0.8]
    expect(snapEqual(uneven)).toBe(uneven)
  })
  it('finds the largest piece and cuts it in the middle', () => {
    expect(largestPart({ cuts: [0.2, 0.4, 0.6] })).toBe(3)
    expect(cutAtLargest([])).toBe(0.5)
    expect(cutAtLargest([0.5])).toBe(0.25)
  })
  it('switches step from cut to notation when the parts become equal', () => {
    expect(shareBar.step!(s([0.3, 0.5, 0.75]))).toBe('cut')
    expect(shareBar.step!(s([0.25, 0.5, 0.75]))).toBe('notation')
  })
  it('enables the dock: any cut while cutting, both slots while naming', () => {
    expect(shareBar.canSubmit(s([]))).toBe(false)
    expect(shareBar.canSubmit(s([0.4]))).toBe(true)
    expect(shareBar.canSubmit(s([0.25, 0.5, 0.75], '1'))).toBe(false)
    expect(shareBar.canSubmit(s([0.25, 0.5, 0.75], '1', '4'))).toBe(true)
  })
  it('tiles fill the chosen slot, else the first empty one, and go back on tap', () => {
    let st = s([0.25, 0.5, 0.75])
    st = placeTile(st, 1)
    expect(st).toMatchObject({ num: '1', den: '' })
    st = placeTile(st, 4)
    expect(st).toMatchObject({ num: '1', den: '4' })
    expect(placeTile(st, 3)).toBe(st)
    expect(placeTile(st, 3, 'den')).toMatchObject({ num: '1', den: '3' })
    expect(clearSlot(st, 'num')).toMatchObject({ num: '', den: '4' })
    expect(placeTile(s([], '', ''), 2, 'den')).toMatchObject({ num: '', den: '2' })
  })
})

describe('share-bar copy', () => {
  it('picks the local feedback by culprit', () => {
    expect(shareBar.localFeedback(shareBar.check(s([0.5])))).toBe('Mmm, contá los pedazos.')
    expect(shareBar.localFeedback(shareBar.check(s([0.4, 0.5, 0.75])))).toBe('Fijate: ¿son todos del mismo tamaño?')
    expect(shareBar.localFeedback(shareBar.check(s([0.25, 0.5, 0.75])))).toBe('¡Cuatro partes iguales!')
    expect(shareBar.localFeedback(shareBar.check(s([0.25, 0.5, 0.75], '1', '3')))).toBe('Contá los pedazos de toda la pizza.')
    expect(shareBar.stepCopy?.notation.prompt).toBe('¿Qué parte se llevó Leo?')
  })
})
