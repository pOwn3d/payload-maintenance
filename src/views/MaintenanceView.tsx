import type { AdminViewServerProps } from 'payload'
// @ts-ignore — @payloadcms/next is a peer dependency
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
// @ts-ignore — next is a peer dependency
import { redirect } from 'next/navigation'
import { MaintenanceViewClient } from './MaintenanceViewClient.js'
import { isMaintenanceAdmin, type AdminAccessOptions } from '../utils/access.js'

/**
 * The plugin passes its admin authorization options to this view through
 * `Component.serverProps` (see `plugin.ts`), because a custom admin view gets
 * no access to the plugin config otherwise.
 */
export type MaintenanceViewProps = AdminAccessOptions & AdminViewServerProps

export const MaintenanceView = async (
  props: MaintenanceViewProps,
): Promise<React.ReactElement | null> => {
  const { adminAccess, adminCollectionSlug, initPageResult } = props
  const req = initPageResult?.req
  const adminRoute = (req?.payload?.config?.routes?.admin as string | undefined) ?? '/admin'

  if (!req?.user) {
    redirect(`${adminRoute}/login`)
    return null
  }

  // Payload deliberately SKIPS its own `canAccessAdmin` redirect for custom
  // admin views — `@payloadcms/next` guards the admin panel with
  // `if (!permissions.canAccessAdmin && !isPublicAdminRoute(...) && !isCustomAdminView(...))`,
  // and `/admin/maintenance` matches `isCustomAdminView`. Authorization for this
  // route is therefore entirely delegated to this component.
  //
  // `!!req.user` is NOT that authorization: Payload populates `req.user` from a
  // single `payload-token` cookie for a member of ANY auth-enabled collection of
  // the host app (customers, members, partners...). Such an account is refused
  // everywhere else in the panel (`canAccessAdmin === false`) but used to walk
  // straight into this view and get the admin chrome plus the maintenance panel.
  //
  // Two conditions, both required:
  //  - Payload's own panel verdict (`canAccessAdmin`), which is what every other
  //    admin route enforces. It is `false` for any collection other than
  //    `config.admin.user`, and also for an admin-collection account the host's
  //    `access.admin` turns down (deactivated account, "no panel" role...).
  //  - the plugin's own gate, identical to the one on `/toggle`, `/stats`,
  //    `/subscribers/export` and the maintenance global.
  // `!== false` (rather than `=== true`) keeps the view working should a future
  // Payload version stop populating `permissions` for a custom view.
  const authorized =
    initPageResult.permissions?.canAccessAdmin !== false &&
    (await isMaintenanceAdmin(req, { adminAccess, adminCollectionSlug }))

  if (!authorized) {
    redirect(`${adminRoute}/unauthorized`)
    return null
  }

  const { visibleEntities, permissions, locale } = initPageResult

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={{}}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={{}}
      user={req.user!}
      visibleEntities={visibleEntities}
    >
      <MaintenanceViewClient />
    </DefaultTemplate>
  )
}
