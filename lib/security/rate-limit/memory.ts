type Bucket = {
  windowStartMs: number;
  count: number;
};

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

export function checkRateLimit(key: string, cfg: RateLimitConfig) {
  const t = now();
  const b = buckets.get(key);

  if (!b || t - b.windowStartMs >= cfg.windowMs) {
    buckets.set(key, { windowStartMs: t, count: 1 });
    return { ok: true, remaining: cfg.max - 1, resetMs: t + cfg.windowMs };
  }

  if (b.count >= cfg.max) {
    return { ok: false, remaining: 0, resetMs: b.windowStartMs + cfg.windowMs };
  }

  b.count += 1;
  return { ok: true, remaining: Math.max(0, cfg.max - b.count), resetMs: b.windowStartMs + cfg.windowMs };
}

