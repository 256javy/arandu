import { expect, test } from './fixtures.ts'
import { center, drag, isTouch, pointAt, register, tap, TURN_TIMEOUT, waitReply } from './helpers.ts'
import { mockApi, REAL } from './mock-api.ts'

// The real judge is an LLM: a clear reason in the kid's words, as the rubric asks. Few digits on purpose:
// the API does not quote texts with 7+ digits (they could be a phone number), and /familia checks the quote.
const REASON = 'el de mamá porque le falta menos para llenarse: a mamá le falta un cuarto y a mi hermano un tercio, que es más'

test('kid journey: pizza, notation, number line, mode switch, explain and the family view', async ({ page }, info) => {
  const touch = isTouch(info)
  await mockApi(page, REAL ? { only: 'vision' } : {})
  await register(page)
  await page.getByRole('button', { name: /^Soy Tati/ }).click()

  // Pizza: a wrong split first
  await expect(page.getByRole('heading', { name: 'Repartí la pizza entre 4.' })).toBeVisible()
  const pizza = page.getByRole('group', { name: /Pizza para repartir/ })
  for (const x of [0.15, 0.45, 0.8]) await pointAt(page, pizza, x, 0.5, touch)
  const check = page.getByRole('button', { name: 'Comprobar' })
  await expect(check).toBeInViewport()
  await waitReply(page, () => check.click())

  // then right: four equal parts, and the notation step with tiles
  await page.getByRole('button', { name: 'De nuevo' }).click()
  for (const x of [0.25, 0.5, 0.75]) await pointAt(page, pizza, x, 0.5, touch)
  await expect(page.getByRole('heading', { name: '¿Qué parte se llevó Leo?' })).toBeVisible()
  await tap(page.getByRole('button', { name: 'Ficha 1' }), touch)
  await tap(page.getByRole('button', { name: 'Ficha 4' }), touch)
  await check.click()
  await expect(page.getByRole('status').filter({ hasText: '¡Lo lograste!' })).toBeVisible({ timeout: TURN_TIMEOUT })
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Number line: drag both phones (touch on phones), choose the wrong one, miss twice
  await expect(page.getByRole('heading', { name: '¿Dónde va cada batería?' })).toBeVisible()
  const line = page.locator('div.bg-gradient-to-r').first()
  const lb = (await line.boundingBox())!
  const mom = page.getByRole('slider', { name: /Celular de Mamá/ })
  const brother = page.getByRole('slider', { name: /Celular de Hermano|Celular de tu hermano/i })
  await drag(page, await center(mom), { x: lb.x + lb.width * 0.3, y: lb.y + lb.height / 2 }, touch)
  await drag(page, await center(brother), { x: lb.x + lb.width * 0.9, y: lb.y + lb.height / 2 }, touch)
  await expect(page.getByRole('heading', { name: '¿Cuál dura más?' })).toBeVisible()
  await tap(brother, touch)
  await expect(brother).toHaveAccessibleName(/elegido como el que dura más/)
  await expect(check).toBeEnabled()
  await waitReply(page, () => check.click())
  await expect(check).toBeEnabled()
  await check.click()

  // the planner switches mode after two misses
  await expect(page.getByRole('button', { name: 'Probar otra' })).toBeVisible({ timeout: TURN_TIMEOUT })
  await page.getByRole('button', { name: 'Probar otra' }).click()

  // Explain: no reason first, Musi asks again, then with a reason
  await expect(page.getByRole('heading', { name: '¿Cuál dura más? ¿Por qué?' })).toBeVisible()
  const answer = page.getByLabel('Tu respuesta')
  await answer.fill('el de mamá')
  await waitReply(page, () => page.getByRole('button', { name: 'Enviar' }).click())
  await expect(answer).toBeFocused()
  await answer.fill(REASON)
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Lo lograste!' })).toBeVisible({ timeout: TURN_TIMEOUT })

  // the whole conversation is in the drawer, the kid's text once per answer
  await page.getByRole('button', { name: 'Ver charla' }).click()
  const log = page.getByRole('log')
  await expect(log.locator('li').filter({ hasText: /^Vos: el de mamá$/ })).toHaveCount(1)
  await expect(log.locator('li').filter({ hasText: /^Vos: el de mamá porque/ })).toHaveCount(1)
  await page.getByRole('button', { name: 'Cerrar' }).click()

  // Family: the evidence is there
  await page.goto('/familia')
  const recent = page.locator('ol').filter({ hasText: '¿Qué batería dura más?' })
  await expect(recent).toBeVisible()
  await expect(recent.getByText(/✓/).first()).toBeVisible()
  await expect(page.getByText('La batería del celular').first()).toBeVisible()
  await expect(page.getByText(/Arandu eligió/)).toBeVisible()
  // the kid's own explanation is quoted, and the weekly summary is there
  await expect(recent.locator('blockquote').filter({ hasText: `«${REASON}»` })).toBeVisible()
  const week = page.locator('[aria-live="polite"]').filter({ has: page.getByText('Esta semana', { exact: true }) })
  await expect(week).toBeVisible()
  await expect(week).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 })
  await expect(week.locator('p').first()).not.toBeEmpty()
})
