import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression — MNT-VIEW-01.
 *
 * `/admin/maintenance` is registered as a CUSTOM admin view, and
 * `@payloadcms/next` explicitly skips its own `canAccessAdmin` redirect for
 * those (`isCustomAdminView`): authorization is delegated to the view. The view
 * only checked `!!req.user`, which Payload populates for a member of ANY
 * auth-enabled collection of the host app — so a `customers` account created by
 * public sign-up walked into the admin panel and rendered the maintenance
 * dashboard, while every other admin route refuses it.
 */

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    // Mirrors Next.js: `redirect()` never returns, it throws.
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: () => null,
}))

/**
 * The view reaches its client subtree through this shim (it is the only module
 * re-exported from the package's `./client` build, the one carrying the
 * "use client" banner). Both members are stubbed: `MaintenanceErrorBoundary`
 * has to exist, otherwise the JSX element type is `undefined` and the view
 * throws before it ever reaches the authorization checks below.
 */
vi.mock('../views/MaintenanceViewClient.js', () => ({
  MaintenanceViewClient: () => null,
  MaintenanceErrorBoundary: ({ children }: { children?: unknown }) => children ?? null,
}))

const { MaintenanceView } = await import('../views/MaintenanceView.js')

type ViewProps = Parameters<typeof MaintenanceView>[0]

interface Fixture {
  /** Plugin option: overrides the collection check entirely. */
  adminAccess?: (args: { req: PayloadRequest }) => boolean | Promise<boolean>
  /** Plugin option: which collection administers maintenance. */
  adminCollectionSlug?: string
  /** Host option: the collection Payload uses for its admin panel. */
  adminUserCollection?: string
  /** Payload's own verdict; defaults to what Payload would actually compute. */
  canAccessAdmin?: boolean
  /** Host option: a renamed admin route. */
  adminRoute?: string
}

const makeProps = (user: Record<string, unknown> | null, fixture: Fixture = {}): ViewProps => {
  const adminUserCollection = fixture.adminUserCollection ?? 'users'

  return {
    adminAccess: fixture.adminAccess,
    adminCollectionSlug: fixture.adminCollectionSlug,
    initPageResult: {
      locale: undefined,
      permissions: {
        // Payload sets this to false for any collection but `config.admin.user`.
        canAccessAdmin: fixture.canAccessAdmin ?? user?.collection === adminUserCollection,
      },
      req: {
        i18n: {},
        payload: {
          config: {
            admin: { user: adminUserCollection },
            routes: { admin: fixture.adminRoute ?? '/admin' },
          },
        },
        user,
      },
      visibleEntities: { collections: [], globals: [] },
    },
  } as unknown as ViewProps
}

/** Renders the view, reporting the redirect target instead of the thrown error. */
const render = async (props: ViewProps): Promise<'RENDERED' | string> => {
  try {
    await MaintenanceView(props)
    return 'RENDERED'
  } catch (err) {
    const message = (err as Error).message
    if (message.startsWith('NEXT_REDIRECT:')) return message.replace('NEXT_REDIRECT:', '')
    throw err
  }
}

describe('MaintenanceView — garde d autorisation de la vue admin', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('refuse un compte d une autre collection d auth (customers)', async () => {
    expect(await render(makeProps({ collection: 'customers' }))).toBe('/admin/unauthorized')
  })

  it('laisse passer un admin de la collection admin du site', async () => {
    expect(await render(makeProps({ collection: 'users' }))).toBe('RENDERED')
  })

  it('renvoie vers le login quand personne n est authentifie', async () => {
    expect(await render(makeProps(null))).toBe('/admin/login')
  })

  it('refuse un admin a qui Payload a refuse l acces au panneau', async () => {
    // Same collection as `config.admin.user`, but the host's `access.admin`
    // returned false (deactivated account, "no panel" role...).
    expect(await render(makeProps({ collection: 'users' }, { canAccessAdmin: false }))).toBe(
      '/admin/unauthorized',
    )
  })

  it('suit la collection admin du site quand elle a ete renommee', async () => {
    // `adminCollectionSlug` par défaut = `config.admin.user`.
    expect(await render(makeProps({ collection: 'staff' }, { adminUserCollection: 'staff' }))).toBe(
      'RENDERED',
    )
    expect(
      await render(makeProps({ collection: 'customers' }, { adminUserCollection: 'staff' })),
    ).toBe('/admin/unauthorized')
  })

  it('honore un adminAccess personnalise a l interieur du panneau admin', async () => {
    const adminAccess = ({ req }: { req: PayloadRequest }) =>
      (req.user as unknown as { role?: string })?.role === 'ops'

    expect(await render(makeProps({ collection: 'users', role: 'ops' }, { adminAccess }))).toBe(
      'RENDERED',
    )
    expect(await render(makeProps({ collection: 'users', role: 'editor' }, { adminAccess }))).toBe(
      '/admin/unauthorized',
    )
  })

  it('refuse la vue meme avec un adminAccess permissif si Payload ferme le panneau', async () => {
    // Rupture assumée : un `adminAccess` qui ouvre la maintenance à une autre
    // collection continue d autoriser les endpoints, mais pas cette PAGE du
    // panneau admin — Payload refuse ce compte partout ailleurs dans /admin.
    const adminAccess = () => true
    expect(await render(makeProps({ collection: 'customers' }, { adminAccess }))).toBe(
      '/admin/unauthorized',
    )
  })

  it('utilise la route admin du site quand elle est personnalisee', async () => {
    expect(
      await render(makeProps({ collection: 'customers' }, { adminRoute: '/back-office' })),
    ).toBe('/back-office/unauthorized')
  })
})
