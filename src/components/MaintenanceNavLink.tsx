// Nav group component injected by the Maintenance plugin into Payload admin sidebar (afterNavLinks)
// Matches the SeoNavLink pattern: group title + items with border-left active indicator
'use client'

import React, { useEffect, useState } from 'react'
// @ts-ignore — next is a peer dependency
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface PluginConfig {
  globalSlug: string
  subscribersSlug: string
  historySlug: string
  basePath: string
}

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

const translations: Record<string, Record<string, string>> = {
  en: {
    group: 'Maintenance',
    dashboard: 'Dashboard',
    subscribers: 'Subscribers',
    history: 'History',
    settings: 'Settings',
  },
  fr: {
    group: 'Maintenance',
    dashboard: 'Tableau de bord',
    subscribers: 'Abonnés',
    history: 'Historique',
    settings: 'Configuration',
  },
}

function useNavLang(): string {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language.split('-')[0]
  return lang in translations ? lang : 'en'
}

// Default slugs used until the config endpoint responds
const defaultConfig: PluginConfig = {
  globalSlug: 'maintenance',
  subscribersSlug: 'maintenance-subscribers',
  historySlug: 'maintenance-history',
  basePath: '/maintenance',
}

export function MaintenanceNavLink() {
  const pathname = usePathname()
  const lang = useNavLang()
  const t = translations[lang] || translations.en
  const [cfg, setCfg] = useState<PluginConfig>(defaultConfig)

  useEffect(() => {
    // Fetch actual plugin config so slugs stay in sync with plugin options
    fetch('/api/maintenance/config')
      .then((res) => {
        if (res.ok) return res.json()
        return null
      })
      .then((data) => {
        if (data) setCfg(data)
      })
      .catch((err) => {
        console.warn('[maintenance] Failed to fetch plugin config for nav', err)
      })
  }, [])

  const adminPrefix = pathname?.match(/^(\/[^/]+)\//)?.[1] || '/admin'

  const items: NavItem[] = [
    {
      href: `${adminPrefix}/maintenance`,
      label: t.dashboard,
      icon: (
        <svg {...svgProps}>
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/collections/${cfg.subscribersSlug}`,
      label: t.subscribers,
      icon: (
        <svg {...svgProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/collections/${cfg.historySlug}`,
      label: t.history,
      icon: (
        <svg {...svgProps}>
          <path d="M3 3v5h5" />
          <path d="M3 8a9 9 0 1 1 .83 4" />
          <path d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      href: `${adminPrefix}/globals/${cfg.globalSlug}`,
      label: t.settings,
      icon: (
        <svg {...svgProps}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ paddingTop: 8, marginTop: 8, borderTop: '1px solid var(--theme-elevation-200)' }}>
      <div
        style={{
          padding: '4px 16px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'var(--theme-elevation-400)',
        }}
      >
        {t.group}
      </div>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              margin: '2px 8px',
              borderRadius: 6,
              borderLeft: isActive ? '3px solid var(--theme-elevation-900)' : '3px solid transparent',
              backgroundColor: isActive ? 'var(--theme-elevation-100)' : 'transparent',
              color: isActive ? 'var(--theme-text)' : 'var(--theme-elevation-500)',
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              textDecoration: 'none',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {item.icon}
            {item.label}
          </a>
        )
      })}
    </div>
  )
}