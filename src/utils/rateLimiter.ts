interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
// .unref() prevents this timer from keeping the Node.js process alive
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)
if (typeof cleanupInterval?.unref === 'function') cleanupInterval.unref()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true, retryAfter: 0 }
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  )
}
