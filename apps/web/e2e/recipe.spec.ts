import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import { isTouch, tap, waitReply } from './helpers.ts'
import { mockApi } from './mock-api.ts'


async function add(page: Page, name: string, times: number, touch: boolean) {
  for (let i = 0; i < times; i++) await tap(page.getByRole('button', { name: `Más ${name}` }), touch)
}

// The recipe is reached late in the real path, so this flow runs against the fake API only.
test('recipe: 8 wrong, 8 right, then 6 right; ↺ restarts only the 6-people step', async ({ page }, info) => {
  const touch = isTouch(info)
  await mockApi(page, { signedIn: true, forceNext: 'proportions.recipe' })
  await page.goto('/aprender')
  await expect(page.getByRole('heading', { name: 'Hacé panqueques para 8.' })).toBeVisible()
  const check = page.getByRole('button', { name: 'Comprobar' })

  // 8 wrong: only more flour
  await add(page, 'harina', 1, touch)
  await waitReply(page, () => check.click())
  await expect(page.getByRole('heading', { name: 'Hacé panqueques para 8.' })).toBeVisible()
  if (!touch) await expect(check).toBeFocused()

  // 8 right: double everything (from 3 flour, 4 eggs, 2 milk)
  await add(page, 'harina', 1, touch)
  await add(page, 'huevos', 4, touch)
  await add(page, 'leche', 2, touch)
  await check.click()
  await expect(page.getByRole('heading', { name: '¿Y para 6?' })).toBeVisible({ timeout: 15_000 })

  // a wrong try, then ↺ keeps the confirmed 8 and restarts the 6 step
  await add(page, 'leche', 3, touch)
  await page.getByRole('button', { name: 'De nuevo' }).click()
  await expect(page.getByRole('heading', { name: '¿Y para 6?' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Leche: 2 / })).toBeVisible()

  // 6 right: 3 flour, 6 eggs, 3 milk
  await add(page, 'harina', 1, touch)
  await add(page, 'huevos', 2, touch)
  await add(page, 'leche', 1, touch)
  await check.click()
  await expect(page.getByRole('status').filter({ hasText: '¡Lo lograste!' })).toBeVisible({ timeout: 20_000 })
})

test('keyboard: a phone keeps focus between tray and line', async ({ page }, info) => {
  test.skip(isTouch(info), 'keyboard only')
  await mockApi(page, { signedIn: true, forceNext: 'fractions.number-line' })
  await page.goto('/aprender')
  const mom = page.getByRole('slider', { name: /Celular de Mamá/ })
  await mom.focus()
  await page.keyboard.press('ArrowRight')
  await expect(mom).toHaveAttribute('aria-valuetext', /en 0,50/)
  await expect(mom).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(mom).toHaveAttribute('aria-valuetext', /bandeja/)
  await expect(mom).toBeFocused()
})

test('chat drawer traps focus while open', async ({ page }, info) => {
  test.skip(isTouch(info), 'keyboard only')
  await mockApi(page, { signedIn: true, forceNext: 'fractions.share-bar' })
  await page.goto('/aprender')
  await page.getByRole('button', { name: 'Ver charla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Charla con Musi' })
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab')
    await expect(dialog.locator(':focus')).toHaveCount(1)
  }
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ver charla' })).toBeFocused()
})
