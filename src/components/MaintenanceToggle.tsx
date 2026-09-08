'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { MaintenanceErrorBoundary } from './ErrorBoundary.js'

// ─── i18n ───
const toggleTranslations: Record<string, Record<string, string>> = {
  fr: {
    maintenanceActive: 'Maintenance active',
    siteOnline: 'Site en ligne',
    disable: 'Desactiver la maintenance',
    enable: 'Activer la maintenance',
    toggleFailed: 'Echec — etat inchange',
  },
  en: {
    maintenanceActive: 'Maintenance active',
    siteOnline: 'Site online',
    disable: 'Disable maintenance',
    enable: 'Enable maintenance',
    toggleFailed: 'Failed — state unchanged',
  },
}

/**
 * Language for the toggle labels.
 *
 * Same hydration trap as MaintenanceNavLink, with an extra twist: the SSR branch
 * returned 'fr' while the client branch fell back to 'en', so an English browser
 * rendered "Site en ligne" on the server and "Site online" on the client — a
 * guaranteed #418 for every non-French user.
 *
 * Fix: start on the server's value and switch inside an effect, which only runs
 * once hydration has completed.
 */
function useToggleLang(): string {
  const [lang, setLang] = useState('en')

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const detected = navigator.language.split('-')[0]
    // hasOwnProperty rather than `in`: 'constructor' is `in` every object.
    if (Object.prototype.hasOwnProperty.call(toggleTranslations, detected)) {
      setLang(detected)
    }
  }, [])

  return lang
}

function tt(lang: string, key: string): string {
  return toggleTranslations[lang]?.[key] || toggleTranslations.en?.[key] || key
}

interface MaintenanceToggleProps {
  /** Base API path (default: '/api/maintenance') */
  basePath?: string
}

const MaintenanceToggleInner: React.FC<MaintenanceToggleProps> = ({
  basePath = '/api/maintenance',
}) => {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const lang = useToggleLang()

  useEffect(() => {
    fetch(`${basePath}/status`)
      .then((r) => {
        // Never claim "site online" from a failed status call: /status answers
        // 503 when the global cannot be read.
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setEnabled(Boolean(d.enabled))
        if (d.showDashboardToggle === false) setVisible(false)
      })
      // Unknown status: hide the widget rather than display a green "site online".
      .catch(() => setVisible(false))
  }, [basePath])

  const toggle = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`${basePath}/toggle`, { method: 'POST' })
      // Same invariant as the /status read: never derive the switch from a
      // failed call. A 401 (caller is not a maintenance admin) or the handler's
      // 500 answers a JSON error body whose `enabled` is undefined, and
      // `Boolean(undefined)` used to flip the widget to a green "site online"
      // while the site was still down.
      if (!res.ok) throw new Error(`toggle ${res.status}`)
      const data = await res.json()
      if (typeof data?.enabled !== 'boolean') throw new Error('malformed toggle response')
      setEnabled(data.enabled)
    } catch (err) {
      console.warn('[maintenance] Toggle failed', err)
      setFailed(true)
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
      {failed && (
        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{tt(lang, 'toggleFailed')}</span>
      )}
    </div>
  )
}

/**
 * Injected in `beforeDashboard`. Smaller blast radius than the nav link — only
 * the admin home page — but the same reasoning: Payload mounts it from the
 * import map, so the boundary has to live inside the module.
 *
 * `fallback={null}` because the widget is a shortcut, not the feature: the real
 * switch is at `/admin/maintenance` and on the global. A broken shortcut must
 * not push an error panel above the dashboard.
 */
export const MaintenanceToggle: React.FC<MaintenanceToggleProps> = (props) => (
  <MaintenanceErrorBoundary boundaryName="MaintenanceToggle" fallback={null}>
    <MaintenanceToggleInner {...props} />
  </MaintenanceErrorBoundary>
)
