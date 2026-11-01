import { describe, expect, it } from 'vitest'
import { shareBar } from './share-bar'

describe('share-bar', () => {
  it('accepts 4 equal parts', () => {
    const [e] = shareBar.check({ cuts: [0.25, 0.5, 0.75] })
    expect(e).toMatchObject({ skill: 'fraction.equal-parts', ok: true, confidence: 'high' })
  })
  it('accepts within tolerance and rejects outside', () => {
    expect(shareBar.check({ cuts: [0.27, 0.5, 0.75] })[0].ok).toBe(true)
    expect(shareBar.check({ cuts: [0.36, 0.57, 0.79] })[0].ok).toBe(false)
  })
  it('rejects wrong number of parts', () => {
    expect(shareBar.check({ cuts: [0.5] })[0].ok).toBe(false)
  })
  it('describes sizes in Spanish', () => {
    expect(shareBar.describe({ cuts: [0.36, 0.57, 0.79] })).toBe(
      'La barra tiene 4 partes de tamaños 36%, 21%, 22%, 21%.',
    )
  })
})
