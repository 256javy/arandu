import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import { mockApi } from './mock-api.ts'

// Page-level checks always run against the fake API: they audit the UI, not the data.
const PAGES: { name: string; path: string; signedIn?: boolean; next?: string; ready: (p: Page) => Promise<void> }[] = [
  { name: 'home', path: '/', ready: (p) => expect(p.getByRole('heading', { level: 1 })).toBeVisible() },
  { name: 'sign in', path: '/entrar', ready: (p) => expect(p.getByLabel('Email')).toBeVisible() },
  { name: 'who learns', path: '/', signedIn: true, ready: (p) => expect(p.getByRole('button', { name: /^Soy Tati/ })).toBeVisible() },
  { name: 'pizza', path: '/aprender', signedIn: true, next: 'fractions.share-bar', ready: (p) => expect(p.getByRole('heading', { name: 'Repartí la pizza entre 4.' })).toBeVisible() },
  { name: 'number line', path: '/aprender', signedIn: true, next: 'fractions.number-line', ready: (p) => expect(p.getByRole('heading', { name: '¿Dónde va cada batería?' })).toBeVisible() },
  { name: 'explain', path: '/aprender', signedIn: true, next: 'fractions.explain-compare', ready: (p) => expect(p.getByLabel('Tu respuesta')).toBeVisible() },
  { name: 'recipe', path: '/aprender', signedIn: true, next: 'proportions.recipe', ready: (p) => expect(p.getByRole('heading', { name: 'Hacé panqueques para 8.' })).toBeVisible() },
  { name: 'photo', path: '/aprender?mision=foto', signedIn: true, ready: (p) => expect(p.getByRole('button', { name: 'Probar con una foto de ejemplo' })).toBeVisible() },
  { name: 'family', path: '/familia', signedIn: true, ready: (p) => expect(p.getByRole('tab', { name: 'Tati' })).toBeVisible() },
]

for (const pg of PAGES) {
  test(`axe WCAG 2.1 AA: ${pg.name}`, async ({ page }) => {
    await mockApi(page, { signedIn: pg.signedIn, forceNext: pg.next })
    await page.goto(pg.path)
    await pg.ready(page)
    // let entrance animations settle so colors are measured at rest
    await page.waitForTimeout(2800)
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    expect(summary).toEqual([])
  })
}
