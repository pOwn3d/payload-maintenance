'use client'

import React, { useCallback, useEffect, useState } from 'react'

// ─── i18n ───
const toggleTranslations: Record<string, Record<string, string>> = {
  fr: {
    maintenanceActive: 'Maintenance active',
    siteOnline: 'Site en ligne',
    disable: 'Desactiver la maintenance',
    enable: 'Activer la maintenance',
  },
  en: {
    maintenanceActive: 'Maintenance active',
    siteOnline: 'Site online',
    disable: 'Disable maintenance',
    enable: 'Enable maintenance',
  },
}

function useToggleLang(): string {
  if (typeof navigator === 'undefined') return 'fr'
  const lang = navigator.language.split('-')[0]
  return lang in toggleTranslations ? lang : 'en'
}

function tt(lang: string, key: string): string {
  return toggleTranslations[lang]?.[key] || toggleTranslations.en?.[key] || key
}

interface MaintenanceToggleProps {
  /** Base API path (default: '/api/maintenance') */
  basePath?: string
}

export const MaintenanceToggle: React.FC<MaintenanceToggleProps> = ({
  basePath = '/api/maintenance',
}) => {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(false)
  const lang = useToggleLang()

  useEffect(() => {
    fetch(`${basePath}/status`)
      .then((r) => r.json())
      .then((d) => {
        setEnabled(Boolean(d.enabled))
        if (d.showDashboardToggle === false) setVisible(false)
      })
      .catch(() => setEnabled(false))
  }, [basePath])

  const toggle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${basePath}/toggle`, { method: 'POST' })
      const data = await res.json()
      setEnabled(Boolean(data.enabled))
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [basePath])

  if (enabled === null || !visible) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.75rem',
        fontSize: '0.8rem',
      }}
    >
      <style>{`
        .maint-toggle-switch {
          position: relative;
          width: 36px;
          height: 20px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: background 0.25s ease;
          flex-shrink: 0;
          padding: 0;
        }
        .maint-toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          transition: transform 0.25s ease;
        }
        .maint-toggle-switch[data-on="true"] { background: #ef4444; }
        .maint-toggle-switch[data-on="false"] { background: #22c55e; }
        .maint-toggle-switch[data-on="true"]::after { transform: translateX(16px); }
        .maint-toggle-switch:disabled { opacity: 0.5; cursor: wait; }
      `}</style>
      <button
        className="maint-toggle-switch"
        data-on={String(enabled)}
        onClick={toggle}
        disabled={loading}
        title={enabled ? tt(lang, 'disable') : tt(lang, 'enable')}
      />
      <span style={{
        fontWeight: 500,
        color: enabled ? '#ef4444' : '#16a34a',
      }}>
        {enabled ? tt(lang, 'maintenanceActive') : tt(lang, 'siteOnline')}
      </span>
    </div>
  )
}
