import type { Config, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { maintenancePlugin, RETENTION_TASK_SLUG } from '../plugin.js'
import { timingSafeEqualString, signBypassToken, verifyBypassToken } from '../utils/bypassToken.js'

const baseConfig = (): Config =>
  ({ admin: { user: 'users' }, collections: [], globals: [], endpoints: [] }) as unknown as Config

const call = async (fn: unknown, user: { collection: string } | null): Promise<boolean> =>
  Boolean(
    await (fn as (args: { req: PayloadRequest }) => unknown)({
      req: {
        user,
        payload: { config: { admin: { user: 'users' } } },
      } as unknown as PayloadRequest,
    }),
  )

describe('plugin — câblage de l autorisation vers les collections', () => {
  it('transmet la garde admin aux quatre collections, pas seulement au global', async () => {
    // Régression MNT-01 : le correctif du global n avait pas été propagé, et
    // `plugin.ts` ne passait que le slug aux `create*Collection()`.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = (await maintenancePlugin({})(baseConfig())) as Config
    const slugs = (config.collections ?? []).map((c) => c.slug)
    expect(slugs).toEqual(
      expect.arrayContaining([
        'maintenance-subscribers',
        'maintenance-history',
        'maintenance-analytics',
        'maintenance-webhook-logs',
      ]),
    )

    for (const collection of config.collections ?? []) {
      expect(await call(collection.access?.read, { collection: 'customers' })).toBe(false)
      expect(await call(collection.access?.read, { collection: 'users' })).toBe(true)
    }

    const global = (config.globals ?? []).find((g) => g.slug === 'maintenance')
    expect(await call(global?.access?.read, { collection: 'customers' })).toBe(false)
  })

  it('propage un adminAccess personnalisé jusqu aux collections', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = (await maintenancePlugin({
      adminAccess: ({ req }) => (req.user as unknown as { collection?: string })?.collection === 'ops',
    })(baseConfig())) as Config

    for (const collection of config.collections ?? []) {
      expect(await call(collection.access?.read, { collection: 'ops' })).toBe(true)
      expect(await call(collection.access?.read, { collection: 'users' })).toBe(false)
    }
  })

  it('transmet la garde admin a la vue /admin/maintenance', async () => {
    // Régression MNT-VIEW-01 : la vue custom est le SEUL point d autorisation de
    // /admin/maintenance (Payload saute son propre `canAccessAdmin` pour les vues
    // custom), et elle n a aucun autre moyen de lire la config du plugin.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adminAccess = () => true
    const config = (await maintenancePlugin({
      adminAccess,
      adminCollectionSlug: 'staff',
    })(baseConfig())) as Config

    const view = (config.admin?.components?.views as Record<string, { Component: unknown }>)
      ?.maintenance
    const component = view?.Component as {
      exportName?: string
      path?: string
      serverProps?: { adminAccess?: unknown; adminCollectionSlug?: unknown }
    }

    expect(component?.serverProps?.adminAccess).toBe(adminAccess)
    expect(component?.serverProps?.adminCollectionSlug).toBe('staff')
    // L identité dans l import map ne doit pas bouger : un importMap.js déjà
    // généré chez un consommateur doit continuer à résoudre la vue.
    expect(`${component?.path}#${component?.exportName}`).toBe(
      '@consilioweb/payload-maintenance/views#MaintenanceView',
    )
  })
})

const endpointsOf = (config: Config) =>
  (config.endpoints ?? []).map((e) => `${String(e.method).toUpperCase()} ${e.path}`)

