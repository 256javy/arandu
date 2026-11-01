import { describe, expect, it } from 'vitest'
import { choosePhone, culprits, dropPhone, numberLine, parkPhone, type NumberLineState } from './number-line'

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

describe('number-line tray and crown', () => {
  const init = numberLine.initialState()
  it('drops a phone from the tray onto the line and parks it back', () => {
    const on = dropPhone(init, 'mom', 0.75)
    expect(on.moved.mom).toBe(true)
    expect(on.pos.mom).toBe(0.75)
    expect(dropPhone(init, 'mom', 1.4).pos.mom).toBe(1)
    const crowned = choosePhone(on, 'mom')
    expect(parkPhone(crowned, 'mom')).toMatchObject({ moved: { mom: false }, choice: null })
  })
  it('only phones on the line can be crowned', () => {
    expect(choosePhone(init, 'brother')).toBe(init)
    expect(choosePhone(dropPhone(init, 'brother', 0.6), 'brother').choice).toBe('brother')
  })
  it('enables the dock only with both phones placed and one crowned', () => {
    expect(numberLine.canSubmit(init)).toBe(false)
    const both = dropPhone(dropPhone(init, 'mom', 0.7), 'brother', 0.6)
    expect(numberLine.canSubmit(both)).toBe(false)
    expect(numberLine.canSubmit(choosePhone(both, 'brother'))).toBe(true)
  })
  it('blames misplaced phones first, then the wrong crown', () => {
    expect(culprits(init)).toEqual(['mom', 'brother'])
    expect(culprits(s(0.75, 0.9, 'mom'))).toEqual(['brother'])
    expect(culprits(s(0.75, 0.67, 'brother'))).toEqual(['brother'])
    expect(culprits(s(0.75, 0.67, 'mom'))).toEqual([])
  })
})

describe('number-line step', () => {
  it('moves to choose once both phones are on the line', () => {
    const init = numberLine.initialState()
    expect(numberLine.step!(init)).toBe('place')
    expect(numberLine.step!(dropPhone(init, 'mom', 0.7))).toBe('place')
    expect(numberLine.step!(dropPhone(dropPhone(init, 'mom', 0.7), 'brother', 0.6))).toBe('choose')
    expect(numberLine.stepCopy?.choose.bubble).toBe('¿Cuál dura más? Tocalo.')
  })
})
