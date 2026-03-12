import type { CollectionConfig } from 'payload'

export function createWebhookLogsCollection(slug: string = 'maintenance-webhook-logs'): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Webhook Log', fr: 'Log Webhook' },
      plural: { en: 'Webhook Logs', fr: 'Logs Webhook' },
    },
    admin: {
      hidden: true,
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['webhookUrl', 'webhookType', 'action', 'status', 'timestamp'],
    },
    access: {
      read: ({ req }) => !!req.user,
      create: () => true,
      update: () => false,
      delete: ({ req }) => !!req.user,
    },
    fields: [
      {
        name: 'webhookUrl',
        type: 'text',
        required: true,
        label: { en: 'Webhook URL', fr: 'URL Webhook' },
        admin: { readOnly: true },
      },
      {
        name: 'webhookType',
        type: 'select',
        required: true,
        label: { en: 'Webhook Type', fr: 'Type Webhook' },
        options: [
          { label: 'Slack', value: 'slack' },
          { label: 'Discord', value: 'discord' },
          { label: { en: 'Custom', fr: 'Personnalise' }, value: 'custom' },
        ],
        admin: { readOnly: true },
      },
      {
        name: 'action',
        type: 'text',
        required: true,
        label: { en: 'Action', fr: 'Action' },
        admin: { readOnly: true },
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        label: { en: 'Status', fr: 'Statut' },
        options: [
          { label: { en: 'Success', fr: 'Succes' }, value: 'success' },
          { label: { en: 'Failed', fr: 'Echoue' }, value: 'failed' },
        ],
        admin: { readOnly: true },
      },
      {
        name: 'statusCode',
        type: 'number',
        label: { en: 'Status Code', fr: 'Code Statut' },
        admin: { readOnly: true },
      },
      {
        name: 'responseBody',
        type: 'textarea',
        label: { en: 'Response Body', fr: 'Corps de Reponse' },
        admin: { readOnly: true },
      },
      {
        name: 'attempts',
        type: 'number',
        required: true,
        label: { en: 'Attempts', fr: 'Tentatives' },
        defaultValue: 1,
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
    ],
  }
}
