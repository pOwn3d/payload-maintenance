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

/** Payload's auth cookie always carries a JWT; the middleware refuses anything
 *  else without a network round-trip, so the fixtures must look like one. */
const JWT_HEADER = 'eyJhbGciOiJIUzI1NiJ9' // {"alg":"HS256"}
const GOOD_TOKEN = `${JWT_HEADER}.good-payload.c2lnbmF0dXJl`
const CUSTOMER_TOKEN = `${JWT_HEADER}.customer-payload.c2lnbmF0dXJl`

/** base64url of a JSON object, as a real JWT segment. */
const segment = (value: unknown) =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

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
  it('refuse un cookie de dérogation forgé, quelle que soit sa valeur', async () => {
    // Régression MNT-02 : le cookie valait la chaîne littérale « true », donc
    // `curl -H 'Cookie: maintenance-bypass=true'` traversait tout le mode
    // maintenance. `httpOnly` empêche le JS de LIRE le cookie, jamais un client
    // de l'ÉMETTRE.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })

    for (const forged of ['true', '1', 'maybe', `${Date.now() + 60_000}.deadbeef`]) {
      expect(
        await middleware(request('/blog', { cookie: `maintenance-bypass=${forged}` })),
      ).not.toBeNull()
    }
  })

  it('n honore aucun cookie de dérogation quand aucun secret n est configuré', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/blog', { cookie: 'maintenance-bypass=true' }))).not.toBeNull()
  })

  it('échange le bon secret contre un cookie signé de 24 h, et ignore un mauvais secret', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })

    const granted = await middleware(request('/blog?bypass=s3cret'))
    expect(granted?.status).toBe(307)
    expect(granted?.headers.get('location')).toBe('https://site.test/blog')
    const cookie = granted?.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=86400')
    // La valeur n'est plus un booléen devinable mais `<expiration>.<hmac>`.
    expect(cookie).not.toContain('maintenance-bypass=true')
    expect(cookie).toMatch(/maintenance-bypass=\d{13}\.[A-Za-z0-9_-]{20,}/)

    expect((await middleware(request('/blog?bypass=wrong')))?.status).toBe(503)
  })

  it('accepte ensuite le cookie qu il vient d émettre', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })

    const granted = await middleware(request('/blog?bypass=s3cret'))
    const value = /maintenance-bypass=([^;]+)/.exec(granted?.headers.get('set-cookie') ?? '')?.[1]
    expect(value).toBeTruthy()
    expect(
      await middleware(request('/blog', { cookie: `maintenance-bypass=${value}` })),
    ).toBeNull()
  })

  it('rejette un cookie signé dont l échéance est dépassée', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })
    const { signBypassToken } = await import('../utils/bypassToken.js')

    const expired = await signBypassToken('s3cret', Date.now() - 1000)
    expect(
      await middleware(request('/blog', { cookie: `maintenance-bypass=${expired}` })),
    ).not.toBeNull()
  })

  it('n accepte pas un cookie signé avec un autre secret', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: 's3cret' })
    const { signBypassToken } = await import('../utils/bypassToken.js')

    const foreign = await signBypassToken('autre-secret', Date.now() + 60_000)
    expect(
      await middleware(request('/blog', { cookie: `maintenance-bypass=${foreign}` })),
    ).not.toBeNull()
  })

  it('lit l IP ajoutée par le proxy, pas celle que le visiteur a écrite lui-même', async () => {
    // Régression MNT-03 : un proxy conforme AJOUTE l'adresse du pair, donc le
    // PREMIER élément de X-Forwarded-For est exactement ce que le client a
    // envoyé. Le lire laissait n'importe quel anonyme revendiquer une IP de la
    // liste blanche avec `curl -H 'X-Forwarded-For: 203.0.113.10'`.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ allowedIPs: ['203.0.113.10'] })

    // Le proxy a vu 203.0.113.10 : dérogation accordée.
    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10' }))).toBeNull()

    // Le visiteur a préfixé l'en-tête ; le proxy a ajouté sa vraie adresse.
    expect(
      await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10, 198.51.100.9' })),
    ).not.toBeNull()

    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.11' }))).not.toBeNull()
  })

  it('compte les sauts de proxy déclarés par le host', async () => {
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({
      allowedIPs: ['203.0.113.10'],
      trustedProxyHops: 2,
    })

    // CDN + load balancer : la vraie adresse est l'avant-dernière.
    expect(
      await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10, 10.0.0.7' })),
    ).toBeNull()
    // Chaîne plus courte que déclarée : on ne fait confiance à rien.
    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10' }))).not.toBeNull()
  })

  it('ignore les en-têtes de proxy quand le proxy n est pas de confiance', async () => {
    // Sans proxy de confiance, un visiteur qui forge X-Forwarded-For ne doit pas
    // pouvoir se faire passer pour une IP de la liste blanche.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ allowedIPs: ['203.0.113.10'], trustProxy: false })

    expect(await middleware(request('/blog', { 'x-forwarded-for': '203.0.113.10' }))).not.toBeNull()
  })
})

