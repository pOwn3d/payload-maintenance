/**
 * Pre-built maintenance page presets.
 * Each preset provides a complete configuration that can be applied via the admin UI or API.
 */

export interface MaintenancePreset {
  id: string
  name: { fr: string; en: string }
  description: { fr: string; en: string }
  preview: string // CSS gradient for preview card
  config: {
    template: string
    backgroundColor: string
    textColor: string
    accentColor: string
    backgroundOverlayOpacity: number
    showProgressBar: boolean
    darkMode: string
    showNewsletterForm: boolean
    googleFont?: string
    messages: {
      fr: { title: string; description: string; buttonLabel: string; buttonUrl: string }
      en: { title: string; description: string; buttonLabel: string; buttonUrl: string }
    }
  }
}

export const presets: MaintenancePreset[] = [
  // ─── 1. Corporate Blue ───
  {
    id: 'corporate-blue',
    name: { fr: 'Corporate Bleu', en: 'Corporate Blue' },
    description: {
      fr: 'Template professionnel sobre avec compte a rebours. Ideal pour les sites d\'entreprise.',
      en: 'Clean professional template with countdown. Perfect for business sites.',
    },
    preview: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
    config: {
      template: 'countdown',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      accentColor: '#3b82f6',
      backgroundOverlayOpacity: 70,
      showProgressBar: true,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Inter',
      messages: {
        fr: {
          title: 'Maintenance en cours',
          description: 'Notre site fait peau neuve pour vous offrir une meilleure experience.\nNous serons de retour tres bientot.',
          buttonLabel: 'Nous contacter',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'Scheduled Maintenance',
          description: 'Our site is getting a fresh look to provide you with a better experience.\nWe will be back very soon.',
          buttonLabel: 'Contact us',
          buttonUrl: 'mailto:contact@example.com',
        },
      },
    },
  },

  // ─── 2. Startup Launch ───
  {
    id: 'startup-launch',
    name: { fr: 'Lancement Startup', en: 'Startup Launch' },
    description: {
      fr: 'Template dynamique pour les lancements de produit. Gradient anime avec compte a rebours flip.',
      en: 'Dynamic template for product launches. Animated gradient with flip countdown.',
    },
    preview: 'linear-gradient(-45deg, #6366f1, #a855f7, #ec4899)',
    config: {
      template: 'gradient',
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      accentColor: '#a855f7',
      backgroundOverlayOpacity: 60,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Space Grotesk',
      messages: {
        fr: {
          title: 'Quelque chose d\'incroyable arrive',
          description: 'Nous preparons une experience revolutionnaire.\nInscrivez-vous pour etre les premiers informes.',
          buttonLabel: '',
          buttonUrl: '',
        },
        en: {
          title: 'Something incredible is coming',
          description: 'We\'re preparing a revolutionary experience.\nSign up to be the first to know.',
          buttonLabel: '',
          buttonUrl: '',
        },
      },
    },
  },

  // ─── 3. Minimal Elegant ───
  {
    id: 'minimal-elegant',
    name: { fr: 'Minimal Elegant', en: 'Minimal Elegant' },
    description: {
      fr: 'Template minimaliste et elegant. Sobre, efficace, professionnel.',
      en: 'Minimalist and elegant template. Clean, effective, professional.',
    },
    preview: 'linear-gradient(135deg, #18181b, #27272a)',
    config: {
      template: 'minimal',
      backgroundColor: '#18181b',
      textColor: '#fafafa',
      accentColor: '#e4e4e7',
      backgroundOverlayOpacity: 80,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: false,
      googleFont: 'DM Sans',
      messages: {
        fr: {
          title: 'Nous revenons bientot',
          description: 'Notre site est actuellement en maintenance.\nMerci de votre patience.',
          buttonLabel: 'Nous contacter',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'We\'ll be back soon',
          description: 'Our site is currently under maintenance.\nThank you for your patience.',
          buttonLabel: 'Contact us',
          buttonUrl: 'mailto:contact@example.com',
        },
      },
    },
  },

  // ─── 4. Glassmorphism Premium ───
  {
    id: 'glass-premium',
    name: { fr: 'Glass Premium', en: 'Glass Premium' },
    description: {
      fr: 'Effet verre depoli premium. Moderne et luxueux avec des orbes flottants.',
      en: 'Premium frosted glass effect. Modern and luxurious with floating orbs.',
    },
    preview: 'linear-gradient(135deg, #0c0a3e, #1a0533, #3a0647)',
    config: {
      template: 'glassmorphism',
      backgroundColor: '#0c0a3e',
      textColor: '#f0f0ff',
      accentColor: '#818cf8',
      backgroundOverlayOpacity: 50,
      showProgressBar: true,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Outfit',
      messages: {
        fr: {
          title: 'Experience en preparation',
          description: 'Nous peaufinons chaque detail pour creer quelque chose d\'exceptionnel.\nVotre patience est notre plus belle recompense.',
          buttonLabel: 'Decouvrir bientot',
          buttonUrl: '#',
        },
        en: {
          title: 'Experience in the making',
          description: 'We\'re perfecting every detail to create something exceptional.\nYour patience is our greatest reward.',
          buttonLabel: 'Discover soon',
          buttonUrl: '#',
        },
      },
    },
  },

  // ─── 5. Coming Soon Creative ───
  {
    id: 'coming-soon-creative',
    name: { fr: 'Coming Soon Creatif', en: 'Coming Soon Creative' },
    description: {
      fr: 'Template creatif pour les agences et freelances. Flip countdown avec style audacieux.',
      en: 'Creative template for agencies and freelancers. Flip countdown with bold style.',
    },
    preview: 'linear-gradient(135deg, #064e3b, #0d9488)',
    config: {
      template: 'coming-soon',
      backgroundColor: '#042f2e',
      textColor: '#f0fdfa',
      accentColor: '#14b8a6',
      backgroundOverlayOpacity: 75,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Sora',
      messages: {
        fr: {
          title: 'Bientot en ligne',
          description: 'Un nouveau projet passionnant est en cours de realisation.\nRestez connectes pour ne rien manquer.',
          buttonLabel: '',
          buttonUrl: '',
        },
        en: {
          title: 'Coming soon',
          description: 'An exciting new project is being built.\nStay connected so you don\'t miss a thing.',
          buttonLabel: '',
          buttonUrl: '',
        },
      },
    },
  },

  // ─── 6. Light Mode Clean ───
  {
    id: 'light-clean',
    name: { fr: 'Light Mode Epure', en: 'Light Mode Clean' },
    description: {
      fr: 'Template lumineux et epure. Ideal pour les marques minimalistes ou lifestyle.',
      en: 'Bright and clean template. Perfect for minimalist or lifestyle brands.',
    },
    preview: 'linear-gradient(135deg, #ffffff, #f1f5f9)',
    config: {
      template: 'minimal',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      accentColor: '#2563eb',
      backgroundOverlayOpacity: 30,
      showProgressBar: true,
      darkMode: 'light',
      showNewsletterForm: true,
      googleFont: 'Plus Jakarta Sans',
      messages: {
        fr: {
          title: 'Maintenance programmee',
          description: 'Nous ameliorons notre site pour mieux vous servir.\nLe service sera retabli dans quelques instants.',
          buttonLabel: 'En savoir plus',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'Scheduled maintenance',
          description: 'We\'re improving our site to serve you better.\nService will be restored shortly.',
          buttonLabel: 'Learn more',
          buttonUrl: 'mailto:contact@example.com',
        },
      },
    },
  },

  // ─── 7. Warm Gradient ───
  {
    id: 'warm-gradient',
    name: { fr: 'Gradient Chaleureux', en: 'Warm Gradient' },
    description: {
      fr: 'Gradient anime aux tons chauds. Ideal pour la restauration, le bien-etre, le lifestyle.',
      en: 'Animated warm-toned gradient. Perfect for food, wellness, lifestyle.',
    },
    preview: 'linear-gradient(-45deg, #f97316, #ef4444, #ec4899, #f59e0b)',
    config: {
      template: 'gradient',
      backgroundColor: '#1c1917',
      textColor: '#fef3c7',
      accentColor: '#f97316',
      backgroundOverlayOpacity: 60,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Poppins',
      messages: {
        fr: {
          title: 'On revient avec du nouveau',
          description: 'Notre equipe prepare une nouvelle experience pour vous.\nRestez a l\'ecoute, ca arrive tres vite !',
          buttonLabel: 'Nous contacter',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'Coming back with something new',
          description: 'Our team is preparing a new experience for you.\nStay tuned, it\'s coming very soon!',
          buttonLabel: 'Contact us',
          buttonUrl: 'mailto:contact@example.com',
        },
      },
    },
  },

  // ─── 8. Tech Dark ───
  {
    id: 'tech-dark',
    name: { fr: 'Tech Sombre', en: 'Tech Dark' },
    description: {
      fr: 'Template technique sombre. Ideal pour les SaaS, les startups tech, les outils dev.',
      en: 'Dark technical template. Perfect for SaaS, tech startups, dev tools.',
    },
    preview: 'linear-gradient(135deg, #030712, #111827)',
    config: {
      template: 'countdown',
      backgroundColor: '#030712',
      textColor: '#e5e7eb',
      accentColor: '#22d3ee',
      backgroundOverlayOpacity: 85,
      showProgressBar: true,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'JetBrains Mono',
      messages: {
        fr: {
          title: 'Deploiement en cours',
          description: 'Nous mettons a jour nos systemes.\nTemps d\'arret estime : quelques minutes.',
          buttonLabel: 'Status page',
          buttonUrl: '#',
        },
        en: {
          title: 'Deployment in progress',
          description: 'We\'re updating our systems.\nEstimated downtime: a few minutes.',
          buttonLabel: 'Status page',
          buttonUrl: '#',
        },
      },
    },
  },
]

/**
 * Get a preset by ID.
 */
export function getPreset(id: string): MaintenancePreset | undefined {
  return presets.find((p) => p.id === id)
}

/**
 * Convert a preset to Payload global data format.
 */
export function presetToPayloadData(preset: MaintenancePreset, languages: string[] = ['fr', 'en']) {
  const messages = languages
    .filter((lang) => (preset.config.messages as any)[lang])
    .map((lang) => ({
      language: lang,
      ...(preset.config.messages as any)[lang],
    }))

  return {
    template: preset.config.template,
    backgroundColor: preset.config.backgroundColor,
    textColor: preset.config.textColor,
    accentColor: preset.config.accentColor,
    backgroundOverlayOpacity: preset.config.backgroundOverlayOpacity,
    showProgressBar: preset.config.showProgressBar,
    darkMode: preset.config.darkMode,
    showNewsletterForm: preset.config.showNewsletterForm,
    googleFont: preset.config.googleFont || '',
    messages,
  }
}
