import type { Config, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { maintenancePlugin } from '../plugin.js'
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
