import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit/memory";

describe("rate limit (memory)", () => {
  it("limits requests within the window", () => {
    const cfg = { windowMs: 60_000, max: 3 };
    const key = "ip:route";

    vi.spyOn(Date, "now").mockReturnValue(1_000);
    expect(checkRateLimit(key, cfg).ok).toBe(true);
    expect(checkRateLimit(key, cfg).ok).toBe(true);
    expect(checkRateLimit(key, cfg).ok).toBe(true);
    expect(checkRateLimit(key, cfg).ok).toBe(false);
  });

  it("resets after window", () => {
    const cfg = { windowMs: 1_000, max: 1 };
    const key = "ip:route:reset";

    const spy = vi.spyOn(Date, "now");
    spy.mockReturnValue(10_000);
    expect(checkRateLimit(key, cfg).ok).toBe(true);
    expect(checkRateLimit(key, cfg).ok).toBe(false);

    spy.mockReturnValue(11_001);
    expect(checkRateLimit(key, cfg).ok).toBe(true);
  });
});

