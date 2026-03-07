# @consilioweb/payload-maintenance

Plugin Payload CMS 3 complet pour ajouter un **mode maintenance** professionnel et customisable a votre site Next.js.

## Fonctionnalites

- **8 templates** : Minimal, Countdown, Coming Soon, Glassmorphism, Gradient, Split Screen, Video Background, Custom HTML
- **8 presets pre-configures** : appliquables en 1 clic depuis l'admin
- **i18n** : 10 langues (FR, EN, DE, ES, IT, PT, NL, JA, AR, ZH) avec auto-detection navigateur
- **Planification** : activation/desactivation automatique par date
- **Newsletter** : formulaire d'inscription avec stockage en DB et export CSV
- **Historique** : log complet des activations/desactivations (qui, quand, duree)
- **Webhooks** : notifications Slack, Discord, webhook personnalise
- **SEO** : HTTP 503 + Retry-After header dynamique
- **Auth bypass** : utilisateurs Payload connectes voient le vrai site automatiquement
- **Exclusion de routes** : pages specifiques exclues de la maintenance
- **Design** : Google Fonts, animations Lottie, dark/light/auto mode, custom CSS/HTML
- **Admin** : dashboard avec toggle, preview live, stats abonnes, presets visuels, historique

## Installation

```bash
pnpm add @consilioweb/payload-maintenance
```

## Configuration

### 1. Plugin Payload

```ts
// payload.config.ts
import { maintenancePlugin } from '@consilioweb/payload-maintenance'

export default buildConfig({
  plugins: [
    maintenancePlugin({
      // Toutes les options sont optionnelles
      languages: [
        { label: 'Francais', value: 'fr' },
        { label: 'English', value: 'en' },
      ],
    }),
  ],
})
```

### 2. Middleware Next.js

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createMaintenanceMiddleware } from '@consilioweb/payload-maintenance/middleware'

const maintenanceMiddleware = createMaintenanceMiddleware()

export async function middleware(request: NextRequest) {
  const maintenanceResponse = await maintenanceMiddleware(request)
  if (maintenanceResponse) return maintenanceResponse
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
```

### 3. Page de maintenance

```tsx
// src/app/(frontend)/maintenance/page.tsx
import { MaintenancePage } from '@consilioweb/payload-maintenance/client'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Maintenance',
  robots: { index: false, follow: false },
}

export default function MaintenanceRoute() {
  return <MaintenancePage />
}
```

### 4. Regenerer l'importmap

```bash
pnpm generate:importmap
```

## Options du plugin

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `globalSlug` | `string` | `'maintenance'` | Slug du global Payload |
| `endpointBasePath` | `string` | `'/maintenance'` | Chemin de base des endpoints API |
| `languages` | `{label, value}[]` | `[{fr}, {en}]` | Langues disponibles |
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Chemins jamais bloques |
| `addDashboardView` | `boolean` | `true` | Vue admin dashboard |
| `mediaCollectionSlug` | `string` | `'media'` | Collection pour les uploads |
| `enableSubscribers` | `boolean` | `true` | Collection subscribers en DB |
| `subscribersSlug` | `string` | `'maintenance-subscribers'` | Slug collection subscribers |
| `enableHistory` | `boolean` | `true` | Collection historique |
| `historySlug` | `string` | `'maintenance-history'` | Slug collection historique |
| `enableScheduling` | `boolean` | `true` | Planification automatique |
| `authBypass` | `boolean` | `true` | Bypass pour users connectes |
| `bypassCookieName` | `string` | `'maintenance-bypass'` | Nom du cookie bypass |

## Options du middleware

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `excludedPaths` | `string[]` | `['/admin', '/api']` | Chemins jamais bloques |
| `cacheDuration` | `number` | `10` | Cache en secondes |
| `return503` | `boolean` | `true` | HTTP 503 pour le SEO |
| `authBypass` | `boolean` | `true` | Bypass users connectes |
| `authCookieName` | `string` | `'payload-token'` | Cookie auth Payload |
| `bypassCookieName` | `string` | `'maintenance-bypass'` | Cookie bypass |

## Endpoints API

| Endpoint | Methode | Auth | Description |
|----------|---------|------|-------------|
| `/api/maintenance/status` | GET | Public | Status complet |
| `/api/maintenance/toggle` | POST | Admin | Basculer on/off |
| `/api/maintenance/newsletter` | POST | Public | Inscription email |
| `/api/maintenance/stats` | GET | Admin | Stats + historique |
| `/api/maintenance/subscribers/export` | GET | Admin | Export CSV abonnes |
| `/api/maintenance/presets` | GET | Public | Liste des presets |
| `/api/maintenance/presets/apply` | POST | Admin | Appliquer un preset |
| `/api/maintenance/schedule-check` | GET | Public | Verifier planification |

## Templates

| Template | Description |
|----------|-------------|
| `minimal` | Sobre avec icone animee |
| `countdown` | Anneaux SVG circulaires |
| `coming-soon` | Flip cards avec separateurs |
| `glassmorphism` | Carte verre depoli, orbes flottants |
| `gradient` | Gradient anime multi-couleurs |
| `split-screen` | Contenu gauche, image droite (responsive) |
| `video-background` | Video MP4 en fond avec overlay |
| `custom` | HTML libre avec variables `{{title}}`, `{{description}}`, `{{estimatedEnd}}`, `{{logoUrl}}` |

## Presets

8 presets pre-configures appliquables en 1 clic :

| Preset | Template | Style |
|--------|----------|-------|
| `corporate-blue` | countdown | Professionnel bleu fonce |
| `startup-launch` | gradient | Violet/rose dynamique |
| `minimal-elegant` | minimal | Noir sobre |
| `glass-premium` | glassmorphism | Violet luxueux |
| `coming-soon-creative` | coming-soon | Teal creatif |
| `light-clean` | minimal | Mode clair epure |
| `warm-gradient` | gradient | Tons chauds orange |
| `tech-dark` | countdown | Cyan technique |

```bash
# Via API
curl -X POST /api/maintenance/presets/apply \
  -H 'Content-Type: application/json' \
  -d '{"presetId": "glass-premium"}'
```

## Collections creees

Le plugin cree automatiquement 2 collections :

- **maintenance-subscribers** : emails newsletter (email, langue, date, IP, user-agent)
- **maintenance-history** : log des activations (action, par qui, quand, duree, details)

## Bypass maintenance

- **Cookie** : `?bypass=VOTRE_SECRET` dans l'URL (cookie 24h)
- **IP whitelist** : configurable dans l'admin, onglet Acces
- **Auth** : les utilisateurs Payload connectes passent automatiquement
- **Routes** : exclure des routes specifiques (ex: `/pricing`, `/legal/*`)

## Architecture

```
@consilioweb/payload-maintenance
  /           -> Plugin, types, globals, endpoints, collections, presets (server)
  /client     -> MaintenancePage, MaintenanceToggle, MaintenanceDashboard (React)
  /views      -> MaintenanceView (server component, DefaultTemplate)
  /middleware  -> createMaintenanceMiddleware (Next.js middleware)
```

## Compatibilite

- Payload CMS 3.x
- Next.js 14/15
- React 18/19
- SQLite / PostgreSQL / tout adapter Payload

## Licence

MIT

## Auteur

[ConsilioWEB](https://consilioweb.fr)
