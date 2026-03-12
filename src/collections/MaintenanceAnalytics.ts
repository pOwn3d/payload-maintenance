import type { CollectionConfig } from 'payload'

export function createAnalyticsCollection(slug: string = 'maintenance-analytics'): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Maintenance Page View', fr: 'Vue Page Maintenance' },
      plural: { en: 'Maintenance Analytics', fr: 'Analytiques Maintenance' },
    },
    admin: {
      hidden: true,
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['path', 'ip', 'timestamp'],
    },
    access: {
      read: ({ req }) => !!req.user,
      create: () => true,
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
