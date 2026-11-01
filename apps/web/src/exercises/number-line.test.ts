import { describe, expect, it } from 'vitest'
import { numberLine, type NumberLineState } from './number-line'

const s = (mom: number, brother: number, choice: NumberLineState['choice']): NumberLineState => ({
  pos: { mom, brother },
  moved: { mom: true, brother: true },
  choice,
})

describe('number-line', () => {
  it('accepts correct placement and choice', () => {
    expect(numberLine.check(s(0.75, 0.67, 'mom'))[0]).toMatchObject({ skill: 'fraction.compare', ok: true })
  })
  it('reports the misplaced fraction with its error', () => {
    const [e] = numberLine.check(s(0.75, 0.8, 'brother'))
    expect(e.ok).toBe(false)
    expect(e.detail).toBe('2/3 quedó en 0,80 (error 0,13).')
  })
  it('rejects the wrong choice even when placed well', () => {
    expect(numberLine.check(s(0.75, 0.67, 'brother'))[0].ok).toBe(false)
  })
  it('treats untouched markers as not placed', () => {
    const [e] = numberLine.check(numberLine.initialState())
    expect(e.ok).toBe(false)
    expect(e.detail).toContain('sin ubicar')
  })
})
