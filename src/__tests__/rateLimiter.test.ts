import { afterEach, describe, expect, it, vi } from 'vitest'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'

/**
 * The limiter keeps a process-wide store, exactly as it does in production.
 * Every test therefore uses its own key namespace so the suite stays
 * order-independent instead of resetting private module state.
 */
let counter = 0
const uniqueKey = (label: string) => `${label}:${counter++}:${Math.random().toString(36).slice(2)}`

describe('rateLimit — quota par clé', () => {
  it('laisse passer les requêtes tant que le quota n est pas atteint, sans délai d attente', () => {
    const key = uniqueKey('under')
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000)).toEqual({ allowed: true, retryAfter: 0 })
    }
  })

  it('refuse la requête qui dépasse le quota, et toutes celles qui suivent', () => {
    const key = uniqueKey('over')
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(false)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(false)
  })

  it('indique au client combien de secondes attendre, sans jamais dépasser la fenêtre', () => {
    const key = uniqueKey('retry')
    rateLimit(key, 1, 30_000)
    const refused = rateLimit(key, 1, 30_000)
    expect(refused.allowed).toBe(false)
    expect(refused.retryAfter).toBeGreaterThan(0)
    expect(refused.retryAfter).toBeLessThanOrEqual(30)
  })

  it('compte chaque IP séparément : un abuseur ne bloque pas les autres visiteurs', () => {
    const abuser = uniqueKey('status:203.0.113.1')
    const visitor = uniqueKey('status:198.51.100.7')
    for (let i = 0; i < 6; i++) rateLimit(abuser, 2, 60_000)
    expect(rateLimit(abuser, 2, 60_000).allowed).toBe(false)
    expect(rateLimit(visitor, 2, 60_000).allowed).toBe(true)
  })

  it('compte séparément deux usages différents de la même IP', () => {
    // Les endpoints préfixent leur clé (`status:`, `newsletter:`…) : saturer la
    // newsletter ne doit pas couper la lecture du statut.
    const ip = Math.random().toString(36).slice(2)
    for (let i = 0; i < 6; i++) rateLimit(`newsletter:${ip}`, 5, 60_000)
    expect(rateLimit(`newsletter:${ip}`, 5, 60_000).allowed).toBe(false)
    expect(rateLimit(`status:${ip}`, 5, 60_000).allowed).toBe(true)
  })
})

describe('rateLimit — expiration de la fenêtre', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rouvre le quota une fois la fenêtre écoulée', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const key = uniqueKey('window')
    for (let i = 0; i < 2; i++) rateLimit(key, 2, 60_000)
    expect(rateLimit(key, 2, 60_000).allowed).toBe(false)

    vi.setSystemTime(Date.now() + 61_000)
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true)
  })

  it('garde le quota fermé tant que la fenêtre n est pas terminée', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const key = uniqueKey('window-open')
    rateLimit(key, 1, 60_000)
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false)

    vi.setSystemTime(Date.now() + 59_000)
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false)
  })

  it('repart d un compteur neuf après expiration, pas d un compteur saturé', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const key = uniqueKey('window-reset')
    for (let i = 0; i < 10; i++) rateLimit(key, 3, 60_000)

    vi.setSystemTime(Date.now() + 61_000)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(false)
  })
})

describe('rateLimitResponse', () => {
  it('répond 429 avec un Retry-After exploitable par le client', async () => {
    const res = rateLimitResponse(42)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    await expect(res.json()).resolves.toEqual({ error: 'Too many requests' })
  })
})
