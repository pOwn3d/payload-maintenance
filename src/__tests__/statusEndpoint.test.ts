import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { createStatusHandler } from '../endpoints/status.js'

/**
 * The status endpoint is what the middleware and the public maintenance page
 * read, so it is tested through its HTTP answer rather than through its private
 * helpers. Payload is faked with the two members the handler actually uses.
 *
 * Each test gets its own client IP: the rate limiter is process-wide, so shared
 * IPs would make the suite order-dependent.
 */
let ipCounter = 0
const nextIp = () => `203.0.113.${(ipCounter++ % 250) + 1}-${ipCounter}`

function makeReq(opts: {
  global?: Record<string, unknown>
  throws?: boolean
  user?: unknown
  ip?: string
}): PayloadRequest {
  return {
    headers: new Headers({ 'x-forwarded-for': opts.ip ?? nextIp() }),
    user: opts.user ?? null,
    payload: {
      findGlobal: async () => {
        if (opts.throws) throw new Error('database is locked')
        return opts.global ?? {}
      },
      logger: { error: vi.fn(), info: vi.fn() },
    },
  } as unknown as PayloadRequest
}

const readStatus = async (global: Record<string, unknown>, mediaSlug = 'media') => {
  const handler = createStatusHandler('maintenance', true, mediaSlug)
  const res = await handler(makeReq({ global }))
  return { res, body: (await res.json()) as Record<string, unknown> }
}

describe('GET /status — URL des médias', () => {
  it('sert l URL fournie par Payload plutôt qu un chemin reconstruit', async () => {
    // Régression de priorité d'opérateurs : l'URL réelle (souvent celle d'un
    // adaptateur S3/CDN) était testée puis jetée au profit d'un chemin qui 404.
    const { body } = await readStatus({
      logo: { url: 'https://cdn.example.com/logo.png', filename: 'logo.png' },
    })
    expect(body.logoUrl).toBe('https://cdn.example.com/logo.png')
  })

  it('reconstruit un chemin de fichier quand le média n a pas d URL', async () => {
    const { body } = await readStatus({ logo: { filename: 'logo.png' } })
    expect(body.logoUrl).toBe('/api/media/file/logo.png')
  })

  it('utilise la collection média configurée pour reconstruire le chemin', async () => {
    const { body } = await readStatus({ logo: { filename: 'logo.png' } }, 'uploads')
    expect(body.logoUrl).toBe('/api/uploads/file/logo.png')
  })

  it('renvoie null quand il n y a rien à servir', async () => {
    const empty = await readStatus({ logo: null, backgroundImage: undefined })
    expect(empty.body.logoUrl).toBeNull()
    expect(empty.body.backgroundImageUrl).toBeNull()
    // Média présent mais inexploitable : ni URL, ni nom de fichier.
    const unusable = await readStatus({ logo: { id: 12, alt: 'Logo' } })
    expect(unusable.body.logoUrl).toBeNull()
  })

  it('ignore une relation non peuplée au lieu d en faire une URL cassée', async () => {
    // Cas `depth` insuffisant : le champ vaut l'identifiant brut. Sur Mongo
    // c'est une chaîne, ailleurs un nombre. La chaîne était renvoyée telle
    // quelle et rendait <img src="65f1c2d3…">, alors que le nombre donnait déjà
    // null — les deux doivent se comporter pareil.
    const mongo = await readStatus({ logo: '65f1c2d3e4b5a6978c0d1e2f' })
    expect(mongo.body.logoUrl).toBeNull()

    const relationnel = await readStatus({ logo: 42 })
    expect(relationnel.body.logoUrl).toBeNull()
  })

  it('accepte une chaîne qui est déjà une URL servable', async () => {
    const chemin = await readStatus({ logo: '/media/logo.svg' })
    expect(chemin.body.logoUrl).toBe('/media/logo.svg')

    const absolue = await readStatus({ logo: 'https://cdn.example.com/logo.svg' })
    expect(absolue.body.logoUrl).toBe('https://cdn.example.com/logo.svg')
  })

  it('applique la même règle à tous les visuels de la page', async () => {
    const { body } = await readStatus({
      logo: { url: '/media/logo.svg' },
      backgroundImage: { filename: 'bg.jpg' },
      favicon: { url: 'https://cdn.example.com/fav.ico', filename: 'fav.ico' },
      splitImage: null,
    })
    expect(body.logoUrl).toBe('/media/logo.svg')
    expect(body.backgroundImageUrl).toBe('/api/media/file/bg.jpg')
    expect(body.faviconUrl).toBe('https://cdn.example.com/fav.ico')
    expect(body.splitImageUrl).toBeNull()
  })
})

