import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { isMaintenanceAdmin, unauthorizedResponse } from '../utils/access.js'

/**
 * Minimal stand-in for a Payload request: the guard only ever reads `req.user`
 * and the sanitized config's `admin.user`.
 */
function makeReq(opts: {
  user?: { collection: string; role?: string } | null
  adminCollection?: string | null
}): PayloadRequest {
  return {
    user: opts.user ?? null,
    payload: {
      config: {
        admin: opts.adminCollection === null ? {} : { user: opts.adminCollection ?? 'users' },
      },
    },
  } as unknown as PayloadRequest
}

describe('isMaintenanceAdmin — qui a le droit de couper le site', () => {
  it('refuse un visiteur non authentifié', async () => {
    await expect(isMaintenanceAdmin(makeReq({ user: null }))).resolves.toBe(false)
  })

  it('accepte un utilisateur de la collection qui administre le panneau Payload', async () => {
    const req = makeReq({ user: { collection: 'users' }, adminCollection: 'users' })
    await expect(isMaintenanceAdmin(req)).resolves.toBe(true)
  })

  it('refuse un compte authentifié d une autre collection, comme un client d espace client', async () => {
    // Régression : `!!req.user` suffisait, donc n'importe quel client connecté
    // pouvait couper le site, exporter les abonnés (emails + IP) ou réécrire le
    // HTML servi à tous les visiteurs.
    const req = makeReq({ user: { collection: 'customers' }, adminCollection: 'users' })
    await expect(isMaintenanceAdmin(req)).resolves.toBe(false)
  })

  it('suit la collection admin renommée par le host sans configuration supplémentaire', async () => {
    const staff = makeReq({ user: { collection: 'staff' }, adminCollection: 'staff' })
    const legacy = makeReq({ user: { collection: 'users' }, adminCollection: 'staff' })
    await expect(isMaintenanceAdmin(staff)).resolves.toBe(true)
    await expect(isMaintenanceAdmin(legacy)).resolves.toBe(false)
  })

  it('donne la priorité à adminCollectionSlug sur la collection du panneau', async () => {
    const req = makeReq({ user: { collection: 'operators' }, adminCollection: 'users' })
    await expect(isMaintenanceAdmin(req, { adminCollectionSlug: 'operators' })).resolves.toBe(true)
    await expect(isMaintenanceAdmin(req, { adminCollectionSlug: 'users' })).resolves.toBe(false)
  })

  it('reste permissif si la config n expose aucune collection admin, plutôt que de verrouiller le host', async () => {
    const req = makeReq({ user: { collection: 'whatever' }, adminCollection: null })
    await expect(isMaintenanceAdmin(req)).resolves.toBe(true)
  })
})

describe('isMaintenanceAdmin — RBAC délégué au host', () => {
  it('laisse un contrôle personnalisé trancher, y compris contre la collection', async () => {
    const check = ({ req }: { req: PayloadRequest }) =>
      (req.user as unknown as { role?: string })?.role === 'admin'

    const admin = makeReq({ user: { collection: 'users', role: 'admin' } })
    const editor = makeReq({ user: { collection: 'users', role: 'editor' } })

    await expect(isMaintenanceAdmin(admin, { adminAccess: check })).resolves.toBe(true)
    await expect(isMaintenanceAdmin(editor, { adminAccess: check })).resolves.toBe(false)
  })

  it('autorise un contrôle personnalisé asynchrone', async () => {
    const req = makeReq({ user: { collection: 'partners' }, adminCollection: 'users' })
    await expect(isMaintenanceAdmin(req, { adminAccess: async () => true })).resolves.toBe(true)
  })

  it('ne consulte jamais le contrôle personnalisé pour un anonyme', async () => {
    // Le host ne doit pas avoir à se souvenir de tester `req.user` lui-même :
    // un contrôle naïf qui renvoie true ouvrirait sinon l endpoint à tout le web.
    const check = vi.fn(() => true)
    await expect(isMaintenanceAdmin(makeReq({ user: null }), { adminAccess: check })).resolves.toBe(
      false,
    )
    expect(check).not.toHaveBeenCalled()
  })

  it('ignore adminCollectionSlug quand un contrôle personnalisé est fourni', async () => {
    const req = makeReq({ user: { collection: 'users' }, adminCollection: 'users' })
    await expect(
      isMaintenanceAdmin(req, { adminCollectionSlug: 'users', adminAccess: () => false }),
    ).resolves.toBe(false)
  })
})

describe('unauthorizedResponse', () => {
  it('répond 401 avec un corps JSON stable pour les clients existants', async () => {
    const res = unauthorizedResponse()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })
})
