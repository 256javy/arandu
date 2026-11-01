import { test as base, expect } from '@playwright/test'

/**
 * Chromium aborts in-flight requests with net::ERR_NETWORK_CHANGED whenever a network interface
 * appears or goes away (on dev machines, Docker creates and removes veth/bridge interfaces all the
 * time). If that hits the dev server's module requests during a page load, the app never boots and
 * the test waits on an empty page. `page.goto` here reloads only in that case, and records it.
 */
export const test = base.extend({
  // `provide` is Playwright's `use` (renamed so the React hooks lint rule does not mistake it for a hook)
  page: async ({ page }, provide, info) => {
    const goto = page.goto.bind(page)
    page.goto = async (url, options) => {
      for (let attempt = 1; ; attempt++) {
        let changed = false
        const onFail = (r: { failure(): { errorText: string } | null }) => {
          if (r.failure()?.errorText.includes('ERR_NETWORK_CHANGED')) changed = true
        }
        page.on('requestfailed', onFail)
        const res = await goto(url, options)
        // the app has booted once the router rendered its layout (every module of the entry loaded)
        await page.locator('#main').waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined)
        page.off('requestfailed', onFail)
        if (!changed || attempt === 3) return res
        info.annotations.push({ type: 'network-changed', description: `reloaded ${url} (attempt ${attempt})` })
      }
    }
    await provide(page)
  },
})

export { expect }
