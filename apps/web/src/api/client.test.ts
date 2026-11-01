import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMe, HttpError } from './client'

const reply = (status: number) => new Response(status === 200 ? JSON.stringify({ email: 'a@example.com', learners: [] }) : '', { status })

describe('http cold-start retry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('retries a 503 (cold start) and returns the later answer', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(200))
    vi.stubGlobal('fetch', fetch)
    const me = getMe()
    await vi.runAllTimersAsync()
    await expect(me).resolves.toMatchObject({ email: 'a@example.com' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after two retries', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockImplementation(async () => reply(503))
    vi.stubGlobal('fetch', fetch)
    const me = getMe().catch((e) => e)
    await vi.runAllTimersAsync()
    expect(await me).toBeInstanceOf(HttpError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not retry other errors', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(500))
    vi.stubGlobal('fetch', fetch)
    await expect(getMe()).rejects.toBeInstanceOf(HttpError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