describe('middleware — cache de validation des jetons', () => {
  it('ne contacte pas Payload pour un jeton qui ne peut pas être un JWT', async () => {
    // Régression MNT-07 : chaque jeton inédit déclenchait un /me interne et
    // insérait une entrée jamais purgée dans un cache module-level.
    const { calls } = installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    expect(
      await middleware(request('/blog', { cookie: 'payload-token=Zm9vYmFyYmF6' })),
    ).not.toBeNull()
    expect(calls.some((url) => url.endsWith('/me'))).toBe(false)
  })

  it('borne le cache face à un flot de jetons aléatoires', async () => {
    installFetch({ status: maintenanceOn(), me: () => Response.json({ user: null }) })
    vi.resetModules()
    const mod = await import('../middleware/maintenanceMiddleware.js')
    const middleware = mod.createMaintenanceMiddleware({ cacheDuration: 0 })

    for (let i = 0; i < 1200; i++) {
      // Jetons de forme valide : c'est le flot que le plafond doit encaisser.
      await middleware(request('/blog', { cookie: `payload-token=${JWT_HEADER}.tok${i}.sig` }))
    }
    expect(mod.__authTokenCacheSize()).toBeLessThanOrEqual(1000)
    // 1200 allers-retours séquentiels : c'est un test de charge, pas un test
    // unitaire, d'où le délai explicite.
  }, 20_000)
})

