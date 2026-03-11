'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface MaintenanceStatus {
  enabled: boolean
  template: string
  messages: Array<{ language: string; title: string; description: string }>
  estimatedEnd?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

interface HistoryEvent {
  action: string
  triggeredBy: string
  timestamp: string
  duration?: string
}

interface Stats {
  subscribersCount: number
  recentHistory: HistoryEvent[]
}

interface PresetInfo {
  id: string
  name: { fr: string; en: string }
  description: { fr: string; en: string }
  preview: string
  template: string
}

// ─── i18n ───
const dashboardTranslations: Record<string, Record<string, string>> = {
  fr: {
    title: 'Mode Maintenance',
    subtitle: 'Gerez le mode maintenance de votre site',
    hidePresets: 'Masquer presets',
    showPresets: 'Templates presets',
    hidePreview: 'Masquer preview',
    showPreview: 'Preview',
    disable: 'Desactiver',
    enable: 'Activer',
    presetsTitle: 'Templates pre-configures — Cliquez pour appliquer',
    status: 'Statut',
    maintenanceActive: 'Maintenance ACTIVE',
    siteOnline: 'Site en ligne',
    template: 'Template',
    subscribers: 'Abonnes',
    scheduling: 'Planification',
    schedStart: 'Debut',
    schedEnd: 'Fin',
    messages: 'Messages',
    history: 'Historique',
    by: 'par',
    advancedConfig: 'Pour les parametres avances,',
    editGlobal: 'editez la configuration globale',
    loading: 'Chargement...',
    activated: 'Active',
    deactivated: 'Desactive',
    scheduledStart: 'Debut planifie',
    scheduledEnd: 'Fin planifiee',
    configUpdated: 'Config modifiee',
  },
  en: {
    title: 'Maintenance Mode',
    subtitle: 'Manage your site maintenance mode',
    hidePresets: 'Hide presets',
    showPresets: 'Template presets',
    hidePreview: 'Hide preview',
    showPreview: 'Preview',
    disable: 'Disable',
    enable: 'Enable',
    presetsTitle: 'Pre-configured templates — Click to apply',
    status: 'Status',
    maintenanceActive: 'Maintenance ACTIVE',
    siteOnline: 'Site online',
    template: 'Template',
    subscribers: 'Subscribers',
    scheduling: 'Scheduling',
    schedStart: 'Start',
    schedEnd: 'End',
    messages: 'Messages',
    history: 'History',
    by: 'by',
    advancedConfig: 'For advanced settings,',
    editGlobal: 'edit the global configuration',
    loading: 'Loading...',
    activated: 'Activated',
    deactivated: 'Deactivated',
    scheduledStart: 'Scheduled start',
    scheduledEnd: 'Scheduled end',
    configUpdated: 'Config updated',
  },
}

function useDashboardLang(): string {
  if (typeof navigator === 'undefined') return 'fr'
  const lang = navigator.language.split('-')[0]
  return lang in dashboardTranslations ? lang : 'en'
}

function dt(lang: string, key: string): string {
  return dashboardTranslations[lang]?.[key] || dashboardTranslations.en?.[key] || key
}

