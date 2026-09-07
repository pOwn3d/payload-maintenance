import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaintenanceMiddlewareConfig } from '../middleware/maintenanceMiddleware.js'

/**
 * The middleware keeps a process-wide status cache, so each test loads a fresh
 * copy of the module: no test can inherit another one's cached decision.
 * Network is replaced by a small router over the three URLs the middleware
 * actually calls (status, `/me`, maintenance page).
 *
 * Because that cache and the `fetch` stub are process-wide, the tests in this
 * file must run one after another (vitest's default). Do not turn on
 * `concurrent` here: two middlewares sharing one module instance would answer
 * from each other's cached status.
 */
async function makeMiddleware(config: MaintenanceMiddlewareConfig = {}) {
  vi.resetModules()
  const { createMaintenanceMiddleware } = await import('../middleware/maintenanceMiddleware.js')
  return createMaintenanceMiddleware({ cacheDuration: 0, ...config })
}

interface FetchScript {
  /** Answer of GET <origin>/api/maintenance/status */
  status?: () => Response
  /** Answer of GET <origin>/api/<slug>/me */
  me?: (url: string, init: RequestInit | undefined) => Response
  /** Answer of GET <origin>/api/maintenance/page */
  page?: () => Response
}

function installFetch(script: FetchScript = {}) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: unknown, init?: unknown) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/maintenance/status')) {
      return script.status ? script.status() : Response.json({ enabled: false })
    }
    if (url.endsWith('/me')) {
      return script.me ? script.me(url, init as RequestInit) : Response.json({ user: null })
    }
    if (url.includes('/maintenance/page')) {
      return script.page ? script.page() : new Response('<h1>Site en maintenance</h1>')
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

const maintenanceOn = (extra: Record<string, unknown> = {}) => () =>
  Response.json({ enabled: true, ...extra })

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://site.test${path}`, { headers })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('middleware — chemins qui ne sont jamais bloqués', () => {
  it('laisse passer l admin et l API sans même interroger le statut', async () => {
    const { calls } = installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/admin/collections/pages'))).toBeNull()
    expect(await middleware(request('/api/pages'))).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('exclut la liste de l intégrateur sur frontière de segment, et elle seule', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ excludedPaths: ['/back-office'] })

    // La route exclue elle-même et tout ce qui est dessous.
    expect(await middleware(request('/back-office'))).toBeNull()
    expect(await middleware(request('/back-office/login'))).toBeNull()

    // Régression : un préfixe brut excluait aussi les routes qui commencent par
    // les mêmes lettres, qui restaient donc en ligne pendant la maintenance.
    expect(await middleware(request('/back-office-public'))).not.toBeNull()

    // La liste par défaut ne s'ajoute pas à celle de l'intégrateur.
    expect(await middleware(request('/admin'))).not.toBeNull()
  })

  it('laisse passer les assets statiques pour ne pas casser la page de maintenance elle-même', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    for (const path of ['/_next/static/chunk.js', '/favicon.ico', '/img/logo.svg', '/theme.css']) {
      expect(await middleware(request(path))).toBeNull()
    }
  })

  it('laisse passer l endpoint qui sert la page de maintenance', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/api/maintenance/page'))).toBeNull()
  })

  it('réécrit /maintenance vers l endpoint en conservant les paramètres de prévisualisation', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    const res = await middleware(request('/maintenance?preview=true&lang=fr'))
    const rewrite = res?.headers.get('x-middleware-rewrite')
    expect(rewrite).toContain('/api/maintenance/page')
    expect(rewrite).toContain('preview=true')
    expect(rewrite).toContain('lang=fr')
  })
})

describe('middleware — service de la page de maintenance', () => {
  it('ne bloque rien quand la maintenance est éteinte', async () => {
    installFetch({ status: () => Response.json({ enabled: false }) })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog'))).toBeNull()
  })

  it('sert la page en 503 non indexable quand la maintenance est active', async () => {
    installFetch({ status: maintenanceOn(), page: () => new Response('<h1>Bientôt de retour</h1>') })
    const middleware = await makeMiddleware()

    const res = await middleware(request('/blog'))
    expect(res?.status).toBe(503)
    expect(res?.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(res?.headers.get('Content-Type')).toContain('text/html')
    expect(res?.headers.get('Cache-Control')).toContain('no-store')
    await expect(res?.text()).resolves.toContain('Bientôt de retour')
  })

  it('répond 200 quand l intégrateur refuse le 503', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ return503: false })
    expect((await middleware(request('/blog')))?.status).toBe(200)
  })

  it('calcule le Retry-After depuis la fin estimée, avec une heure par défaut', async () => {
    installFetch({
      status: maintenanceOn({ estimatedEnd: new Date(Date.now() + 600_000).toISOString() }),
    })
    const withEnd = await makeMiddleware()
    const retry = Number((await withEnd(request('/blog')))?.headers.get('Retry-After'))
    expect(retry).toBeGreaterThan(500)
    expect(retry).toBeLessThanOrEqual(600)

    installFetch({ status: maintenanceOn() })
    const withoutEnd = await makeMiddleware()
    expect((await withoutEnd(request('/blog')))?.headers.get('Retry-After')).toBe('3600')
  })

  it('se rabat sur /maintenance quand la page ne peut pas être récupérée', async () => {
    installFetch({
      status: maintenanceOn(),
      page: () => {
        throw new Error('page endpoint down')
      },
    })
    const middleware = await makeMiddleware()

    const rewrite = (await middleware(request('/blog')))?.headers.get('x-middleware-rewrite')
    expect(rewrite).toContain('/maintenance')
    expect(rewrite).toContain('from=%2Fblog')
  })
})

