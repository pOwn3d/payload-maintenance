import type { CollectionConfig } from 'payload'

export function createSubscribersCollection(slug: string = 'maintenance-subscribers'): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Maintenance Subscriber', fr: 'Abonne Maintenance' },
      plural: { en: 'Maintenance Subscribers', fr: 'Abonnes Maintenance' },
    },
    admin: {
      custom: { navHidden: true },
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['email', 'language', 'subscribedAt'],
      useAsTitle: 'email',
    },
    access: {
      read: ({ req }) => !!req.user,
      create: () => true,
      update: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
    },
    fields: [
      {
        name: 'email',
        type: 'email',
        required: true,
        unique: true,
        label: { en: 'Email', fr: 'Email' },
      },
      {
        name: 'language',
        type: 'text',
        label: { en: 'Browser language', fr: 'Langue navigateur' },
        admin: { readOnly: true },
      },
      {
        name: 'subscribedAt',
        type: 'date',
        label: { en: 'Subscribed at', fr: 'Date d\'inscription' },
        defaultValue: () => new Date().toISOString(),
        admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
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
        name: 'consentAt',
        type: 'date',
        label: { en: 'Consent date', fr: 'Date de consentement' },
        admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
      },
      {
        name: 'consentSource',
        type: 'text',
        label: { en: 'Consent source', fr: 'Source du consentement' },
        admin: { readOnly: true },
      },
      {
        name: 'unsubscribeToken',
        type: 'text',
        label: { en: 'Unsubscribe token', fr: 'Token de desinscription' },
        unique: true,
        admin: { readOnly: true },
      },
    ],
  }
}
