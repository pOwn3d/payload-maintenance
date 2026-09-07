import type { PayloadRequest } from 'payload'

/**
 * Custom authorization check for the plugin's admin-only endpoints and for the
 * maintenance global. Lets the host app plug its own RBAC (roles, tenants...).
 */
export type AdminAccessCheck = (args: { req: PayloadRequest }) => boolean | Promise<boolean>

export interface AdminAccessOptions {
  /** Collection whose users may administer maintenance mode.
   *  Defaults to the collection Payload uses for its admin panel
   *  (`config.admin.user`). Deliberately NOT `usersCollectionSlug`: that option
   *  predates this check, only ever configured the Next.js middleware bypass,
   *  and silently repurposing it would lock hosts out of their own global. */
  adminCollectionSlug?: string
  /** Overrides the collection check entirely when provided. */
  adminAccess?: AdminAccessCheck
}

/**
 * `req.user` is NOT an authorization check: Payload populates it for a user of
 * ANY auth-enabled collection of the host app (customers, members, partners...).
 * On a site with a customer area, `!!req.user` therefore let any customer take
 * the site offline, export the subscribers (emails + IPs) or rewrite the HTML
 * served to every visitor.
 *
 * The default admin collection is the one Payload itself uses for the admin
 * panel (`config.admin.user`), so hosts that renamed `users` keep working
 * without configuring anything.
 */
export async function isMaintenanceAdmin(
  req: PayloadRequest,
  opts: AdminAccessOptions = {},
): Promise<boolean> {
  if (!req.user) return false

  if (opts.adminAccess) return Boolean(await opts.adminAccess({ req }))

  const adminCollection =
    opts.adminCollectionSlug ?? (req.payload?.config?.admin?.user as string | undefined)

  // A sanitized Payload config always sets `admin.user`. If it is somehow
  // missing, keep the previous "any authenticated user" behaviour rather than
  // locking the host out of its own maintenance switch.
  if (!adminCollection) return true

  return req.user.collection === adminCollection
}

/** Shared 401 body — kept identical to the previous inline responses. */
export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
