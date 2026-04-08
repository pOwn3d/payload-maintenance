import type { CollectionConfig } from 'payload'

export function createHistoryCollection(slug: string = 'maintenance-history'): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Maintenance Event', fr: 'Evenement Maintenance' },
      plural: { en: 'Maintenance History', fr: 'Historique Maintenance' },
    },
    admin: {
      custom: { navHidden: true },
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['action', 'triggeredBy', 'timestamp', 'duration'],
      useAsTitle: 'action',
    },
    access: {
      read: ({ req }) => !!req.user,
      create: () => true,
      update: () => false,
      delete: ({ req }) => !!req.user,
    },
    fields: [
      {
        name: 'action',
        type: 'select',
        required: true,
        label: { en: 'Action', fr: 'Action' },
        options: [
          { label: { en: 'Activated', fr: 'Active' }, value: 'activated' },
          { label: { en: 'Deactivated', fr: 'Desactive' }, value: 'deactivated' },
          { label: { en: 'Scheduled start', fr: 'Debut planifie' }, value: 'scheduled-start' },
          { label: { en: 'Scheduled end', fr: 'Fin planifiee' }, value: 'scheduled-end' },
          { label: { en: 'Config updated', fr: 'Config modifiee' }, value: 'config-updated' },
          { label: { en: 'Webhook failed', fr: 'Webhook echoue' }, value: 'webhook-failed' },
        ],
      },
      {
        name: 'triggeredBy',
        type: 'text',
        label: { en: 'Triggered by', fr: 'Declenche par' },
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
        name: 'duration',
        type: 'text',
        label: { en: 'Duration', fr: 'Duree' },
        admin: {
          readOnly: true,
          description: {
            en: 'Duration of the maintenance period (calculated on deactivation)',
            fr: 'Duree de la periode de maintenance (calculee a la desactivation)',
          },
        },
      },
      {
        name: 'details',
        type: 'json',
        label: { en: 'Details', fr: 'Details' },
        admin: { readOnly: true },
      },
    ],
  }
}
