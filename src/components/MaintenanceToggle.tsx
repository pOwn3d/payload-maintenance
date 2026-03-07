'use client'

import React, { useCallback, useEffect, useState } from 'react'

interface MaintenanceToggleProps {
  /** Base API path (default: '/api/maintenance') */
  basePath?: string
}

export const MaintenanceToggle: React.FC<MaintenanceToggleProps> = ({
  basePath = '/api/maintenance',
}) => {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${basePath}/status`)
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
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

  if (enabled === null) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        background: enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        border: `1px solid ${enabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
        transition: 'all 0.3s',
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: enabled ? '#ef4444' : '#22c55e',
          animation: enabled ? 'blink 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
        {enabled ? 'Maintenance active' : 'Site en ligne'}
      </span>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          marginLeft: 'auto',
          padding: '0.35rem 0.75rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: enabled ? '#22c55e' : '#ef4444',
          color: '#fff',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? '...' : enabled ? 'Desactiver' : 'Activer'}
      </button>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
