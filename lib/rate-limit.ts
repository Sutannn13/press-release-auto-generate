import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitKind = "generate" | "export";

export interface RateLimitDecision {
  allowed: boolean;
  unavailable: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface Limiters {
  generate: Ratelimit;
  generateGlobal: Ratelimit;
  export: Ratelimit;
}

let limiters: Limiters | null = null;

export function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getLimiters(): Limiters {
  if (limiters) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("Konfigurasi Redis belum lengkap.");
  const redis = new Redis({ url, token });
  limiters = {
    generate: new Ratelimit({
      redis,
      prefix: "kemenag:generate",
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      timeout: 1_000,
    }),
    generateGlobal: new Ratelimit({
      redis,
      prefix: "kemenag:generate-global",
      limiter: Ratelimit.fixedWindow(100, "1 d"),
      timeout: 1_000,
    }),
    export: new Ratelimit({
      redis,
      prefix: "kemenag:export",
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      timeout: 1_000,
    }),
  };
  return limiters;
}

function testDecision(): RateLimitDecision | null {
  if (process.env.NODE_ENV !== "test") return null;
  if (process.env.RATE_LIMIT_TEST_MODE === "deny") {
    return { allowed: false, unavailable: false, limit: 1, remaining: 0, reset: Date.now() + 60_000 };
  }
  if (process.env.RATE_LIMIT_TEST_MODE === "unavailable") {
    return { allowed: false, unavailable: true, limit: 0, remaining: 0, reset: Date.now() + 1_000 };
  }
  if (process.env.RATE_LIMIT_TEST_MODE === "allow") {
    return { allowed: true, unavailable: false, limit: 100, remaining: 99, reset: Date.now() + 60_000 };
  }
  return null;
}

function toDecision(result: Awaited<ReturnType<Ratelimit["limit"]>>): RateLimitDecision {
  return {
    allowed: result.success,
    unavailable: false,
    limit: result.limit,
    remaining: Math.max(0, result.remaining),
    reset: result.reset,
  };
}

export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<RateLimitDecision> {
  const mocked = testDecision();
  if (mocked) return mocked;
  if (!redisConfigured()) {
    return { allowed: false, unavailable: true, limit: 0, remaining: 0, reset: Date.now() };
  }
  try {
    const active = getLimiters();
    if (kind === "generate") {
      const [personal, global] = await Promise.all([
        active.generate.limit(identifier),
        active.generateGlobal.limit("all-users"),
      ]);
      const restrictive = personal.success && global.success
        ? personal.remaining <= global.remaining ? personal : global
        : !personal.success ? personal : global;
      return toDecision(restrictive);
    }
    return toDecision(await active[kind].limit(identifier));
  } catch {
    return { allowed: false, unavailable: true, limit: 0, remaining: 0, reset: Date.now() };
  }
}

export function rateLimitHeaders(decision: RateLimitDecision): HeadersInit {
  const seconds = Math.max(1, Math.ceil((decision.reset - Date.now()) / 1_000));
  return {
    "Retry-After": String(seconds),
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(decision.reset),
  };
}
