interface Env {
  API_URL: string;
}

const TIMEOUT_MS = 10_000;
/**
 * Seconds into each minute to ping. The Vercel container scales to zero after well under a minute idle
 * (measured: a ping every ~65 s hit a cold start, 5-6 s or 503, most of the time), and cron can't run
 * more often than once a minute, so each run pings three times, 20 s apart.
 */
const OFFSETS_S = [0, 20, 40];

async function ping(env: Env, at: number): Promise<void> {
  const url = `${env.API_URL.replace(/\/$/, "")}/actuator/health`;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    console.log(`keepwarm +${at}s status=${res.status} ms=${Date.now() - start}`);
  } catch (err) {
    console.log(`keepwarm +${at}s error=${String(err)} ms=${Date.now() - start}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(env: Env): Promise<void> {
  const t0 = Date.now();
  for (const at of OFFSETS_S) {
    await sleep(Math.max(0, t0 + at * 1000 - Date.now()));
    await ping(env, at);
  }
}

export default {
  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(run(env));
  },
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
