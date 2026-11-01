package org.arandu.api.vision;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Sliding one-hour window per account, in memory (one API instance; resets on restart). */
public class HourlyRateLimiter {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final int limit;
    private final Clock clock;
    private final Map<UUID, Deque<Instant>> calls = new ConcurrentHashMap<>();

    public HourlyRateLimiter(int limit, Clock clock) {
        this(limit, Integer.MAX_VALUE, clock);
    }

    private final int maxInFlight;
    private final Map<UUID, Integer> inFlight = new ConcurrentHashMap<>();

    public HourlyRateLimiter(int limit, int maxInFlight, Clock clock) {
        this.limit = limit;
        this.maxInFlight = maxInFlight;
        this.clock = clock;
    }

    /** Starts a request for the account, or returns false if it already has {@code maxInFlight} running. */
    public boolean tryEnter(UUID accountId) {
        boolean[] ok = {false};
        inFlight.compute(accountId, (k, n) -> {
            int cur = n == null ? 0 : n;
            if (cur >= maxInFlight) {
                return cur;
            }
            ok[0] = true;
            return cur + 1;
        });
        return ok[0];
    }

    /** Ends a request started with {@link #tryEnter}. */
    public void exit(UUID accountId) {
        inFlight.computeIfPresent(accountId, (k, n) -> n <= 1 ? null : n - 1);
    }

    /** Records a call and returns true, or returns false if the account is over the limit. */
    public boolean tryAcquire(UUID accountId) {
        Instant now = clock.instant();
        Deque<Instant> q = calls.computeIfAbsent(accountId, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && !q.peekFirst().isAfter(now.minus(WINDOW))) {
                q.pollFirst();
            }
            if (q.size() >= limit) {
                return false;
            }
            q.addLast(now);
            return true;
        }
    }
}
