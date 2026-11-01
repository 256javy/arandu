# Papercuts

Things that cost time in this repo and may bite again. Format: `- YYYY-MM-DD · symptom · fix`.

- 2026-11-01 · Playwright e2e fail at random on the first render (blank page) while Docker creates or removes network interfaces (compose, Testcontainers): Chromium aborts in-flight module requests with `net::ERR_NETWORK_CHANGED` · e2e run against a `vite preview` build, and `e2e/fixtures.ts` reloads a page whose load hit that error (up to 3 times, annotated in the report)
- 2026-11-01 · Playwright reuses another worktree's dev server on the same port (`reuseExistingServer`) and tests the wrong code · give each worktree its own port, or set `E2E_BASE_URL`
- 2026-11-01 · `muse-spark-1.3` returns empty content · it reasons before answering: set `reasoning_effort` and `max_tokens` ≥ 2000, and send at least one `user` message
