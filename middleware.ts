import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit/memory";

const SENSITIVE_POST_PATHS = new Set([
  "/api/auth/callback/credentials",
  "/api/mfa/confirm",
  "/api/mfa/setup",
]);

const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 20,
} as const;

function getClientIp(req: NextRequest) {
  // Best-effort: edge runtime headers vary by platform.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (!SENSITIVE_POST_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;
  const rl = checkRateLimit(key, RATE_LIMIT);

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetMs - Date.now()) / 1000))),
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/callback/credentials",
    "/api/mfa/confirm",
    "/api/mfa/setup",
  ],
};

