import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

export const isTouch = (info: TestInfo) => info.project.name === 'mobile'

/** Tap (touch) or click (mouse) at a fraction of an element's box. */
export async function pointAt(page: Page, el: Locator, fx: number, fy: number, touch: boolean) {
  const b = (await el.boundingBox())!
  const x = b.x + b.width * fx
  const y = b.y + b.height * fy
  if (touch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

/** Drag with a real touch sequence (via CDP) on mobile, or with the mouse on desktop. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, touch: boolean) {
  const steps = 12
  if (!touch) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps })
    await page.mouse.up()
    return
  }
  const cdp = await page.context().newCDPSession(page)
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) })
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

export const center = async (el: Locator) => {
  const b = (await el.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Musi's bubble that is on screen (there is one in the dock on phones and one beside the visual on desktop). */
export const bubble = (page: Page) => page.locator('p.bubble-in').filter({ visible: true })

/** Waits until Musi answered the last turn with `text`, and the dock is ready again. */
export async function waitReply(page: Page, text: string | RegExp) {
  await expect(bubble(page)).toContainText(text, { timeout: 20_000 })
}

export async function tap(el: Locator, touch: boolean) {
  if (touch) await el.tap()
  else await el.click()
}

/** Signs up a new adult account, creates the profile and enters as the kid. */
export async function register(page: Page, nickname = 'Tati') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  await page.goto('/entrar')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('e2e-password-123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).not.toHaveURL(/\/entrar/)
  await page.goto('/familia')
  await page.getByLabel(/Nuevo perfil/).fill(nickname)
  await page.getByRole('button', { name: 'Crear perfil' }).click()
  await expect(page.getByRole('tab', { name: nickname }).or(page.getByRole('button', { name: nickname })).first()).toBeVisible()
  await page.goto('/')
  return email
}
