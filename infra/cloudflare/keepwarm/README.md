# arandu-keepwarm

Standalone Cloudflare Worker that keeps the Arandu API on Vercel warm by pinging
`GET <API_URL>/actuator/health`. The health endpoint includes Spring's DB indicator, so it also keeps
the Neon database awake. It never touches the LLM. It logs status and duration. No secrets. `fetch`
always returns 404.

## Why, and how often

The Vercel container scales to zero well under a minute idle, and a cold start takes ~5-6 s while
Spring starts (often answered with a 503). Measured: pinging every ~65 s hit a cold instance most of
the time, and every 4 minutes did not help at all. The web also retries a 503 twice (1.5 s, 3 s), so a
cold start is slow but not an error.

The cron runs every minute (`* * * * *`, the shortest interval). What each run does depends on the
date (UTC), decided in the handler (`src/schedule.ts`):

- **Warm window** (`WARM_FROM` ≤ now < `WARM_UNTIL`, set in `vars`): three pings, at +0, +20 and
  +40 s, so the API is never idle for more than ~20 s. Meant for recording the demo and judging.
- **Outside it**: one ping every 4 minutes (runs whose minute is not a multiple of 4 do nothing). This
  keeps the DB awake but not the container: the first request after a quiet minute is a cold start.

A missing or invalid window means outside. To change the window, edit `WARM_FROM` / `WARM_UNTIL` in
`wrangler.jsonc` and deploy again.

## Cost

Workers free tier: 5 cron triggers per account, 100,000 requests/day, 10 ms CPU per invocation.
Every minute is 1,440 invocations/day; inside the window that is 4,320 pings/day, outside 360. Waiting
and fetching is I/O, not CPU.

Vercel Hobby: inside the window the container stays up around the clock, which counts as active
compute. Hobby has a fixed monthly allowance and pauses the project when it runs out, so keep the
window short (only when someone has to see it fast) and check the usage page while it is active.

## Deploy / remove

    pnpm --dir infra/cloudflare/keepwarm install
    pnpm --dir infra/cloudflare/keepwarm test
    pnpm --dir infra/cloudflare/keepwarm run deploy
    # remove
    pnpm --dir infra/cloudflare/keepwarm exec wrangler delete

Local test: `pnpm --dir infra/cloudflare/keepwarm run dev`, then
`curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.
