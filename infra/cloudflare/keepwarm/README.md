# arandu-keepwarm

Standalone Cloudflare Worker that pings `GET <API_URL>/actuator/health` every 4 minutes
(`*/4 * * * *`) so the Arandu API on Vercel does not scale to zero (cold start ~6.7 s, sometimes 503).
It logs status and duration; the health endpoint does not touch the DB or the LLM. No secrets.
`fetch` always returns 404. `API_URL` lives in `vars` in `wrangler.jsonc`.

## Cost

Workers free tier: 5 cron triggers per account, 100,000 requests/day, 10 ms CPU per invocation.
This uses 360 invocations/day; awaiting the fetch is I/O, not CPU.

## Deploy / remove

    pnpm --dir infra/cloudflare/keepwarm install
    pnpm --dir infra/cloudflare/keepwarm run deploy
    # remove
    pnpm --dir infra/cloudflare/keepwarm exec wrangler delete

Local test: `pnpm --dir infra/cloudflare/keepwarm run dev`, then
`curl "http://localhost:8787/__scheduled?cron=*/4+*+*+*+*"`.
