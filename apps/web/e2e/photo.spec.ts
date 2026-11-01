import { expect, test } from '@playwright/test'
import { isTouch, register, tap } from './helpers.ts'
import { mockApi, REAL } from './mock-api.ts'

test('photo bonus mission with the sample photo', async ({ page }, info) => {
  const touch = isTouch(info)
  await mockApi(page, REAL ? { only: 'vision' } : { signedIn: true })
  if (REAL) await register(page)
  else await page.goto('/')

  await page.getByRole('button', { name: /Tu pizza: misión con foto para Tati/ }).click()
  await expect(page.getByRole('heading', { name: 'Sacale una foto a algo partido.' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tu pizza: misión extra/ })).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Probar con una foto de ejemplo' }).click()

  await expect(page.getByRole('heading', { name: '¿Son partes iguales?' })).toBeVisible({ timeout: 20_000 })
  const found = page.getByRole('group', { name: /porciones encontradas/ })
  await expect(found).toHaveAttribute('aria-label', '8 porciones encontradas')
  await page.getByRole('button', { name: 'Sí', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Tocá las que te comés.' })).toBeVisible()
  await tap(page.getByRole('button', { name: 'Porción 1', exact: true }), touch)
  await tap(page.getByRole('button', { name: 'Porción 2', exact: true }), touch)
  const tiles = page.getByRole('group', { name: 'Fichas de números' })
  await tap(tiles.getByRole('button', { name: '2', exact: true }), touch)
  await tap(tiles.getByRole('button', { name: '8', exact: true }), touch)
  await page.getByRole('button', { name: 'Comprobar' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Lo lograste!' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByLabel(/estrellas/)).toHaveAccessibleName('1 estrellas')
})
