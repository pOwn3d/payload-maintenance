import type { CollectionConfig } from 'payload'
import { isMaintenanceAdmin, type AdminAccessOptions } from '../utils/access.js'

export function createWebhookLogsCollection(
  slug: string = 'maintenance-webhook-logs',
  adminOptions: AdminAccessOptions = {},
): CollectionConfig {
  return {
    slug,
    labels: {
      singular: { en: 'Webhook Log', fr: 'Log Webhook' },
      plural: { en: 'Webhook Logs', fr: 'Logs Webhook' },
    },
    admin: {
      custom: { navHidden: true },
      group: { en: 'Settings', fr: 'Parametres' },
      defaultColumns: ['webhookUrl', 'webhookType', 'action', 'status', 'timestamp'],
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
