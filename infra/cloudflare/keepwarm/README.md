# arandu-keepwarm

Standalone Cloudflare Worker that keeps the Arandu API on Vercel warm. Every minute (`* * * * *`, the
shortest cron interval) it pings `GET <API_URL>/actuator/health` three times, 20 s apart.

Why so often: the Vercel container scales to zero after well under a minute idle. Pinging every ~65 s
hit a cold start most of the time (5-6 s, often a 503 while Spring starts); every 4 minutes did not
help at all. The health endpoint includes Spring's DB indicator, so it also keeps the Neon database
awake. It never touches the LLM. It logs status and duration. No secrets. `fetch` always returns 404.
`API_URL` lives in `vars` in `wrangler.jsonc`.

## Cost

Workers free tier: 5 cron triggers per account, 100,000 requests/day, 10 ms CPU per invocation.
This uses 1,440 invocations and 4,320 requests/day; waiting and fetching is I/O, not CPU.
On Vercel the container then stays up around the clock (billed as active compute).

## Deploy / remove

    pnpm --dir infra/cloudflare/keepwarm install
    pnpm --dir infra/cloudflare/keepwarm run deploy
    # remove
    pnpm --dir infra/cloudflare/keepwarm exec wrangler delete

Local test: `pnpm --dir infra/cloudflare/keepwarm run dev`, then
`curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.