describe('middleware — dérogation des utilisateurs connectés', () => {
  const meAnswers = (validFor: { slug: string; token: string }) => (url: string, init: RequestInit | undefined) => {
    const cookie = String((init?.headers as Record<string, string> | undefined)?.Cookie ?? '')
    const matchesSlug = url.endsWith(`/api/${validFor.slug}/me`)
    const matchesToken = cookie.includes(validFor.token)
    return Response.json({ user: matchesSlug && matchesToken ? { id: 1 } : null })
  }

  it('laisse passer un compte de la collection d administration', async () => {
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'users', token: GOOD_TOKEN }) })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).toBeNull()
  })

  it('bloque un compte que Payload ne reconnaît pas sur cette collection', async () => {
    // C'est ce qui empêche un client d'un espace client de contourner la
    // maintenance : /api/users/me répond `{ user: null }` pour son jeton.
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'users', token: GOOD_TOKEN }) })
    const middleware = await makeMiddleware()
    expect(
      await middleware(request('/blog', { cookie: `payload-token=${CUSTOMER_TOKEN}` })),
    ).not.toBeNull()
  })

  it('interroge la collection d administration configurée par le host', async () => {
    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'staff', token: GOOD_TOKEN }) })
    const onStaff = await makeMiddleware({ usersCollectionSlug: 'staff' })
    expect(await onStaff(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).toBeNull()

    installFetch({ status: maintenanceOn(), me: meAnswers({ slug: 'staff', token: GOOD_TOKEN }) })
    const onDefault = await makeMiddleware()
    expect(await onDefault(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).not.toBeNull()
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
    expect(await middleware(request('/blog', { cookie: `mysite-token=${GOOD_TOKEN}` }))).toBeNull()
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
        await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` })),
      ).not.toBeNull()

      meDown = false
      expect(await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).toBeNull()
    },
  )

  it('bloque même un administrateur quand le bypass authentifié est coupé côté global', async () => {
    installFetch({
      status: maintenanceOn({ authBypass: false }),
      me: meAnswers({ slug: 'users', token: GOOD_TOKEN }),
    })
    const middleware = await makeMiddleware()
    expect(await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).not.toBeNull()
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

describe('MNT2-02 — le compteur du ?bypass= ne doit pas être un interrupteur', () => {
  const SECRET = 'r6TqjW-secret-de-contournement'

  it('un anonyme qui martèle ne verrouille pas le lien de l exploitant', async () => {
    // Le durcissement comptait aussi dans un seau global `__all__` (100/min) :
    // 100 requêtes anonymes suffisaient à faire refuser le VRAI secret, et cette
    // tentative légitime était en plus comptée comme un échec.
    const { fetchMock } = installFetch({ status: maintenanceOn() })
    void fetchMock
    const middleware = await makeMiddleware({ bypassSecret: SECRET })

    for (let i = 0; i < 300; i++) {
      await middleware(request(`/?bypass=faux${i}`, { 'x-forwarded-for': '203.0.113.5' }))
    }

    const res = await middleware(
      request(`/?bypass=${SECRET}`, { 'x-forwarded-for': '198.51.100.7' }),
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(307)
    expect(res!.cookies.get('maintenance-bypass')?.value).toBeTruthy()
  })

  it('ne partage pas un seau « unknown » entre tous les appelants non identifiables', async () => {
    // Sans proxy renseignant x-forwarded-for, `resolveClientIP` renvoie '' :
    // l'ancienne clé de repli `'unknown'` était commune à tout le monde, donc
    // 10 requêtes suffisaient à fermer le contournement pour l'exploitant.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: SECRET })

    for (let i = 0; i < 50; i++) {
      await middleware(request(`/?bypass=faux${i}`))
    }

    const res = await middleware(request(`/?bypass=${SECRET}`))
    expect(res!.status).toBe(307)
    expect(res!.cookies.get('maintenance-bypass')?.value).toBeTruthy()
  })

  it('borne quand même le brute-force d une IP identifiable', async () => {
    // La contrepartie : un appelant qu'on sait nommer reste limité à 10 échecs
    // par minute — un budget que lui seul peut dépenser.
    installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware({ bypassSecret: SECRET })

    for (let i = 0; i < 10; i++) {
      await middleware(request(`/?bypass=faux${i}`, { 'x-forwarded-for': '203.0.113.42' }))
    }

    const bloque = await middleware(
      request(`/?bypass=${SECRET}`, { 'x-forwarded-for': '203.0.113.42' }),
    )
    expect(bloque!.status).not.toBe(307)

    // …et une autre IP, elle, n'a rien dépensé.
    const autre = await middleware(
      request(`/?bypass=${SECRET}`, { 'x-forwarded-for': '203.0.113.43' }),
    )
    expect(autre!.status).toBe(307)
  })
})

describe('MNT2-04 — amplification vers /me et éviction du cache', () => {
  it('ne contacte pas Payload pour un jeton dont l échéance est déjà passée', async () => {
    const expire = `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment({
      exp: Math.floor(Date.now() / 1000) - 3600,
    })}.c2ln`
    const { calls } = installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    expect(await middleware(request('/blog', { cookie: `payload-token=${expire}` }))).not.toBeNull()
    expect(calls.some((url) => url.endsWith('/me'))).toBe(false)
  })

  it('ne contacte pas Payload quand l en-tête du jeton n est pas un en-tête JWT', async () => {
    const { calls } = installFetch({ status: maintenanceOn() })
    const middleware = await makeMiddleware()

    // Forme à trois segments, mais premier segment qui ne décode pas en JSON
    // porteur d'un `alg` : c'est exactement le `head -c 24 /dev/urandom` du
    // scénario, qui traversait le filtre purement syntaxique.
    await middleware(request('/blog', { cookie: 'payload-token=cGFzLWpzb24.tok.sig' }))
    expect(calls.some((url) => url.endsWith('/me'))).toBe(false)
  })

  it('borne les allers-retours /me par IP identifiable', async () => {
    const { calls } = installFetch({ status: maintenanceOn(), me: () => Response.json({ user: null }) })
    const middleware = await makeMiddleware()

    for (let i = 0; i < 200; i++) {
      await middleware(
        request('/blog', {
          cookie: `payload-token=${JWT_HEADER}.flood${i}.sig`,
          'x-forwarded-for': '203.0.113.77',
        }),
      )
    }

    const meCalls = calls.filter((url) => url.endsWith('/me')).length
    expect(meCalls).toBeGreaterThan(0)
    expect(meCalls).toBeLessThanOrEqual(31)
  })

  it('un flot de jetons inconnus n évince pas la session validée d un administrateur', async () => {
    // Le plafond FIFO introduit par le durcissement était commun aux réponses
    // positives et négatives : 1000 jetons anonymes chassaient les entrées
    // `valid: true` des vrais administrateurs, renvoyés en /me à chaque page.
    const meFor = (token: string) => (_url: string, init: RequestInit | undefined) => {
      const cookie = String((init?.headers as Record<string, string> | undefined)?.Cookie ?? '')
      return Response.json({ user: cookie.includes(token) ? { id: 1 } : null })
    }
    const { calls } = installFetch({ status: maintenanceOn(), me: meFor(GOOD_TOKEN) })
    vi.resetModules()
    const mod = await import('../middleware/maintenanceMiddleware.js')
    const middleware = mod.createMaintenanceMiddleware({ cacheDuration: 0 })

    expect(await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).toBeNull()
    expect(mod.__authPositiveCacheSize()).toBe(1)

    for (let i = 0; i < 1200; i++) {
      await middleware(request('/blog', { cookie: `payload-token=${JWT_HEADER}.evict${i}.sig` }))
    }

    // L'entrée positive est toujours là, et l'administrateur repasse sans que le
    // middleware ait à redemander /me.
    expect(mod.__authPositiveCacheSize()).toBe(1)
    const avant = calls.filter((url) => url.endsWith('/me')).length
    expect(await middleware(request('/blog', { cookie: `payload-token=${GOOD_TOKEN}` }))).toBeNull()
    expect(calls.filter((url) => url.endsWith('/me')).length).toBe(avant)
  }, 20_000)
})
