import { describe, expect, it } from 'vitest'
import { bump, confirmEight, feeds, recipe, scaled, wrongIngredients, type RecipeState } from './recipe'

const st = (eight: [number, number, number], six: [number, number, number] = [2, 4, 2], sixTouched = false, eightDone = false): RecipeState => ({
  eight: { flour: eight[0], eggs: eight[1], milk: eight[2] },
  six: { flour: six[0], eggs: six[1], milk: six[2] },
  sixTouched,
  eightDone,
})

describe('recipe', () => {
  it('scales the recipe for 4 to 8 and 6', () => {
    expect(scaled(8)).toEqual({ flour: 4, eggs: 8, milk: 4 })
    expect(scaled(6)).toEqual({ flour: 3, eggs: 6, milk: 3 })
  })
  it('feeds as many people as the scarcest ingredient allows', () => {
    expect(feeds({ flour: 4, eggs: 8, milk: 4 })).toBe(8)
    expect(feeds({ flour: 4, eggs: 5, milk: 4 })).toBe(5)
    expect(feeds({ flour: 0, eggs: 8, milk: 4 })).toBe(0)
  })
  it('checks the doubled recipe deterministically and names the wrong ingredient', () => {
    expect(recipe.check(st([4, 8, 4]))).toEqual([expect.objectContaining({ skill: 'proportion.scale', ok: true, confidence: 'high' })])
    const [e] = recipe.check(st([4, 6, 4]))
    expect(e.ok).toBe(false)
    expect(e.detail).toBe('Para 8: huevos 6 (va 8).')
    expect(wrongIngredients({ flour: 4, eggs: 6, milk: 5 }, 8)).toEqual(['eggs', 'milk'])
  })
  it('only opens the 6-people step after a check confirms 8', () => {
    expect(recipe.step!(st([4, 8, 4]))).toBe('eight')
    expect(confirmEight(st([4, 7, 4]))).toEqual(st([4, 7, 4]))
    const confirmed = confirmEight(st([4, 8, 4]))
    expect(recipe.step!(confirmed)).toBe('six')
  })
  it('bumps the active step within 0..12 and marks the 6 step as touched', () => {
    let s = st([2, 4, 2])
    s = bump(s, 'flour', +1)
    expect(s.eight.flour).toBe(3)
    expect(bump(st([0, 4, 2]), 'flour', -1).eight.flour).toBe(0)
    expect(bump(st([12, 4, 2]), 'flour', +1).eight.flour).toBe(12)
    const six = bump(st([4, 8, 4], [2, 4, 2], false, true), 'eggs', +1)
    expect(six).toMatchObject({ eight: { eggs: 8 }, six: { eggs: 5 }, sixTouched: true })
  })
  it('enables the dock: any change for 8, a touch for 6', () => {
    expect(recipe.canSubmit(recipe.initialState())).toBe(false)
    expect(recipe.canSubmit(st([3, 4, 2]))).toBe(true)
    expect(recipe.canSubmit(st([4, 8, 4], [2, 4, 2], false, true))).toBe(false)
    expect(recipe.canSubmit(st([4, 8, 4], [3, 4, 2], true, true))).toBe(true)
  })
  it('adds unit-rate evidence in the 6 step', () => {
    const ok = recipe.check(st([4, 8, 4], [3, 6, 3], true, true))
    expect(ok.map((e) => [e.skill, e.ok])).toEqual([['proportion.scale', true], ['proportion.unit-rate', true]])
    const bad = recipe.check(st([4, 8, 4], [4, 6, 3], true, true))
    expect(bad[1]).toMatchObject({ ok: false, detail: 'Para 6: harina 4 (va 3).' })
    expect(recipe.localFeedback(bad)).toBe('Pensá cuánto va para 2 personas.')
    expect(recipe.localFeedback(ok)).toBe('¡Justo para 6!')
    expect(recipe.localFeedback(recipe.check(st([4, 8, 4])))).toBe('¡Alcanza para 8!')
  })
  it('describes without percentages', () => {
    const d = recipe.describe(st([4, 6, 4]))
    expect(d).toContain('alcanza solo para 6')
    expect(d).not.toMatch(/%/)
  })
})