describe('plugin — purge de rétention', () => {
  it('expose DELETE /analytics/purge, réservé à l administrateur', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = (await maintenancePlugin({})(baseConfig())) as Config

    expect(endpointsOf(config)).toContain('DELETE /maintenance/analytics/purge')

    const purge = (config.endpoints ?? []).find(
      (e) => e.path === '/maintenance/analytics/purge',
    )
    const res = await (purge?.handler as (req: unknown) => Promise<Response>)({
      user: { collection: 'customers' },
      payload: { config: { admin: { user: 'users' } } },
    })
    expect(res.status).toBe(401)
  })

  it('reste disponible quand les analytics sont désactivées', async () => {
    // `subscribersRetentionDays` peut être posé sans analytics : sans cet
    // enregistrement inconditionnel, l option n aurait aucun déclencheur manuel.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = (await maintenancePlugin({ enableAnalytics: false })(baseConfig())) as Config

    const paths = endpointsOf(config)
    expect(paths).toContain('DELETE /maintenance/analytics/purge')
    expect(paths).not.toContain('POST /maintenance/track')
  })

  it('n enregistre la tâche Payload Jobs que si l hôte a déjà le système de jobs', async () => {
    // Ajouter la clé `jobs` nous-mêmes matérialiserait la collection
    // `payload-jobs` — un changement de schéma — chez des hôtes qui ne l ont
    // jamais demandée. L endpoint reste la voie de repli.
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const sansJobs = (await maintenancePlugin({})(baseConfig())) as Config
    expect(sansJobs.jobs).toBeUndefined()

    const hôte = { ...baseConfig(), jobs: { tasks: [] } } as unknown as Config
    const avecJobs = (await maintenancePlugin({})(hôte)) as Config
    const tasks = (avecJobs.jobs?.tasks ?? []) as { slug?: string; schedule?: unknown[] }[]
    const purge = tasks.find((t) => t.slug === RETENTION_TASK_SLUG)
    expect(purge).toBeDefined()
    expect(purge?.schedule).toHaveLength(1)
  })

  it('laisse la main à un hôte qui déclare déjà une tâche du même slug', async () => {
    // Deux tâches de même slug est une erreur de démarrage Payload, et c est la
    // sienne que son propre code met en file.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sienne = { slug: RETENTION_TASK_SLUG, handler: () => ({ output: {} }) }
    const hôte = { ...baseConfig(), jobs: { tasks: [sienne] } } as unknown as Config

    const config = (await maintenancePlugin({})(hôte)) as Config
    const tasks = (config.jobs?.tasks ?? []) as unknown[]
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toBe(sienne)
  })
})

describe('plugin — option authBypass', () => {
  const authBypassField = (config: Config) => {
    const global = (config.globals ?? []).find((g) => g.slug === 'maintenance')
    const stack: unknown[] = [...(global?.fields ?? [])]
    while (stack.length) {
      const field = stack.shift() as Record<string, unknown>
      if (field?.name === 'authBypass') return field
      for (const key of ['fields', 'tabs']) {
        const nested = field?.[key]
        if (Array.isArray(nested)) stack.push(...nested)
      }
    }
    return undefined
  }

  it('amorce la case à cocher du global, la seule des six options middleware qui soit câblable', async () => {
    // Avant : l option n avait AUCUN effet, le plugin se contentait d avertir.
    // Elle alimente maintenant le `defaultValue` de la case que /status publie
    // et que le middleware honore — sans exposer de secret ni ouvrir de route.
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(authBypassField((await maintenancePlugin({})(baseConfig())) as Config)?.defaultValue).toBe(
      true,
    )
    expect(
      authBypassField((await maintenancePlugin({ authBypass: false })(baseConfig())) as Config)
        ?.defaultValue,
    ).toBe(false)
  })

  it('avertit de la portée réelle plutôt que de prétendre n avoir aucun effet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await maintenancePlugin({ authBypass: false })(baseConfig())

    const messages = warn.mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes('authBypass') && m.includes('default value'))).toBe(true)
    // L ancien message, faux depuis que l option est lue.
    expect(
      messages.some((m) => m.includes('authBypass') && m.includes('has no effect')),
    ).toBe(false)
  })
})

describe('bypassToken', () => {
  it('compare en temps constant sans court-circuiter sur la longueur', () => {
    expect(timingSafeEqualString('s3cret', 's3cret')).toBe(true)
    expect(timingSafeEqualString('s3cret', 's3crea')).toBe(false)
    expect(timingSafeEqualString('s3cret', 's')).toBe(false)
    expect(timingSafeEqualString('', '')).toBe(true)
  })

  it('signe une preuve vérifiable et datée, jamais un booléen', async () => {
    const token = await signBypassToken('s3cret', Date.now() + 60_000)
    expect(token).not.toBe('true')
    expect(await verifyBypassToken('s3cret', token)).toBe(true)
    expect(await verifyBypassToken('autre', token)).toBe(false)
    expect(await verifyBypassToken('s3cret', 'true')).toBe(false)
    expect(await verifyBypassToken('', token)).toBe(false)
  })

  it('refuse une échéance repoussée à la main', async () => {
    const token = await signBypassToken('s3cret', Date.now() + 1000)
    const forged = `${Date.now() + 999_999}.${token.split('.')[1]}`
    expect(await verifyBypassToken('s3cret', forged)).toBe(false)
  })
})
