import type { CollectionConfig } from 'payload'
import { isMaintenanceAdmin, type AdminAccessOptions } from '../utils/access.js'

export function createAnalyticsCollection(
  slug: string = 'maintenance-analytics',
  adminOptions: AdminAccessOptions = {},
): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Maintenance Page View', fr: 'Vue Page Maintenance' },
      plural: { en: 'Maintenance Analytics', fr: 'Analytiques Maintenance' },
    },
    admin: {
      custom: { navHidden: true },
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['path', 'ip', 'timestamp'],
    },
    access: {
      // `!!req.user` is NOT authorization: Payload populates req.user for a
      // member of ANY auth collection of the host app. On a site with a
      // customer area, that let a logged-in customer read this collection over
      // the auto-generated REST API and delete rows from it — `navHidden` only
      // hides the nav entry, it does not close /api/<slug>.
      read: ({ req }) => isMaintenanceAdmin(req, adminOptions),
      // Writes come from the plugin's own endpoints via the Local API
      // (payload.create defaults to overrideAccess: true), so closing this
      // does not break the public newsletter/tracking flows — it only stops
      // anonymous or non-admin POST /api/<slug> from forging rows.
      create: ({ req }) => isMaintenanceAdmin(req, adminOptions),
      update: () => false,
      delete: ({ req }) => isMaintenanceAdmin(req, adminOptions),
    },
    fields: [
      {
        name: 'path',
        type: 'text',
        required: true,
        label: { en: 'Path', fr: 'Chemin' },
        admin: { readOnly: true },
      },
      {
        name: 'ip',
        type: 'text',
        label: { en: 'IP Address', fr: 'Adresse IP' },
        admin: { readOnly: true },
      },
      {
        name: 'userAgent',
        type: 'text',
        label: { en: 'User Agent', fr: 'User Agent' },
        admin: { readOnly: true },
      },
      {
        name: 'referer',
        type: 'text',
        label: { en: 'Referer', fr: 'Referent' },
        admin: { readOnly: true },
      },
      {
        name: 'timestamp',
        type: 'date',
        required: true,
        label: { en: 'Timestamp', fr: 'Horodatage' },
        defaultValue: () => new Date().toISOString(),
        admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
      },
      {
        // Declared but never written: no code path in the plugin resolves a
        // country. Filling it would mean geolocating the caller's IP — one more
        // personal datum, and most likely a third-party lookup, in the very
        // collection whose footprint is being reduced. It stays inert on
        // purpose; dropping the column is a schema change and waits for v1.0.0.
        name: 'country',
        type: 'text',
        label: { en: 'Country (unused)', fr: 'Pays (non utilise)' },
        admin: {
          readOnly: true,
          description: {
            en: 'Never populated — the plugin does no IP geolocation.',
            fr: 'Jamais renseigne — le plugin ne fait aucune geolocalisation d IP.',
          },
        },
      },
    ],
  }
}
