import type { CollectionConfig } from 'payload'

export function createAnalyticsCollection(slug: string = 'maintenance-analytics'): CollectionConfig {
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
      read: ({ req }) => !!req.user,
      // Writes come from the plugin's own endpoints via the Local API
      // (payload.create defaults to overrideAccess: true), so closing this
      // does not break the public newsletter/tracking flows — it only stops
      // anonymous POST /api/<slug> from forging rows.
      create: ({ req }) => !!req.user,
      update: () => false,
      delete: ({ req }) => !!req.user,
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
        name: 'country',
        type: 'text',
        label: { en: 'Country', fr: 'Pays' },
        admin: { readOnly: true },
      },
    ],
  }
}
