import { expect, test } from './fixtures.ts'
import { isTouch, register, tap, TURN_TIMEOUT } from './helpers.ts'
import { mockApi, REAL } from './mock-api.ts'

/** E2E_REAL_VISION=1 sends the sample photo to the real SAM endpoint (costs a call; run it once). */
const REAL_VISION = REAL && process.env.E2E_REAL_VISION === '1'

test('photo bonus mission with the sample photo', async ({ page }, info) => {
  const touch = isTouch(info)
  if (!REAL_VISION) await mockApi(page, REAL ? { only: 'vision' } : { signedIn: true })
  if (REAL) await register(page)
  else await page.goto('/')

  await page.getByRole('button', { name: /Tu pizza: misión con foto para Tati/ }).click()
  await expect(page.getByRole('heading', { name: 'Sacale una foto a algo partido.' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tu pizza: misión extra/ })).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Probar con una foto de ejemplo' }).click()

  await expect(page.getByRole('heading', { name: '¿Son partes iguales?' })).toBeVisible({ timeout: TURN_TIMEOUT })
  const found = page.getByRole('group', { name: /porciones encontradas/ })
  const n = Number((await found.getAttribute('aria-label'))!.match(/\d+/)![0])
  // the mocked answer is the recorded SAM response for the sample: 8 slices
  if (!REAL_VISION) expect(n).toBe(8)
  expect(n).toBeGreaterThanOrEqual(2)
  // answer as the photo looks (the status line describes it without judging the kid)
  const equal = /casi iguales/.test((await page.getByRole('status').filter({ hasText: /porci/ }).first().textContent()) ?? '')
  await page.getByRole('button', { name: equal ? 'Sí' : 'No', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Tocá las que te comés.' })).toBeVisible()
  await tap(page.getByRole('button', { name: 'Porción 1', exact: true }), touch)
  await tap(page.getByRole('button', { name: 'Porción 2', exact: true }), touch)
  const tiles = page.getByRole('group', { name: 'Fichas de números' })
  await tap(tiles.getByRole('button', { name: '2', exact: true }), touch)
  await tap(tiles.getByRole('button', { name: String(n), exact: true }), touch)
  await page.getByRole('button', { name: 'Comprobar' }).click()
  if (equal) {
    await expect(page.getByRole('status').filter({ hasText: '¡Lo lograste!' })).toBeVisible({ timeout: TURN_TIMEOUT })
    await expect(page.getByLabel(/estrellas/)).toHaveAccessibleName('1 estrellas')
  } else {
    // unequal slices: the fraction can't be named, the mission goes on (no celebration)
    await expect(page.getByRole('button', { name: 'Comprobar' })).toBeVisible({ timeout: TURN_TIMEOUT })
  }
})
