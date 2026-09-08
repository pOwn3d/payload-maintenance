import type { CollectionConfig, PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { createAnalyticsCollection } from '../collections/MaintenanceAnalytics.js'
import { createHistoryCollection } from '../collections/MaintenanceHistory.js'
import { createSubscribersCollection } from '../collections/MaintenanceSubscribers.js'
import { createWebhookLogsCollection } from '../collections/WebhookLogs.js'

/**
 * Payload auto-generates a REST route per collection. `admin.custom.navHidden`
 * only hides the nav entry, so the `access` block is the only thing standing
 * between a logged-in front-office customer and these four tables.
 */
function makeReq(collection: string | null): PayloadRequest {
  return {
    user: collection ? { id: 1, collection } : null,
    payload: { config: { admin: { user: 'users' } } },
  } as unknown as PayloadRequest
}

const collections: Array<[string, CollectionConfig]> = [
  ['analytics', createAnalyticsCollection('maintenance-analytics')],
  ['history', createHistoryCollection('maintenance-history')],
  ['subscribers', createSubscribersCollection('maintenance-subscribers')],
  ['webhook-logs', createWebhookLogsCollection('maintenance-webhook-logs')],
]

const call = async (fn: unknown, req: PayloadRequest): Promise<boolean> =>
  Boolean(await (fn as (args: { req: PayloadRequest }) => unknown)({ req }))

describe('collections du plugin — qui peut lire et supprimer', () => {
  for (const [name, collection] of collections) {
    it(`${name} : un client d un espace client authentifié ne peut ni lire ni supprimer`, async () => {
      // Régression MNT-01 : les quatre collections étaient en `!!req.user`, ce
      // qui suffit pour n'importe quelle collection d'auth du site hôte.
      // GET /api/maintenance-webhook-logs rendait les URLs Slack/Discord en
      // clair, GET /api/maintenance-subscribers le fichier RGPD complet, et
      // DELETE effaçait la piste d'audit.
      const customer = makeReq('customers')
      expect(await call(collection.access?.read, customer)).toBe(false)
      expect(await call(collection.access?.delete, customer)).toBe(false)
      expect(await call(collection.access?.create, customer)).toBe(false)
    })

    it(`${name} : un anonyme n a aucun accès`, async () => {
      const anon = makeReq(null)
      expect(await call(collection.access?.read, anon)).toBe(false)
      expect(await call(collection.access?.create, anon)).toBe(false)
      expect(await call(collection.access?.delete, anon)).toBe(false)
    })

    it(`${name} : un administrateur du panneau garde l accès`, async () => {
      const admin = makeReq('users')
      expect(await call(collection.access?.read, admin)).toBe(true)
      expect(await call(collection.access?.delete, admin)).toBe(true)
    })
  }

  it('respecte le RBAC délégué par le host', async () => {
    const collection = createSubscribersCollection('maintenance-subscribers', {
      adminAccess: ({ req }) => (req.user as unknown as { role?: string })?.role === 'ops',
    })
    const ops = { user: { id: 1, collection: 'partners', role: 'ops' } } as unknown as PayloadRequest
    const other = { user: { id: 2, collection: 'users', role: 'sales' } } as unknown as PayloadRequest
    expect(await call(collection.access?.read, ops)).toBe(true)
    expect(await call(collection.access?.read, other)).toBe(false)
  })

  it('suit la collection admin renommée par le host', async () => {
    const collection = createWebhookLogsCollection('maintenance-webhook-logs', {
      adminCollectionSlug: 'staff',
    })
    const staff = { user: { id: 1, collection: 'staff' } } as unknown as PayloadRequest
    const users = { user: { id: 1, collection: 'users' } } as unknown as PayloadRequest
    expect(await call(collection.access?.read, staff)).toBe(true)
    expect(await call(collection.access?.read, users)).toBe(false)
  })

  it('laisse les écritures internes du plugin passer (API locale, overrideAccess)', () => {
    // Les endpoints publics écrivent via `payload.create(...)` sans `req`, donc
    // en overrideAccess: true. Fermer `create` ne casse pas /newsletter ni
    // /track — c'est le POST direct sur /api/<slug> qui est refusé.
    const subscribers = createSubscribersCollection('maintenance-subscribers')
    expect(typeof subscribers.access?.create).toBe('function')
  })
})
