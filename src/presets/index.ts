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
      fr: 'Template professionnel sobre avec compte à rebours. Idéal pour les sites d\'entreprise.',
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
          description: 'Notre site fait peau neuve pour vous offrir une meilleure expérience.\nNous serons de retour très bientôt.',
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
      fr: 'Template dynamique pour les lancements de produit. Gradient animé avec compte à rebours flip.',
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
          description: 'Nous préparons une expérience révolutionnaire.\nInscrivez-vous pour être les premiers informés.',
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
      fr: 'Template minimaliste et élégant. Sobre, efficace, professionnel.',
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
      fr: 'Effet verre dépoli premium. Moderne et luxueux avec des orbes flottants.',
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
          title: 'Expérience en préparation',
          description: 'Nous peaufinons chaque détail pour créer quelque chose d\'exceptionnel.\nVotre patience est notre plus belle récompense.',
          buttonLabel: 'Découvrir bientôt',
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
    name: { fr: 'Coming Soon Créatif', en: 'Coming Soon Creative' },
    description: {
      fr: 'Template créatif pour les agences et freelances. Flip countdown avec style audacieux.',
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
          title: 'Bientôt en ligne',
          description: 'Un nouveau projet passionnant est en cours de réalisation.\nRestez connectés pour ne rien manquer.',
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
    name: { fr: 'Light Mode Épuré', en: 'Light Mode Clean' },
    description: {
      fr: 'Template lumineux et épuré. Idéal pour les marques minimalistes ou lifestyle.',
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
          title: 'Maintenance programmée',
          description: 'Nous améliorons notre site pour mieux vous servir.\nLe service sera rétabli dans quelques instants.',
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
      fr: 'Gradient animé aux tons chauds. Idéal pour la restauration, le bien-être, le lifestyle.',
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
          description: 'Notre équipe prépare une nouvelle expérience pour vous.\nRestez à l\'écoute, ça arrive très vite !',
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
      fr: 'Template technique sombre. Idéal pour les SaaS, les startups tech, les outils dev.',
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
          title: 'Déploiement en cours',
          description: 'Nous mettons à jour nos systèmes.\nTemps d\'arrêt estimé : quelques minutes.',
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

  // ─── 9. Aurora Borealis ───
  {
    id: 'aurora-borealis',
    name: { fr: 'Aurore Boréale', en: 'Aurora Borealis' },
    description: {
      fr: 'Effet aurore boréale avec gradients animés et particules flottantes. Immersif et poétique.',
      en: 'Northern lights effect with animated gradients and floating particles. Immersive and poetic.',
    },
    preview: 'linear-gradient(180deg, #0a0e27, #0d9488, #7c3aed, #0a0e27)',
    config: {
      template: 'aurora',
      backgroundColor: '#0a0e27',
      textColor: '#e0f2fe',
      accentColor: '#2dd4bf',
      backgroundOverlayOpacity: 0,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Space Grotesk',
      messages: {
        fr: {
          title: 'Le spectacle se prépare',
          description: 'Notre site se transforme sous les lumières du nord.\nRevenez bientôt pour découvrir la nouvelle expérience.',
          buttonLabel: 'Nous contacter',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'The show is being prepared',
          description: 'Our site is transforming under the northern lights.\nCome back soon to discover the new experience.',
          buttonLabel: 'Contact us',
          buttonUrl: 'mailto:contact@example.com',
        },
      },
    },
  },

  // ─── 10. Cyberpunk Neon ───
  {
    id: 'cyberpunk-neon',
    name: { fr: 'Cyberpunk Neon', en: 'Cyberpunk Neon' },
    description: {
      fr: 'Style cyberpunk avec effets néon pulsés, grille en fond et scanline. Futuriste et audacieux.',
      en: 'Cyberpunk style with pulsing neon effects, background grid and scanline. Futuristic and bold.',
    },
    preview: 'linear-gradient(135deg, #0a0a0a, #1a0a2e, #ff00ff22)',
    config: {
      template: 'neon',
      backgroundColor: '#0a0a0a',
      textColor: '#f0f0f0',
      accentColor: '#ff00ff',
      backgroundOverlayOpacity: 0,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Orbitron',
      messages: {
        fr: {
          title: 'SYSTÈME EN MISE À JOUR',
          description: 'Les circuits sont en cours de reconfiguration.\nReconnexion imminente.',
          buttonLabel: 'Status',
          buttonUrl: '#',
        },
        en: {
          title: 'SYSTEM UPGRADING',
          description: 'Circuits are being reconfigured.\nReconnection imminent.',
          buttonLabel: 'Status',
          buttonUrl: '#',
        },
      },
    },
  },

  // ─── 11. Mesh Modern ───
  {
    id: 'mesh-modern',
    name: { fr: 'Mesh Moderne', en: 'Mesh Modern' },
    description: {
      fr: 'Gradient mesh animé avec blobs fluides. Esthétique Apple moderne, épuré et élégant.',
      en: 'Animated mesh gradient with fluid blobs. Modern Apple-like aesthetic, clean and elegant.',
    },
    preview: 'linear-gradient(135deg, #0f0f23, #6366f1, #a78bfa, #f472b6)',
    config: {
      template: 'mesh',
      backgroundColor: '#0f0f23',
      textColor: '#f8fafc',
      accentColor: '#818cf8',
      backgroundOverlayOpacity: 0,
      showProgressBar: false,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Geist',
      messages: {
        fr: {
          title: 'Nouvelle version en approche',
          description: 'Nous concevons une expérience fluide et moderne.\nChaque pixel compte.',
          buttonLabel: '',
          buttonUrl: '',
        },
        en: {
          title: 'New version approaching',
          description: 'We\'re crafting a fluid and modern experience.\nEvery pixel counts.',
          buttonLabel: '',
          buttonUrl: '',
        },
      },
    },
  },

  // ─── 12. Particles Cosmic ───
  {
    id: 'particles-cosmic',
    name: { fr: 'Particules Cosmiques', en: 'Particles Cosmic' },
    description: {
      fr: 'Systeme de particules interactif avec effet constellation. Spatial et immersif.',
      en: 'Interactive particle system with constellation effect. Spatial and immersive.',
    },
    preview: 'linear-gradient(135deg, #020617, #0f172a, #1e3a5f)',
    config: {
      template: 'particles',
      backgroundColor: '#020617',
      textColor: '#e2e8f0',
      accentColor: '#60a5fa',
      backgroundOverlayOpacity: 0,
      showProgressBar: true,
      darkMode: 'dark',
      showNewsletterForm: true,
      googleFont: 'Inter',
      messages: {
        fr: {
          title: 'Dans les étoiles',
          description: 'Notre univers numérique est en pleine expansion.\nBientôt une nouvelle constellation de fonctionnalités.',
          buttonLabel: 'Nous contacter',
          buttonUrl: 'mailto:contact@example.com',
        },
        en: {
          title: 'Among the stars',
          description: 'Our digital universe is expanding.\nA new constellation of features is coming soon.',
          buttonLabel: 'Contact us',
          buttonUrl: 'mailto:contact@example.com',
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