export const MaintenanceDashboard: React.FC = () => {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [presets, setPresets] = useState<PresetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [presetSuccess, setPresetSuccess] = useState<string | null>(null)
  const lang = useDashboardLang()

  const fetchAll = useCallback(async () => {
    try {
      const [statusResult, statsResult, presetsResult] = await Promise.allSettled([
        fetch('/api/maintenance/status'),
        fetch('/api/maintenance/stats'),
        fetch('/api/maintenance/presets'),
      ])
      if (statusResult.status === 'fulfilled' && statusResult.value.ok) {
        setStatus(await statusResult.value.json())
      }
      if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
        setStats(await statsResult.value.json())
      }
      if (presetsResult.status === 'fulfilled' && presetsResult.value.ok) {
        const data = await presetsResult.value.json()
        setPresets(data.presets || [])
      }
    } catch {}
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/maintenance/toggle', { method: 'POST' })
      const data = await res.json()
      setStatus((prev) => (prev ? { ...prev, enabled: data.enabled } : null))
      setTimeout(fetchAll, 500)
    } catch {} finally { setLoading(false) }
  }, [fetchAll])

  const applyPreset = useCallback(async (presetId: string) => {
    setApplyingPreset(presetId)
    try {
      const res = await fetch('/api/maintenance/presets/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      })
      if (res.ok) {
        setPresetSuccess(presetId)
        setTimeout(() => setPresetSuccess(null), 3000)
        fetchAll()
      }
    } catch {} finally { setApplyingPreset(null) }
  }, [fetchAll])

  if (!status) return <p>{dt(lang, 'loading')}</p>

  const actionLabels: Record<string, string> = {
    'activated': dt(lang, 'activated'),
    'deactivated': dt(lang, 'deactivated'),
    'scheduled-start': dt(lang, 'scheduledStart'),
    'scheduled-end': dt(lang, 'scheduledEnd'),
    'config-updated': dt(lang, 'configUpdated'),
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{dt(lang, 'title')}</h1>
          <p style={{ opacity: 0.7, margin: '0.25rem 0 0' }}>{dt(lang, 'subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => { setShowPresets(!showPresets); setShowPreview(false) }}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: '1px solid rgba(168,85,247,0.3)', background: showPresets ? 'rgba(168,85,247,0.1)' : 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#a855f7' }}>
            {showPresets ? dt(lang, 'hidePresets') : dt(lang, 'showPresets')}
          </button>
          <button onClick={() => { setShowPreview(!showPreview); setShowPresets(false) }}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: '1px solid rgba(128,128,128,0.3)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
            {showPreview ? dt(lang, 'hidePreview') : dt(lang, 'showPreview')}
          </button>
          <button onClick={toggle} disabled={loading}
            style={{ padding: '0.6rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: status.enabled ? '#22c55e' : '#ef4444', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
            {loading ? '...' : status.enabled ? dt(lang, 'disable') : dt(lang, 'enable')}
          </button>
        </div>
      </div>

      {/* Presets gallery */}
      {showPresets && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            {dt(lang, 'presetsTitle')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                disabled={applyingPreset === preset.id}
                style={{
                  padding: 0, borderRadius: '0.75rem', overflow: 'hidden',
                  border: presetSuccess === preset.id ? '2px solid #22c55e' : '1px solid rgba(128,128,128,0.2)',
                  background: 'transparent', cursor: applyingPreset ? 'wait' : 'pointer',
                  textAlign: 'left', transition: 'all 0.2s',
                  transform: presetSuccess === preset.id ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {/* Preview gradient */}
                <div style={{
                  height: '100px', background: preset.preview,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>
                    {preset.template}
                  </span>
                  {presetSuccess === preset.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                  )}
                  {applyingPreset === preset.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 24, height: 24, border: '3px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '0.75rem 1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.25rem' }}>{preset.name.fr}</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0, lineHeight: 1.4 }}>{preset.description.fr}</p>
                </div>
              </button>
            ))}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: status.enabled ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${status.enabled ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: status.enabled ? '#ef4444' : '#22c55e' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dt(lang, 'status')}</span>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{status.enabled ? dt(lang, 'maintenanceActive') : dt(lang, 'siteOnline')}</span>
        </div>
        <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>{dt(lang, 'template')}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'capitalize' }}>{status.template}</span>
        </div>
        {stats && (
          <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dt(lang, 'subscribers')}</span>
              {stats.subscribersCount > 0 && <a href="/api/maintenance/subscribers/export" style={{ fontSize: '0.7rem', color: '#a855f7' }}>CSV</a>}
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.subscribersCount}</span>
          </div>
        )}
        {(status.scheduledStart || status.scheduledEnd) && (
          <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>{dt(lang, 'scheduling')}</span>
            {status.scheduledStart && <div style={{ fontSize: '0.8rem' }}>{dt(lang, 'schedStart')}: {new Date(status.scheduledStart).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</div>}
            {status.scheduledEnd && <div style={{ fontSize: '0.8rem' }}>{dt(lang, 'schedEnd')}: {new Date(status.scheduledEnd).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</div>}
          </div>
        )}
      </div>

      {/* Preview */}
      {showPreview && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>{dt(lang, 'showPreview')}</h2>
          <div style={{ borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(128,128,128,0.2)', height: '500px' }}>
            <iframe src="/maintenance?preview=true" style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
          </div>
        </div>
      )}

      {/* Messages */}
      {status.messages?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{dt(lang, 'messages')} ({status.messages.length})</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {status.messages.map((msg, i) => (
              <div key={i} style={{ padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.05)' }}>
                <strong style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.6 }}>{msg.language}</strong>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5rem 0 0.25rem' }}>{msg.title}</h3>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>{msg.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {stats?.recentHistory && stats.recentHistory.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{dt(lang, 'history')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.recentHistory.map((event, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(128,128,128,0.05)', border: '1px solid rgba(128,128,128,0.1)', fontSize: '0.85rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: event.action === 'activated' ? '#ef4444' : event.action === 'deactivated' ? '#22c55e' : '#fbbf24' }} />
                <span style={{ fontWeight: 600 }}>{actionLabels[event.action] || event.action}</span>
                <span style={{ opacity: 0.6 }}>{dt(lang, 'by')} {event.triggeredBy}</span>
                {event.duration && <span style={{ opacity: 0.5 }}>({event.duration})</span>}
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.8rem' }}>{new Date(event.timestamp).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config link */}
      <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          {dt(lang, 'advancedConfig')}{' '}
          <a href="/admin/globals/maintenance" style={{ color: '#3b82f6', fontWeight: 600 }}>{dt(lang, 'editGlobal')}</a>.
        </p>
      </div>
    </div>
  )
}
