// A tiny in-memory rate limiter (fixed window) to blunt abuse / DDOS / runaway
// cost on expensive endpoints. Keyed per caller (IP or user).
//
// NOTE: in-memory means it only counts within ONE server process. At scale
// (multiple servers) this would move to a shared store like Redis.
const buckets = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfter: Math.ceil((b.resetAt - now) / 1000),
  };
}

// Best-effort client identifier from request headers.
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}
