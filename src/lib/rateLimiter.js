/**
 * In-memory rate limiter.
 * NOTE: Resets on server restart. For multi-instance deployments, replace
 * the store with a shared Redis/Upstash backend.
 *
 * createRateLimiter(maxAttempts, windowMs)
 *   .check(key)  → { allowed: boolean, retryAfterSeconds?: number }
 *   .reset(key)  → void
 */
function createRateLimiter(maxAttempts, windowMs) {
    // Map<key, { count: number, windowStart: number }>
    const store = new Map();

    function check(key) {
        const now = Date.now();
        const entry = store.get(key);

        if (!entry || now - entry.windowStart >= windowMs) {
            // Fresh window
            store.set(key, { count: 1, windowStart: now });
            return { allowed: true };
        }

        if (entry.count >= maxAttempts) {
            const retryAfterMs = windowMs - (now - entry.windowStart);
            return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
        }

        entry.count += 1;
        return { allowed: true };
    }

    function reset(key) {
        store.delete(key);
    }

    return { check, reset };
}

// 10 attempts per 15-minute window for login
export const loginRateLimiter = createRateLimiter(10, 15 * 60 * 1000);

// 30 saves per 5-minute window for vendor actions
export const vendorRateLimiter = createRateLimiter(30, 5 * 60 * 1000);
