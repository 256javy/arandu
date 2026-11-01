import { pingOffsets } from './schedule.ts'

interface Env {
  API_URL: string
  /** ISO instants (UTC) of the window when the API must stay warm; see README. */
  WARM_FROM: string
  WARM_UNTIL: string
}

const TIMEOUT_MS = 10_000

async function ping(env: Env, at: number): Promise<void> {
  const url = `${env.API_URL.replace(/\/$/, '')}/actuator/health`
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    await res.body?.cancel()
    console.log(`keepwarm +${at}s status=${res.status} ms=${Date.now() - start}`)
  } catch (err) {
    console.log(`keepwarm +${at}s error=${String(err)} ms=${Date.now() - start}`)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run(env: Env, scheduledTime: number): Promise<void> {
  const t0 = Date.now()
  for (const at of pingOffsets(scheduledTime, env.WARM_FROM, env.WARM_UNTIL)) {
    await sleep(Math.max(0, t0 + at * 1000 - Date.now()))
    await ping(env, at)
  }
}

export default {
  async scheduled(event, env, ctx): Promise<void> {
    ctx.waitUntil(run(env, event.scheduledTime))
  },
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