describe('middleware — routes laissées ouvertes pendant la maintenance', () => {
  it('n ouvre une route exacte que pour elle-même', async () => {
    installFetch({ status: maintenanceOn({ excludedRoutes: ['/contact'] }) })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/contact'))).toBeNull()
    expect(await middleware(request('/contact/merci'))).not.toBeNull()
  })

  it('ouvre toute une section avec un joker', async () => {
    installFetch({ status: maintenanceOn({ excludedRoutes: ['/blog/*'] }) })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/blog/mon-article'))).toBeNull()
    expect(await middleware(request('/blog/2026/bilan'))).toBeNull()
    expect(await middleware(request('/blogueurs'))).not.toBeNull()
  })
})

describe('middleware — dérogations', () => {
  it('laisse passer le porteur du cookie de dérogation', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/blog', { cookie: 'maintenance-bypass=true' }))).toBeNull()
    expect(await middleware(request('/blog', { cookie: 'maintenance-bypass=maybe' }))).not.toBeNull()
  })

  it('échange le bon secret contre un cookie de dérogation de 24 h, et ignore un mauvais secret', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })

    const granted = await middleware(request('/blog?bypass=s3cret'))
    expect(granted?.status).toBe(307)
    expect(granted?.headers.get('location')).toBe('https://site.test/blog')
    const cookie = granted?.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('maintenance-bypass=true')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=86400')

    expect((await middleware(request('/blog?bypass=wrong')))?.status).toBe(503)
  })

  it('ne laisse passer que les IP explicitement autorisées', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ allowedIPs: ['203.0.113.10'] })

    expect(
      await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' })),
    ).toBeNull()
    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.11' }))).not.toBeNull()
  })

  it('ignore les en-têtes de proxy quand le proxy n est pas de confiance', async () => {
    // Sans proxy de confiance, un visiteur qui forge X-Forwarded-For ne doit pas
    // pouvoir se faire passer pour une IP de la liste blanche.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ allowedIPs: ['203.0.113.10'], trustProxy: false })

    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10' }))).not.toBeNull()
  })
})

describe('middleware — dérogation des utilisateurs connectés', () => {
  const meAnswers = (validFor: { slug: string; token: string }) => (url: string, init: RequestInit | undefined) => {
    const cookie = String((init?.headers as Record<string, string> | undefined)?.Cookie ?? '')
    const matchesSlug = url.endsWith(`/api/${validFor.slug}/me`)
    const matchesToken = cookie.includes(validFor.token)
    return Response.json({ user: matchesSlug && matchesToken ? { id: 1 } : null })
  }

  it('laisse passer un compte de la collection d administration', async () => {
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'users', token: 'good-token' }) })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog', { cookie: 'payload-token=good-token' }))).toBeNull()
  })

  it('bloque un compte que Payload ne reconnaît pas sur cette collection', async () => {
    // C'est ce qui empêche un client d'un espace client de contourner la
    // maintenance : /api/users/me répond `{ user: null }` pour son jeton.
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'users', token: 'good-token' }) })
    const middleware = await makeMiddleware()
    expect(
      await middleware(request('/blog', { cookie: 'payload-token=customer-token' })),
    ).not.toBeNull()
  })

  it('interroge la collection d administration configurée par le host', async () => {
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'staff', token: 'good-token' }) })
    const onStaff = await makeMiddleware({ usersCollectionSlug: 'staff' })
    expect(await onStaff(request('/blog', { cookie: 'payload-token=good-token' }))).toBeNull()

    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'staff', token: 'good-token' }) })
    const onDefault = await makeMiddleware()
    expect(await onDefault(request('/blog', { cookie: 'payload-token=good-token' }))).not.toBeNull()
  })

  it('renvoie le jeton sous le nom de cookie configuré', async () => {
    // Régression : un host avec un cookiePrefix personnalisé perdait sa
    // dérogation, le jeton étant réémis sous « payload-token ».
    installFetch({
      status: maintenanceOn(),
      me: (_url, init) => {
        const cookie = String((init?.headers as Record<string, string> | undefined)?.Cookie ?? '')
        return Response.json({ user: cookie.startsWith('mysite-token=') ? { id: 1 } : null })
      },
    })
    const middleware = await makeMiddleware({ authCookieName: 'mysite-token' })
    expect(await middleware(request('/blog', { cookie: 'mysite-token=good-token' }))).toBeNull()
  })

  // BUG EXPOSÉ — `validateAuthToken` annonce dans son commentaire « Network error
  // — don't cache failure, be permissive », mais le `catch` ne fait que ravaler
  // l'erreur : l'exécution retombe sur `authTokenCache.set(..., { valid: false })`
  // et mémorise le refus 15 s. Un simple hoquet réseau enferme donc un
  // administrateur légitime dehors pendant 15 s après le retour de l'API.
  // Test volontairement laissé en `it.fails` : le comportement attendu ci-dessous
  // est celui que le code déclare viser, pas celui qu'il applique.
  it(
    'ne devrait pas mémoriser un échec réseau sur /me une fois l API revenue',
    async () => {
      let meDown = true
      installFetch({
        status: maintenanceOn(),
        me: () => {
          if (meDown) throw new Error('connection reset by peer')
          return Response.json({ user: { id: 1 } })
        },
      })
      const middleware = await makeMiddleware()

      expect(
        await middleware(request('/blog', { cookie: 'payload-token=good-token' })),
      ).not.toBeNull()

      meDown = false
      expect(await middleware(request('/blog', { cookie: 'payload-token=good-token' }))).toBeNull()
    },
  )

  it('bloque même un administrateur quand le bypass authentifié est coupé côté global', async () => {
    installFetch({
      status: maintenanceOn({ authBypass: false }),
      me: meAnswers({ slug: 'users', token: 'good-token' }),
    })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog', { cookie: 'payload-token=good-token' }))).not.toBeNull()
  })
})

