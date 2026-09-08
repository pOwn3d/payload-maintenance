import type { FieldAccess, GlobalConfig } from 'payload'
import type { MaintenancePluginConfig } from '../types.js'
import { isMaintenanceAdmin } from '../utils/access.js'
import { assertPublicHttpUrl } from '../utils/ssrf.js'

export function createMaintenanceGlobal(
  pluginConfig: MaintenancePluginConfig = {},
): GlobalConfig {
  const slug = pluginConfig.globalSlug ?? 'maintenance'
  const mediaSlug = pluginConfig.mediaCollectionSlug ?? 'media'
  const languages = pluginConfig.languages ?? [
    { label: 'Francais', value: 'fr' },
    { label: 'English', value: 'en' },
  ]
  const enableScheduling = pluginConfig.enableScheduling !== false
  const historySlug = pluginConfig.historySlug ?? 'maintenance-history'
  const enableHistory = pluginConfig.enableHistory !== false
  const webhookLogsSlug = pluginConfig.webhookLogsSlug ?? 'maintenance-webhook-logs'
  const allowedWebhookHosts = pluginConfig.allowedWebhookHosts
  const adminOptions = {
    adminCollectionSlug: pluginConfig.adminCollectionSlug,
    adminAccess: pluginConfig.adminAccess,
  }
  /** Field-level guard for the credentials stored on this global. */
  const readAdminOnly: FieldAccess = ({ req }) => isMaintenanceAdmin(req, adminOptions)
  const adminOnlyField = { read: readAdminOnly }

  return {
    slug,
    label: {
      en: 'Maintenance Mode',
      fr: 'Mode Maintenance',
    },
    access: {
      // Admin-only: this global holds webhook URLs, allowedIPs and bypassSecret.
      // `!!req.user` was not enough — Payload populates req.user for a member of
      // ANY auth collection of the host app (customers, members...).
      // Public consumers must use GET /api/<route>/status, which returns a
      // curated subset and never exposes those fields.
      read: ({ req }) => isMaintenanceAdmin(req, adminOptions),
      update: ({ req }) => isMaintenanceAdmin(req, adminOptions),
    },
    hooks: {
      afterChange: [
        async ({ doc, previousDoc, req }) => {
          // Log history on toggle
          if (enableHistory && doc.enabled !== previousDoc?.enabled) {
            try {
              const action = doc.enabled ? 'activated' : 'deactivated'
              const triggeredBy = req.user?.email || 'system'

              // Calculate duration if deactivating
              let duration: string | undefined
              if (!doc.enabled && previousDoc?.enabled) {
                const lastActivation = await req.payload.find({
                  collection: historySlug as any,
                  where: { action: { equals: 'activated' } },
                  sort: '-timestamp',
                  limit: 1,
                })
                if (lastActivation.docs[0]?.timestamp) {
                  const start = new Date(lastActivation.docs[0].timestamp as string).getTime()
                  const end = Date.now()
                  const diffMs = end - start
                  const hours = Math.floor(diffMs / 3600000)
                  const minutes = Math.floor((diffMs % 3600000) / 60000)
                  duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
                }
              }

              await req.payload.create({
                collection: historySlug as any,
                data: {
                  action,
                  triggeredBy,
                  timestamp: new Date().toISOString(),
                  duration,
                  details: {
                    template: doc.template,
                    messagesCount: doc.messages?.length || 0,
                  },
                },
              })

              // Fire webhooks with retry and logging
              const webhooks = doc.webhooks as any[]
              if (webhooks?.length) {
                for (const webhook of webhooks) {
                  if (!webhook.enabled || !webhook.url) continue
                  fireWebhook(webhook, action, triggeredBy, req.payload.logger, req.payload, webhookLogsSlug, historySlug, allowedWebhookHosts).catch(() => {})
                }
              }
            } catch (e) {
              req.payload.logger.error(`[maintenance] History/webhook error: ${e}`)
            }
          }
        },
      ],
    },
    admin: {
      custom: { navHidden: true },
    },
    fields: [
      // ─── Activation ───
      {
        type: 'row',
        fields: [
          {
            name: 'showDashboardToggle',
            type: 'checkbox',
            label: {
              en: 'Show toggle on main dashboard',
              fr: 'Afficher le toggle sur le tableau de bord',
            },
            defaultValue: true,
            admin: {
              width: '100%',
              description: {
                en: 'Display the maintenance status toggle on the main admin dashboard (/admin)',
                fr: 'Affiche le toggle de statut maintenance sur le tableau de bord principal (/admin)',
              },
            },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'enabled',
            type: 'checkbox',
            label: {
              en: 'Enable maintenance mode',
              fr: 'Activer le mode maintenance',
            },
            defaultValue: false,
            admin: {
              width: '50%',
              description: {
                en: 'When enabled, all frontend pages show the maintenance page. Admin remains accessible.',
                fr: 'Lorsqu\'active, toutes les pages frontend affichent la page de maintenance. L\'admin reste accessible.',
              },
            },
          },
          {
            name: 'template',
            type: 'select',
            label: {
              en: 'Page template',
              fr: 'Template de page',
            },
            defaultValue: 'minimal',
            options: [
              { label: { en: 'Minimal', fr: 'Minimal' }, value: 'minimal' },
              { label: { en: 'Countdown', fr: 'Compte a rebours' }, value: 'countdown' },
              { label: { en: 'Coming Soon', fr: 'Bientot disponible' }, value: 'coming-soon' },
              { label: { en: 'Glassmorphism', fr: 'Glassmorphism' }, value: 'glassmorphism' },
              { label: { en: 'Gradient', fr: 'Gradient' }, value: 'gradient' },
              { label: { en: 'Split Screen', fr: 'Ecran divise' }, value: 'split-screen' },
              { label: { en: 'Video Background', fr: 'Video en fond' }, value: 'video-background' },
              { label: { en: 'Aurora Borealis', fr: 'Aurore Boreale' }, value: 'aurora' },
              { label: { en: 'Neon / Cyberpunk', fr: 'Neon / Cyberpunk' }, value: 'neon' },
              { label: { en: 'Mesh Gradient', fr: 'Gradient Mesh' }, value: 'mesh' },
              { label: { en: 'Particles', fr: 'Particules' }, value: 'particles' },
              { label: { en: 'Custom HTML', fr: 'HTML personnalise' }, value: 'custom' },
            ],
            admin: {
              width: '50%',
              description: {
                en: 'Choose the visual layout for the maintenance page',
                fr: 'Choisissez le style visuel de la page de maintenance',
              },
            },
          },
        ],
      },
      {
        name: 'maintenanceType',
        type: 'select',
        label: {
          en: 'Maintenance type',
          fr: 'Type de maintenance',
        },
        defaultValue: 'maintenance',
        options: [
          { label: { en: 'Maintenance', fr: 'Maintenance' }, value: 'maintenance' },
          { label: { en: 'Coming Soon', fr: 'Bientot disponible' }, value: 'coming-soon' },
          { label: { en: 'Upgrade', fr: 'Mise a jour' }, value: 'upgrade' },
          { label: { en: 'Emergency', fr: 'Urgence' }, value: 'emergency' },
        ],
        admin: {
          description: {
            en: 'Type of maintenance — changes default icon and messaging on the page',
            fr: 'Type de maintenance — change l\'icone et le message par defaut sur la page',
          },
        },
      },
      {
        name: 'estimatedEnd',
        type: 'date',
        label: {
          en: 'Estimated end date',
          fr: 'Date de fin estimee',
        },
        admin: {
          date: { pickerAppearance: 'dayAndTime' },
          description: {
            en: 'Displayed on the page. Used as countdown target.',
            fr: 'Affichee sur la page. Utilisee comme cible du compte a rebours.',
          },
        },
      },

      // ─── Tabs ───
      {
        type: 'tabs',
        tabs: [
          // ─── Content ───
          {
            label: { en: 'Content', fr: 'Contenu' },
            fields: [
              {
                name: 'messages',
                type: 'array',
                label: { en: 'Messages by language', fr: 'Messages par langue' },
                minRows: 1,
                admin: {
                  description: {
                    en: 'Add one entry per language you want to support',
                    fr: 'Ajoutez une entree par langue que vous souhaitez supporter',
                  },
                  initCollapsed: false,
                },
                fields: [
                  {
                    type: 'row',
                    fields: [
                      {
                        name: 'language',
                        type: 'select',
                        label: { en: 'Language', fr: 'Langue' },
                        required: true,
                        options: languages,
                        admin: { width: '30%' },
                      },
                      {
                        name: 'title',
                        type: 'text',
                        label: { en: 'Title', fr: 'Titre' },
                        required: true,
                        admin: { width: '70%' },
                      },
                    ],
                  },
                  {
                    name: 'description',
                    type: 'textarea',
                    label: { en: 'Description', fr: 'Description' },
                    required: true,
                  },
                  {
                    type: 'row',
                    fields: [
                      {
                        name: 'buttonLabel',
                        type: 'text',
                        label: { en: 'Button label', fr: 'Libelle du bouton' },
                        admin: { width: '50%' },
                      },
                      {
                        name: 'buttonUrl',
                        type: 'text',
                        label: { en: 'Button URL', fr: 'URL du bouton' },
                        admin: { width: '50%' },
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // ─── Design ───
          {
            label: { en: 'Design', fr: 'Design' },
            fields: [
              {
                type: 'row',
                fields: [
                  {
                    name: 'logo',
                    type: 'upload',
                    relationTo: mediaSlug,
                    label: { en: 'Logo', fr: 'Logo' },
                    admin: { width: '50%' },
                  },
                  {
                    name: 'backgroundImage',
                    type: 'upload',
                    relationTo: mediaSlug,
                    label: { en: 'Background image', fr: 'Image de fond' },
                    admin: { width: '50%' },
                  },
                ],
              },
              {
                type: 'row',
                fields: [
                  {
                    name: 'splitImage',
                    type: 'upload',
                    relationTo: mediaSlug,
                    label: { en: 'Split screen image', fr: 'Image ecran divise' },
                    admin: {
                      width: '50%',
                      condition: (_: any, siblingData: any) => siblingData?.template === 'split-screen',
                      description: {
                        en: 'Image displayed on the right side of the split screen',
                        fr: 'Image affichee sur le cote droit de l\'ecran divise',
                      },
                    },
                  },
                  {
                    name: 'videoUrl',
                    type: 'text',
                    label: { en: 'Background video URL', fr: 'URL de la video de fond' },
                    admin: {
                      width: '50%',
                      condition: (_: any, siblingData: any) => siblingData?.template === 'video-background',
                      description: {
                        en: 'Direct MP4 video URL (or upload to media)',
                        fr: 'URL directe de la video MP4 (ou upload dans les medias)',
                      },
                    },
                  },
                ],
              },
              {
                name: 'backgroundOverlayOpacity',
                type: 'number',
                label: { en: 'Background overlay opacity (0-100)', fr: 'Opacite du voile de fond (0-100)' },
                defaultValue: 70,
                min: 0,
                max: 100,
              },
              {
                type: 'row',
                fields: [
                  {
                    name: 'backgroundColor',
                    type: 'text',
                    label: { en: 'Background color', fr: 'Couleur de fond' },
                    defaultValue: '#0f172a',
                    admin: { width: '33%' },
                  },
                  {
                    name: 'textColor',
                    type: 'text',
                    label: { en: 'Text color', fr: 'Couleur du texte' },
                    defaultValue: '#f8fafc',
                    admin: { width: '33%' },
                  },
                  {
                    name: 'accentColor',
                    type: 'text',
                    label: { en: 'Accent color', fr: 'Couleur d\'accent' },
                    defaultValue: '#3b82f6',
                    admin: { width: '33%' },
                  },
                ],
              },
              {
                type: 'row',
                fields: [
                  {
                    name: 'darkMode',
                    type: 'select',
                    label: { en: 'Color mode', fr: 'Mode couleur' },
                    defaultValue: 'dark',
                    options: [
                      { label: { en: 'Dark', fr: 'Sombre' }, value: 'dark' },
                      { label: { en: 'Light', fr: 'Clair' }, value: 'light' },
                      { label: { en: 'Auto (system)', fr: 'Auto (systeme)' }, value: 'auto' },
                    ],
                    admin: { width: '33%' },
                  },
                  {
                    name: 'googleFont',
                    type: 'text',
                    label: { en: 'Google Font name', fr: 'Nom de la Google Font' },
                    admin: {
                      width: '33%',
                      description: {
                        en: 'E.g. "Inter", "Poppins", "Space Grotesk"',
                        fr: 'Ex. "Inter", "Poppins", "Space Grotesk"',
                      },
                    },
                  },
                  {
                    name: 'lottieUrl',
                    type: 'text',
                    label: { en: 'Lottie animation URL', fr: 'URL animation Lottie' },
                    admin: {
                      width: '33%',
                      description: {
                        en: 'URL to a Lottie JSON file (from lottiefiles.com)',
                        fr: 'URL vers un fichier Lottie JSON (depuis lottiefiles.com)',
                      },
                    },
                  },
                ],
              },
              {
                name: 'showProgressBar',
                type: 'checkbox',
                label: { en: 'Show progress bar', fr: 'Afficher la barre de progression' },
                defaultValue: false,
              },
              {
                name: 'favicon',
                type: 'upload',
                relationTo: mediaSlug,
                label: { en: 'Favicon (optional)', fr: 'Favicon (optionnel)' },
              },
              {
                name: 'customCSS',
                type: 'code',
                label: { en: 'Custom CSS', fr: 'CSS personnalise' },
                admin: { language: 'css' },
                validate: (value: string | null | undefined) => {
                  if (!value) return true
                  // Reject HTML tags that could escape the <style> context
                  const dangerousPatterns = [/<\/style/i, /<script/i, /<iframe/i, /<object/i, /<embed/i, /<link/i, /<import/i]
                  for (const pattern of dangerousPatterns) {
                    if (pattern.test(value)) {
                      return 'CSS must not contain HTML tags (</style>, <script>, etc.)'
                    }
                  }
                  return true
                },
              },
              {
                name: 'customHTML',
                type: 'code',
                label: { en: 'Custom HTML', fr: 'HTML personnalise' },
                admin: {
                  language: 'html',
                  condition: (_: any, siblingData: any) => siblingData?.template === 'custom',
                  description: {
                    en: '⚠️ WARNING: This HTML is injected as-is. Only trusted admins should edit this field. Avoid pasting untrusted content.\nVariables: {{title}}, {{description}}, {{estimatedEnd}}, {{logoUrl}}',
                    fr: '⚠️ ATTENTION : Ce HTML est injecte tel quel. Seuls les admins de confiance doivent modifier ce champ. Ne pas coller de contenu non verifie.\nVariables : {{title}}, {{description}}, {{estimatedEnd}}, {{logoUrl}}',
                  },
                },
              },
            ],
          },

          // ─── Social & Contact ───
          {
            label: { en: 'Social & Contact', fr: 'Social & Contact' },
            fields: [
              {
                name: 'contactEmail',
                type: 'email',
                label: { en: 'Contact email', fr: 'Email de contact' },
              },
              {
                name: 'socialLinks',
                type: 'array',
                label: { en: 'Social links', fr: 'Liens reseaux sociaux' },
                maxRows: 8,
                fields: [
                  {
                    type: 'row',
                    fields: [
                      {
                        name: 'platform',
                        type: 'select',
                        label: { en: 'Platform', fr: 'Plateforme' },
                        required: true,
                        options: [
                          { label: 'Facebook', value: 'facebook' },
                          { label: 'Instagram', value: 'instagram' },
                          { label: 'Twitter / X', value: 'twitter' },
                          { label: 'LinkedIn', value: 'linkedin' },
                          { label: 'YouTube', value: 'youtube' },
                          { label: 'TikTok', value: 'tiktok' },
                          { label: 'GitHub', value: 'github' },
                          { label: { en: 'Other', fr: 'Autre' }, value: 'other' },
                        ],
                        admin: { width: '30%' },
                      },
                      {
                        name: 'url',
                        type: 'text',
                        label: 'URL',
                        required: true,
                        admin: { width: '50%' },
                      },
                      {
                        name: 'label',
                        type: 'text',
                        label: { en: 'Label', fr: 'Libelle' },
                        admin: { width: '20%' },
                      },
                    ],
                  },
                ],
              },
              {
                name: 'showNewsletterForm',
                type: 'checkbox',
                label: { en: 'Show notification signup form', fr: 'Afficher le formulaire de notification' },
                defaultValue: false,
              },
              {
                name: 'newsletterPlaceholder',
                type: 'text',
                label: { en: 'Email placeholder', fr: 'Placeholder email' },
                defaultValue: 'votre@email.com',
                admin: { condition: (_: any, siblingData: any) => siblingData?.showNewsletterForm },
              },
              {
                name: 'newsletterButtonLabel',
                type: 'text',
                label: { en: 'Submit button label', fr: 'Libelle du bouton' },
                defaultValue: 'Me notifier',
                admin: { condition: (_: any, siblingData: any) => siblingData?.showNewsletterForm },
              },
            ],
          },

          // ─── Scheduling ───
          ...(enableScheduling
            ? [
                {
                  label: { en: 'Scheduling', fr: 'Planification' } as Record<string, string>,
                  fields: [
                    {
                      type: 'row' as const,
                      fields: [
                        {
                          name: 'scheduledStart',
                          type: 'date' as const,
                          label: { en: 'Scheduled start', fr: 'Debut planifie' },
                          admin: {
                            width: '50%',
                            date: { pickerAppearance: 'dayAndTime' as const },
                            description: {
                              en: 'Maintenance will automatically activate at this time',
                              fr: 'La maintenance s\'activera automatiquement a cette heure',
                            },
                          },
                        },
                        {
                          name: 'scheduledEnd',
                          type: 'date' as const,
                          label: { en: 'Scheduled end', fr: 'Fin planifiee' },
                          validate: (value: Date | string | null | undefined, { siblingData }: any) => {
                            if (!value || !siblingData?.scheduledStart) return true
                            const endDate = value instanceof Date ? value : new Date(value)
                            const startDate = siblingData.scheduledStart instanceof Date
                              ? siblingData.scheduledStart
                              : new Date(siblingData.scheduledStart)
                            if (endDate <= startDate) {
                              return 'End date must be after start date'
                            }
                            return true
                          },
                          admin: {
                            width: '50%',
                            date: { pickerAppearance: 'dayAndTime' as const },
                            description: {
                              en: 'Maintenance will automatically deactivate at this time',
                              fr: 'La maintenance se desactivera automatiquement a cette heure',
                            },
                          },
                        },
                      ],
                    },
                    {
                      name: 'timezone',
                      type: 'text' as const,
                      label: { en: 'Timezone', fr: 'Fuseau horaire' },
                      validate: (value: string | null | undefined) => {
                        if (!value) return true
                        try {
                          Intl.DateTimeFormat(undefined, { timeZone: value })
                          return true
                        } catch {
                          return 'Invalid timezone. Use IANA format (e.g. Europe/Paris)'
                        }
                      },
                      admin: {
                        placeholder: 'Europe/Paris',
                        description: {
                          en: 'IANA timezone for scheduled dates (e.g. Europe/Paris, America/New_York). Leave empty for UTC.',
                          fr: 'Fuseau horaire IANA pour les dates planifiees (ex. Europe/Paris, America/New_York). Laisser vide pour UTC.',
                        },
                      },
                    },
                    {
                      type: 'row' as const,
                      fields: [
                        {
                          name: 'autoEnable',
                          type: 'checkbox' as const,
                          label: { en: 'Auto-enable at scheduled start', fr: 'Activer auto au debut planifie' },
                          defaultValue: false,
                          admin: { width: '50%' },
                        },
                        {
                          name: 'autoDisable',
                          type: 'checkbox' as const,
                          label: { en: 'Auto-disable at scheduled end', fr: 'Desactiver auto a la fin planifiee' },
                          defaultValue: false,
                          admin: { width: '50%' },
                        },
                      ],
                    },
                  ],
                },
              ]
            : []),

          // ─── Webhooks ───
          {
            label: { en: 'Notifications', fr: 'Notifications' },
            fields: [
              {
                name: 'webhooks',
                type: 'array',
                label: { en: 'Webhooks', fr: 'Webhooks' },
                maxRows: 5,
                admin: {
                  description: {
                    en: 'Get notified when maintenance mode is toggled',
                    fr: 'Soyez notifie quand le mode maintenance change',
                  },
                },
                fields: [
                  {
                    type: 'row',
                    fields: [
                      {
                        name: 'type',
                        type: 'select',
                        label: { en: 'Type', fr: 'Type' },
                        required: true,
                        options: [
                          { label: 'Slack', value: 'slack' },
                          { label: 'Discord', value: 'discord' },
                          { label: { en: 'Custom webhook', fr: 'Webhook personnalise' }, value: 'custom' },
                        ],
                        admin: { width: '30%' },
                      },
                      {
                        name: 'url',
                        type: 'text',
                        label: { en: 'Webhook URL', fr: 'URL du webhook' },
                        required: true,
                        // Slack/Discord webhook URLs are bearer credentials.
                        access: adminOnlyField,
                        validate: (value: string | null | undefined) => {
                          if (!value) return true
                          try {
                            const parsed = new URL(value)
                            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                              return 'URL must start with https:// or http://'
                            }
                            return true
                          } catch {
                            return 'Invalid URL format'
                          }
                        },
                        admin: {
                          width: '50%',
                          description: {
                            en: 'Must be https:// — a plaintext http:// target is refused at send time (the TLS certificate is what stops a DNS record from redirecting the server to an internal address between the safety check and the request).',
                            fr: 'Doit etre en https:// — une cible http:// en clair est refusee a l envoi (le certificat TLS est ce qui empeche un enregistrement DNS de rediriger le serveur vers une adresse interne entre le controle et la requete).',
                          },
                        },
                      },
                      {
                        name: 'enabled',
                        type: 'checkbox',
                        label: { en: 'Active', fr: 'Actif' },
                        defaultValue: true,
                        admin: { width: '20%' },
                      },
                    ],
                  },
                ],
              },
              {
                name: 'notifyEmail',
                type: 'email',
                label: { en: 'Notification email', fr: 'Email de notification' },
                access: adminOnlyField,
                admin: {
                  description: {
                    en: 'Receive an email when maintenance mode changes (uses Payload email adapter)',
                    fr: 'Recevez un email quand le mode maintenance change (utilise l\'adaptateur email Payload)',
                  },
                },
              },
            ],
          },

          // ─── Access ───
          {
            label: { en: 'Access', fr: 'Acces' },
            fields: [
              {
                name: 'authBypass',
                type: 'checkbox',
                label: { en: 'Bypass for logged-in users', fr: 'Contournement pour utilisateurs connectes' },
                defaultValue: true,
                admin: {
                  description: {
                    en: 'Logged-in Payload admin users automatically see the real site',
                    fr: 'Les utilisateurs admin Payload connectes voient automatiquement le vrai site',
                  },
                },
              },
              {
                name: 'excludedRoutes',
                type: 'textarea',
                label: { en: 'Excluded routes (one per line)', fr: 'Routes exclues (une par ligne)' },
                admin: {
                  description: {
                    en: 'These routes will NOT show the maintenance page (e.g. /pricing, /legal)',
                    fr: 'Ces routes ne montreront PAS la page de maintenance (ex. /pricing, /legal)',
                  },
                },
              },
              {
                name: 'allowedIPs',
                type: 'textarea',
                label: { en: 'Allowed IPs (one per line)', fr: 'IPs autorisees (une par ligne)' },
                access: adminOnlyField,
                admin: {
                  description: {
                    en: 'NOT read by the middleware yet — the same list must be passed to createMaintenanceMiddleware({ allowedIPs: [...] }) in your middleware.ts, because the middleware cannot read this global without exposing it publicly.',
                    fr: 'PAS encore lu par le middleware — la meme liste doit etre passee a createMaintenanceMiddleware({ allowedIPs: [...] }) dans votre middleware.ts, car le middleware ne peut pas lire ce global sans l\'exposer publiquement.',
                  },
                },
              },
              {
                name: 'bypassSecret',
                type: 'text',
                label: { en: 'Bypass secret', fr: 'Secret de contournement' },
                access: adminOnlyField,
                admin: {
                  description: {
                    en: 'NOT read by the middleware yet — pass the same value to createMaintenanceMiddleware({ bypassSecret: "..." }) in your middleware.ts to enable ?bypass=YOUR_SECRET (24h cookie).',
                    fr: 'PAS encore lu par le middleware — passez la meme valeur a createMaintenanceMiddleware({ bypassSecret: "..." }) dans votre middleware.ts pour activer ?bypass=VOTRE_SECRET (cookie 24h).',
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

// Webhook helper with exponential backoff retry (max 3 attempts)
export async function fireWebhook(
  webhook: { type: string; url: string },
  action: string,
  triggeredBy: string,
  logger: any,
  payload?: any,
  webhookLogsSlug?: string,
  historySlug?: string,
  allowedWebhookHosts?: string[],
  /** Injected by the tests; defaults to `node:dns.lookup`. */
  lookup?: (hostname: string) => Promise<string[]>,
) {
  const timestamp = new Date().toISOString()
  let body: string

  if (webhook.type === 'slack') {
    body = JSON.stringify({
      text: `🔧 *Maintenance ${action === 'activated' ? 'ACTIVEE' : 'DESACTIVEE'}*\nPar: ${triggeredBy}\nDate: ${timestamp}`,
    })
  } else if (webhook.type === 'discord') {
    body = JSON.stringify({
      content: `🔧 **Maintenance ${action === 'activated' ? 'ACTIVEE' : 'DESACTIVEE'}**\nPar: ${triggeredBy}\nDate: ${timestamp}`,
    })
  } else {
    body = JSON.stringify({ action, triggeredBy, timestamp })
  }

  // Validate the target before fetching. Checking only the protocol turned this
  // into an SSRF proxy: the URL is administrator-supplied, the server resolves
  // it from inside the private network, and up to 2000 bytes of the answer are
  // persisted in the webhook logs — a readable exfiltration channel towards
  // cloud metadata (169.254.169.254), localhost services or internal hosts.
  const guard = await assertPublicHttpUrl(webhook.url, {
    allowedHosts: allowedWebhookHosts,
    lookup,
  })
  if (!guard.ok) {
    logger.error(`[maintenance] Webhook target refused (${guard.reason}): ${webhook.url}`)
    if (payload && webhookLogsSlug) {
      payload
        .create({
          collection: webhookLogsSlug,
          data: {
            webhookUrl: webhook.url,
            webhookType: webhook.type,
            action,
            status: 'failed',
            statusCode: 0,
            responseBody: `Refused before sending: ${guard.reason}`,
            attempts: 0,
            timestamp: new Date().toISOString(),
          },
        })
        .catch(() => {})
    }
    return
  }

  const maxAttempts = 3
  const backoffMs = [1000, 2000, 4000]
  let lastStatusCode: number | undefined
  let lastResponseBody: string | undefined
  let success = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Re-resolve the target before EVERY retry. The guard used to run once for
    // the whole loop, so a record with a 0s TTL got three chances — spaced by
    // the 1s/2s backoff — to flip to an internal address after being validated.
    if (attempt > 1) {
      const recheck = await assertPublicHttpUrl(webhook.url, {
        allowedHosts: allowedWebhookHosts,
        lookup,
      })
      if (!recheck.ok) {
        lastResponseBody = `Refused before retry: ${recheck.reason}`
        logger.error(
          `[maintenance] Webhook target refused before retry ${attempt} (${recheck.reason}): ${webhook.url}`,
        )
        break
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        // Never follow a redirect: an allowed external host answering 302
        // towards 169.254.169.254 would otherwise walk straight past the
        // address check performed on the initial URL. Each hop would have to be
        // re-validated, so the chain is simply refused.
        redirect: 'manual',
        signal: controller.signal,
      })
      lastStatusCode = res.status
      if (res.status >= 300 && res.status < 400) {
        lastResponseBody = `Redirect refused (HTTP ${res.status})`
        logger.warn(
          `[maintenance] Webhook attempt ${attempt}/${maxAttempts} refused: target redirected (HTTP ${res.status})`,
        )
        clearTimeout(timeout)
        break
      }
      lastResponseBody = await res.text().catch(() => '')

      if (res.ok) {
        logger.info(`[maintenance] Webhook fired: ${webhook.type} → ${action} (attempt ${attempt})`)
        success = true

        // Log success to webhook logs collection
        if (payload && webhookLogsSlug) {
          payload.create({
            collection: webhookLogsSlug,
            data: {
              webhookUrl: webhook.url,
              webhookType: webhook.type,
              action,
              status: 'success',
              statusCode: lastStatusCode,
              responseBody: (lastResponseBody || '').slice(0, 2000),
              attempts: attempt,
              timestamp: new Date().toISOString(),
            },
          }).catch(() => {})
        }

        clearTimeout(timeout)
        return
      }

      logger.warn(`[maintenance] Webhook attempt ${attempt}/${maxAttempts} failed with status ${res.status}: ${webhook.type}`)
    } catch (e) {
      logger.warn(`[maintenance] Webhook attempt ${attempt}/${maxAttempts} error: ${e}`)
      lastResponseBody = String(e)
    } finally {
      clearTimeout(timeout)
    }

    // Wait with exponential backoff before retrying (except on last attempt)
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1]))
    }
  }

  // All retries failed
  if (!success) {
    logger.error(`[maintenance] Webhook failed after ${maxAttempts} attempts: ${webhook.type} → ${webhook.url}`)

    // Log failure to webhook logs collection
    if (payload && webhookLogsSlug) {
      payload.create({
        collection: webhookLogsSlug,
        data: {
          webhookUrl: webhook.url,
          webhookType: webhook.type,
          action,
          status: 'failed',
          statusCode: lastStatusCode || 0,
          responseBody: (lastResponseBody || '').slice(0, 2000),
          attempts: maxAttempts,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {})
    }

    // Log failure to maintenance history collection
    if (payload && historySlug) {
      payload.create({
        collection: historySlug,
        data: {
          action: 'webhook-failed',
          triggeredBy: `webhook:${webhook.type}`,
          timestamp: new Date().toISOString(),
          details: {
            webhookUrl: webhook.url,
            webhookType: webhook.type,
            originalAction: action,
            attempts: maxAttempts,
            lastStatusCode,
          },
        },
      }).catch(() => {})
    }
  }
}
