interface Env {
  API_URL: string;
}

const TIMEOUT_MS = 10_000;

async function ping(env: Env): Promise<void> {
  const url = `${env.API_URL.replace(/\/$/, "")}/actuator/health`;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    console.log(`keepwarm status=${res.status} ms=${Date.now() - start}`);
  } catch (err) {
    console.log(`keepwarm error=${String(err)} ms=${Date.now() - start}`);
  }
}

export default {
  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(ping(env));
  },
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