describe('middleware — statut indisponible', () => {
  it('continue de bloquer avec le dernier état connu quand le statut tombe en panne', async () => {
    // Régression : la panne fabriquait un `enabled: false` neuf, ce qui rouvrait
    // le site cassé aux visiteurs et aux robots au pire moment.
    let firstCall = true
    installFetch({
      status: () => {
        if (firstCall) {
          firstCall = false
          return Response.json({ enabled: true })
        }
        throw new Error('database is down')
      },
    })
    const middleware = await makeMiddleware()

    expect((await middleware(request('/blog')))?.status).toBe(503)
    expect((await middleware(request('/blog')))?.status).toBe(503)
    expect(console.warn).toHaveBeenCalled()
  })

  it('traite une réponse HTTP non-2xx du statut comme une panne, pas comme une absence de maintenance', async () => {
    let firstCall = true
    installFetch({
      status: () => {
        if (firstCall) {
          firstCall = false
          return Response.json({ enabled: true })
        }
        // Corps parfaitement lisible, mais code d'erreur : sans vérification de
        // `res.ok`, il était interprété comme « pas de maintenance ».
        return Response.json({ error: 'Failed to fetch maintenance status' }, { status: 503 })
      },
    })
    const middleware = await makeMiddleware()

    expect((await middleware(request('/blog')))?.status).toBe(503)
    expect((await middleware(request('/blog')))?.status).toBe(503)
  })

  it('traite un corps sans champ enabled booléen comme une panne', async () => {
    let firstCall = true
    installFetch({
      status: () => {
        if (firstCall) {
          firstCall = false
          return Response.json({ enabled: true })
        }
        return Response.json({ enabled: 'yes' })
      },
    })
    const middleware = await makeMiddleware()

    expect((await middleware(request('/blog')))?.status).toBe(503)
    expect((await middleware(request('/blog')))?.status).toBe(503)
  })

  it('laisse passer le trafic si le statut n a jamais répondu depuis le démarrage', async () => {
    // Dernier recours assumé : sans aucun état connu, on ne coupe pas un site
    // qui n'a peut-être jamais été en maintenance.
    installFetch({
      status: () => {
        throw new Error('cold start, API not up yet')
      },
    })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog'))).toBeNull()
  })
})

describe('middleware — planification', () => {
  it('bloque pendant une fenêtre planifiée même si le statut annonce le site ouvert', async () => {
    installFetch({
      status: () =>
        Response.json({
          enabled: false,
          autoEnable: true,
          scheduledStart: new Date(Date.now() - 60_000).toISOString(),
          scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
        }),
    })
    const middleware = await makeMiddleware()
    expect((await middleware(request('/blog')))?.status).toBe(503)
  })

  it('ne bloque pas quand la fenêtre planifiée est déjà terminée', async () => {
    installFetch({
      status: () =>
        Response.json({
          enabled: false,
          autoEnable: true,
          autoDisable: true,
          scheduledStart: new Date(Date.now() - 7_200_000).toISOString(),
          scheduledEnd: new Date(Date.now() - 3_600_000).toISOString(),
        }),
    })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog'))).toBeNull()
  })
})
