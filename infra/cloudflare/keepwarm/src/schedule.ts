/**
 * When to ping. Inside the warm window (recording and judging) the API must never be cold: three
 * pings per minute, 20 s apart, since the Vercel container scales to zero well under a minute idle.
 * Outside it, one ping every 4 minutes is enough to keep the database awake and costs little.
 */
export const WARM_OFFSETS_S = [0, 20, 40]
export const IDLE_EVERY_MIN = 4

/** Seconds into this cron run (scheduled at `scheduledTime`) to ping; empty = skip this run. */
export function pingOffsets(scheduledTime: number, warmFrom: string, warmUntil: string): number[] {
  const from = Date.parse(warmFrom)
  const until = Date.parse(warmUntil)
  if (!Number.isNaN(from) && !Number.isNaN(until) && scheduledTime >= from && scheduledTime < until) return WARM_OFFSETS_S
  return new Date(scheduledTime).getUTCMinutes() % IDLE_EVERY_MIN === 0 ? [0] : []
}