describe('GET /status — état effectif servi au middleware', () => {
  it('annonce la maintenance quand la fenêtre planifiée est ouverte', async () => {
    const { body } = await readStatus({
      enabled: false,
      autoEnable: true,
      scheduledStart: new Date(Date.now() - 60_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(body.enabled).toBe(true)
  })

  it('garde le site ouvert quand la fenêtre planifiée est déjà terminée', async () => {
    const { body } = await readStatus({
      enabled: false,
      autoEnable: true,
      autoDisable: true,
      scheduledStart: new Date(Date.now() - 7_200_000).toISOString(),
      scheduledEnd: new Date(Date.now() - 3_600_000).toISOString(),
    })
    expect(body.enabled).toBe(false)
  })

  it('découpe les routes exclues saisies ligne par ligne, espaces et lignes vides ignorés', async () => {
    const { body } = await readStatus({ excludedRoutes: '/contact\n  /blog/*  \n\n/status\n' })
    expect(body.excludedRoutes).toEqual(['/contact', '/blog/*', '/status'])
    expect((await readStatus({})).body.excludedRoutes).toEqual([])
  })

  it('indique si l appelant est authentifié', async () => {
    const handler = createStatusHandler('maintenance')
    const anon = await (await handler(makeReq({ global: {} }))).json()
    const logged = await (
      await handler(makeReq({ global: {}, user: { id: 1, collection: 'users' } }))
    ).json()
    expect(anon.isAuthenticated).toBe(false)
    expect(logged.isAuthenticated).toBe(true)
  })

  it('active le bypass authentifié par défaut et ne le coupe que sur demande explicite', async () => {
    expect((await readStatus({})).body.authBypass).toBe(true)
    expect((await readStatus({ authBypass: false })).body.authBypass).toBe(false)
  })

  it('fournit des valeurs de repli pour que la page de maintenance reste affichable', async () => {
    const { body } = await readStatus({})
    expect(body.template).toBe('minimal')
    expect(body.backgroundColor).toBe('#0f172a')
    expect(body.backgroundOverlayOpacity).toBe(70)
    expect(body.showDashboardToggle).toBe(true)
  })
})

describe('GET /status — panne de base de données', () => {
  it('répond 503 sans jamais affirmer que le site est ouvert', async () => {
    // Régression : un HTTP 200 `{enabled: false}` disait « pas de maintenance »
    // au moment précis où la base était morte, et laissait indexer un site cassé.
    const handler = createStatusHandler('maintenance')
    const res = await handler(makeReq({ throws: true }))
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('10')
    const body = (await res.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('enabled')
    expect(body.error).toBeTruthy()
  })
})

describe('GET /status — limitation de débit', () => {
  it('coupe une IP au-delà de 60 requêtes par minute sans gêner les autres visiteurs', async () => {
    const handler = createStatusHandler('maintenance')
    const flooder = '198.51.100.42'
    let last = await handler(makeReq({ global: {}, ip: flooder }))
    for (let i = 1; i < 60; i++) {
      last = await handler(makeReq({ global: {}, ip: flooder }))
    }
    expect(last.status).toBe(200)

    const refused = await handler(makeReq({ global: {}, ip: flooder }))
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0)

    const other = await handler(makeReq({ global: {}, ip: '198.51.100.43' }))
    expect(other.status).toBe(200)
  })
})
