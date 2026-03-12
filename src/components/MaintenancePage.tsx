'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'

// ─── Types ───

interface MaintenanceMessage {
  language: string
  title: string
  description: string
  buttonLabel?: string
  buttonUrl?: string
}

interface SocialLink {
  platform: string
  url: string
  label?: string
}

interface MaintenanceData {
  enabled: boolean
  template: string
  maintenanceType?: 'maintenance' | 'coming-soon' | 'upgrade' | 'emergency'
  messages: MaintenanceMessage[]
  estimatedEnd?: string | null
  logoUrl?: string | null
  backgroundImageUrl?: string | null
  faviconUrl?: string | null
  backgroundColor?: string
  textColor?: string
  accentColor?: string
  backgroundOverlayOpacity?: number
  showProgressBar?: boolean
  customCSS?: string | null
  customHTML?: string | null
  socialLinks?: SocialLink[]
  contactEmail?: string | null
  showNewsletterForm?: boolean
  newsletterPlaceholder?: string
  newsletterButtonLabel?: string
  // New features
  darkMode?: 'auto' | 'light' | 'dark'
  googleFont?: string | null
  lottieUrl?: string | null
  splitImageUrl?: string | null
  videoUrl?: string | null
}

interface MaintenancePageProps {
  statusEndpoint?: string
  forceLang?: string
}

// ─── i18n ───

const i18n: Record<string, Record<string, string>> = {
  fr: {
    days: 'Jours', hours: 'Heures', minutes: 'Minutes', seconds: 'Secondes',
    returnDate: 'Retour prevu le',
    contact: 'Nous contacter',
    newsletterSuccess: 'Merci ! Vous serez notifie(e) du retour du site.',
    newsletterError: 'Une erreur est survenue. Veuillez reessayer.',
    followUs: 'Suivez-nous',
    loading: 'Chargement...',
  },
  en: {
    days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    returnDate: 'Expected return on',
    contact: 'Contact us',
    newsletterSuccess: 'Thank you! You will be notified when the site is back.',
    newsletterError: 'An error occurred. Please try again.',
    followUs: 'Follow us',
    loading: 'Loading...',
  },
  de: {
    days: 'Tage', hours: 'Stunden', minutes: 'Minuten', seconds: 'Sekunden',
    returnDate: 'Voraussichtliche Ruckkehr am',
    contact: 'Kontaktieren Sie uns',
    newsletterSuccess: 'Danke! Sie werden benachrichtigt.',
    newsletterError: 'Ein Fehler ist aufgetreten.',
    followUs: 'Folgen Sie uns',
    loading: 'Laden...',
  },
  es: {
    days: 'Dias', hours: 'Horas', minutes: 'Minutos', seconds: 'Segundos',
    returnDate: 'Regreso previsto el',
    contact: 'Contactenos',
    newsletterSuccess: 'Gracias! Le notificaremos.',
    newsletterError: 'Ha ocurrido un error.',
    followUs: 'Siguenos',
    loading: 'Cargando...',
  },
  it: {
    days: 'Giorni', hours: 'Ore', minutes: 'Minuti', seconds: 'Secondi',
    returnDate: 'Ritorno previsto il',
    contact: 'Contattaci',
    newsletterSuccess: 'Grazie! Sarai avvisato.',
    newsletterError: 'Si e verificato un errore.',
    followUs: 'Seguici',
    loading: 'Caricamento...',
  },
  pt: {
    days: 'Dias', hours: 'Horas', minutes: 'Minutos', seconds: 'Segundos',
    returnDate: 'Retorno previsto em',
    contact: 'Contacte-nos',
    newsletterSuccess: 'Obrigado! Sera notificado.',
    newsletterError: 'Ocorreu um erro.',
    followUs: 'Siga-nos',
    loading: 'Carregando...',
  },
  nl: {
    days: 'Dagen', hours: 'Uren', minutes: 'Minuten', seconds: 'Seconden',
    returnDate: 'Verwachte terugkeer op',
    contact: 'Neem contact op',
    newsletterSuccess: 'Bedankt! U wordt op de hoogte gebracht.',
    newsletterError: 'Er is een fout opgetreden.',
    followUs: 'Volg ons',
    loading: 'Laden...',
  },
  ja: {
    days: '日', hours: '時間', minutes: '分', seconds: '秒',
    returnDate: '復旧予定日',
    contact: 'お問い合わせ',
    newsletterSuccess: 'ありがとうございます！',
    newsletterError: 'エラーが発生しました。',
    followUs: 'フォロー',
    loading: '読み込み中...',
  },
  ar: {
    days: 'أيام', hours: 'ساعات', minutes: 'دقائق', seconds: 'ثوانٍ',
    returnDate: 'تاريخ العودة المتوقع',
    contact: 'اتصل بنا',
    newsletterSuccess: 'شكراً لك!',
    newsletterError: 'حدث خطأ.',
    followUs: 'تابعنا',
    loading: 'جار التحميل...',
  },
  zh: {
    days: '天', hours: '小时', minutes: '分钟', seconds: '秒',
    returnDate: '预计恢复日期',
    contact: '联系我们',
    newsletterSuccess: '谢谢！',
    newsletterError: '发生错误。',
    followUs: '关注我们',
    loading: '加载中...',
  },
}

function t(lang: string, key: string): string {
  return i18n[lang]?.[key] || i18n.en?.[key] || key
}

// ─── Helpers ───

/**
 * Simple inline HTML sanitizer — strips dangerous tags and attributes.
 * No external dependencies needed (runs client-side in standalone maintenance page).
 */
function sanitizeHTML(html: string): string {
  // Remove dangerous tags and their content
  let clean = html.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
  clean = clean.replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
  clean = clean.replace(/<\s*object\b[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '')
  clean = clean.replace(/<\s*embed\b[^>]*\/?>/gi, '')
  clean = clean.replace(/<\s*form\b[^>]*>[\s\S]*?<\s*\/\s*form\s*>/gi, '')
  // Remove self-closing / orphan variants
  clean = clean.replace(/<\s*script\b[^>]*\/?>/gi, '')
  clean = clean.replace(/<\s*iframe\b[^>]*\/?>/gi, '')
  clean = clean.replace(/<\s*object\b[^>]*\/?>/gi, '')
  // Remove on* event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']?\s*javascript\s*:[^"'>]*/gi, 'href="#"')
  clean = clean.replace(/src\s*=\s*["']?\s*javascript\s*:[^"'>]*/gi, 'src=""')
  clean = clean.replace(/action\s*=\s*["']?\s*javascript\s*:[^"'>]*/gi, 'action=""')
  return clean
}

function detectLanguage(messages: MaintenanceMessage[]): string {
  if (typeof navigator === 'undefined') return messages[0]?.language || 'fr'
  const browserLang = navigator.language.split('-')[0]
  const match = messages.find((m) => m.language === browserLang)
  return match ? browserLang : messages[0]?.language || 'fr'
}

function formatDate(dateStr: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

// ─── Dark/Light Mode Hook ───

function useColorMode(mode: 'auto' | 'light' | 'dark' = 'dark') {
  const [isDark, setIsDark] = useState(mode !== 'light')

  useEffect(() => {
    if (mode !== 'auto') {
      setIsDark(mode === 'dark')
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  return isDark
}

// ─── Countdown Hook ───

function useCountdown(targetDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false })

  useEffect(() => {
    if (!targetDate) return
    const target = new Date(targetDate).getTime()

    const update = () => {
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        expired: false,
      })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

// ─── Social Icons (inline SVG paths) ───

const socialPaths: Record<string, string> = {
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  instagram: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2m4.5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6m5.1-2.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4',
  twitter: 'M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4h-2L12.3 10 8 4H4',
  linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
  youtube: 'M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.6C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z',
  tiktok: 'M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
  other: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
}

// ─── Sub-components ───

function SocialIcon({ platform, color }: { platform: string; color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={socialPaths[platform] || socialPaths.other} />
    </svg>
  )
}

function CountdownRing({ value, max, label, accent, textColor }: {
  value: number; max: number; label: string; accent: string; textColor: string
}) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = ((max - value) / max) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <svg width="96" height="96" viewBox="0 0 96 96" style={{ filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' }}>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={accent} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x="48" y="48" textAnchor="middle" dominantBaseline="central"
          fill={textColor} fontSize="28" fontWeight="700" fontFamily="inherit"
          style={{ fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}
        >
          {String(value).padStart(2, '0')}
        </text>
      </svg>
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.6, color: textColor }}>
        {label}
      </span>
    </div>
  )
}

function CountdownFlip({ value, label, accent, textColor, glass }: {
  value: number; label: string; accent: string; textColor: string; glass?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{
        position: 'relative',
        width: '76px', height: '84px',
        borderRadius: '0.75rem',
        background: glass ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${glass ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: glass ? 'blur(20px)' : 'blur(12px)',
        boxShadow: glass
          ? '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          height: '1px', background: 'rgba(0,0,0,0.2)',
        }} />
        <span style={{
          fontSize: '2.5rem', fontWeight: 800, color: textColor,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 20px ${accent}33`,
        }}>
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span style={{
        fontSize: '0.65rem', textTransform: 'uppercase',
        letterSpacing: '0.15em', opacity: 0.5, color: textColor, fontWeight: 500,
      }}>
        {label}
      </span>
    </div>
  )
}

function Separator({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '1.2rem' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, opacity: 0.4, animation: 'maint-blink 1.5s ease-in-out infinite' }} />
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, opacity: 0.4, animation: 'maint-blink 1.5s ease-in-out infinite 0.5s' }} />
    </div>
  )
}

function NewsletterForm({ placeholder, buttonLabel, accent, textColor, apiBase, lang }: {
  placeholder: string; buttonLabel: string; accent: string; textColor: string; apiBase: string; lang: string
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch(`${apiBase}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: lang }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch { setStatus('error') }
  }, [email, apiBase, lang])

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: accent }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t(lang, 'newsletterSuccess')}</span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '440px' }}>
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder} required
        style={{
          flex: 1, padding: '0.7rem 1rem', borderRadius: '0.5rem',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)', color: textColor,
          fontSize: '0.9rem', outline: 'none',
          backdropFilter: 'blur(8px)',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = accent}
        onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
      />
      <button type="submit" disabled={status === 'loading'} style={{
        padding: '0.7rem 1.5rem', borderRadius: '0.5rem', border: 'none',
        background: accent, color: '#fff', fontWeight: 600, fontSize: '0.9rem',
        cursor: status === 'loading' ? 'wait' : 'pointer',
        opacity: status === 'loading' ? 0.6 : 1, whiteSpace: 'nowrap',
        transition: 'transform 0.15s, opacity 0.2s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {status === 'loading' ? '...' : buttonLabel}
      </button>
    </form>
  )
}

function LanguageSwitcher({ languages, current, onChange, accent, textColor }: {
  languages: string[]; current: string; onChange: (l: string) => void; accent: string; textColor: string
}) {
  if (languages.length <= 1) return null
  return (
    <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', display: 'flex', gap: '0.35rem', zIndex: 20 }}>
      {languages.map((lang) => (
        <button
          key={lang} onClick={() => onChange(lang)}
          style={{
            padding: '0.35rem 0.7rem',
            border: current === lang ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '0.375rem',
            background: current === lang ? accent : 'rgba(0,0,0,0.4)',
            color: textColor, cursor: 'pointer', fontSize: '0.75rem',
            fontWeight: current === lang ? 700 : 400,
            textTransform: 'uppercase', transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
          }}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}

function SocialLinks({ links, textColor, accent }: { links: SocialLink[]; textColor: string; accent: string }) {
  if (!links?.length) return null
  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      {links.map((link, i) => (
        <a
          key={i} href={link.url} target="_blank" rel="noopener noreferrer"
          title={link.label || link.platform}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '40px', height: '40px', borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            transition: 'all 0.25s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = accent
            e.currentTarget.style.borderColor = accent
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <SocialIcon platform={link.platform} color={textColor} />
        </a>
      ))}
    </div>
  )
}

function LottiePlayer({ url }: { url: string }) {
  return (
    <div style={{ width: '200px', height: '200px', margin: '0 auto 1.5rem' }}>
      {/* @ts-ignore — dotlottie-player is loaded via script */}
      <dotlottie-player
        src={url}
        background="transparent"
        speed="1"
        style={{ width: '100%', height: '100%' }}
        loop
        autoplay
      />
    </div>
  )
}

// ─── Content Block (shared across templates) ───

// Maintenance type emoji mapping
const maintenanceTypeEmojis: Record<string, string> = {
  'maintenance': '\uD83D\uDD27',
  'coming-soon': '\uD83D\uDE80',
  'upgrade': '\u2B06\uFE0F',
  'emergency': '\uD83D\uDEA8',
}

function ContentBlock({ data, message, countdown, currentLang, accent, textColor, apiBase, glass }: {
  data: MaintenanceData; message: MaintenanceMessage | undefined
  countdown: ReturnType<typeof useCountdown>
  currentLang: string; accent: string; textColor: string; apiBase: string; glass?: boolean
}) {
  const showCountdown = ['countdown', 'coming-soon', 'glassmorphism', 'gradient'].includes(data.template) && data.estimatedEnd && !countdown.expired
  const useRings = data.template === 'countdown'
  const useFlip = data.template === 'coming-soon' || data.template === 'glassmorphism' || data.template === 'gradient'

  return (
    <>
      {/* Maintenance type icon */}
      {data.maintenanceType && (
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }} role="img" aria-label={data.maintenanceType}>
          {maintenanceTypeEmojis[data.maintenanceType] || maintenanceTypeEmojis['maintenance']}
        </div>
      )}

      {/* Lottie */}
      {data.lottieUrl && <LottiePlayer url={data.lottieUrl} />}

      {/* Logo */}
      {data.logoUrl && (
        <img src={data.logoUrl} alt="Logo" style={{
          maxWidth: '220px', maxHeight: '80px', marginBottom: '1.5rem', objectFit: 'contain',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
        }} />
      )}

      {/* Icon for minimal template */}
      {!data.logoUrl && !data.lottieUrl && (data.template === 'minimal' || data.template === 'video-background') && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: `${accent}15`, border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'maint-float 3s ease-in-out infinite',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>
      )}

      {/* Title */}
      <h1 style={{
        fontSize: 'clamp(1.5rem, 4.5vw, 2.75rem)', fontWeight: 800,
        marginBottom: '0.5rem', lineHeight: 1.15,
        background: `linear-gradient(135deg, ${textColor}, ${accent})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {message?.title || 'Maintenance'}
      </h1>

      {/* Description */}
      <p style={{
        fontSize: 'clamp(0.9rem, 2.2vw, 1.1rem)', opacity: 0.75,
        maxWidth: '520px', lineHeight: 1.75, marginBottom: '1.5rem',
        whiteSpace: 'pre-line',
      }}>
        {message?.description || ''}
      </p>

      {/* Countdown */}
      {showCountdown && (
        <div style={{ marginBottom: '2rem' }}>
          {useRings ? (
            <div style={{ display: 'flex', gap: 'clamp(0.5rem, 2vw, 1.25rem)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <CountdownRing value={countdown.days} max={365} label={t(currentLang, 'days')} accent={accent} textColor={textColor} />
              <CountdownRing value={countdown.hours} max={24} label={t(currentLang, 'hours')} accent={accent} textColor={textColor} />
              <CountdownRing value={countdown.minutes} max={60} label={t(currentLang, 'minutes')} accent={accent} textColor={textColor} />
              <CountdownRing value={countdown.seconds} max={60} label={t(currentLang, 'seconds')} accent={accent} textColor={textColor} />
            </div>
          ) : useFlip ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.4rem, 1.5vw, 0.75rem)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <CountdownFlip value={countdown.days} label={t(currentLang, 'days')} accent={accent} textColor={textColor} glass={glass} />
              <Separator color={accent} />
              <CountdownFlip value={countdown.hours} label={t(currentLang, 'hours')} accent={accent} textColor={textColor} glass={glass} />
              <Separator color={accent} />
              <CountdownFlip value={countdown.minutes} label={t(currentLang, 'minutes')} accent={accent} textColor={textColor} glass={glass} />
              <Separator color={accent} />
              <CountdownFlip value={countdown.seconds} label={t(currentLang, 'seconds')} accent={accent} textColor={textColor} glass={glass} />
            </div>
          ) : null}
        </div>
      )}

      {/* Estimated end for templates without countdown */}
      {!showCountdown && data.estimatedEnd && (
        <p style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1.5rem' }}>
          {t(currentLang, 'returnDate')} {formatDate(data.estimatedEnd, currentLang)}
        </p>
      )}

      {/* Newsletter */}
      {data.showNewsletterForm && (
        <div style={{ marginBottom: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <NewsletterForm
            placeholder={data.newsletterPlaceholder || 'votre@email.com'}
            buttonLabel={data.newsletterButtonLabel || 'Me notifier'}
            accent={accent} textColor={textColor} apiBase={apiBase} lang={currentLang}
          />
        </div>
      )}

      {/* CTA Button */}
      {message?.buttonLabel && message?.buttonUrl && (
        <a href={message.buttonUrl} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 2rem', background: accent, color: '#fff',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600,
          fontSize: '0.95rem', transition: 'all 0.25s', marginBottom: '1.5rem',
          boxShadow: `0 4px 14px ${accent}40`,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${accent}50` }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 14px ${accent}40` }}
        >
          {message.buttonLabel}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      )}

      {/* Contact */}
      {data.contactEmail && (
        <a href={`mailto:${data.contactEmail}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          color: textColor, opacity: 0.6, textDecoration: 'none',
          fontSize: '0.85rem', marginBottom: '1.25rem', transition: 'opacity 0.2s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
          {data.contactEmail}
        </a>
      )}

      {/* Social links */}
      <SocialLinks links={data.socialLinks || []} textColor={textColor} accent={accent} />
    </>
  )
}

// ─── Template Wrappers ───

function GlassmorphismTemplate({ data, children, bg, textColor, accent, overlayOpacity }: {
  data: MaintenanceData; children: React.ReactNode; bg: string; textColor: string; accent: string; overlayOpacity: number
}) {
  return (
    <div className="maintenance-root" style={{
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', overflow: 'hidden',
      background: data.backgroundImageUrl ? `url(${data.backgroundImageUrl}) center/cover no-repeat fixed` : `linear-gradient(135deg, ${bg}, ${accent}22)`,
      color: textColor,
    }}>
      {data.backgroundImageUrl && (
        <div style={{ position: 'absolute', inset: 0, background: bg, opacity: overlayOpacity, zIndex: 0 }} />
      )}

      {/* Glassmorphism card */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: '600px', width: '90%',
        padding: '3rem 2.5rem',
        borderRadius: '1.5rem',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
      }}>
        {children}
      </div>

      {/* Floating orbs */}
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: accent, opacity: 0.08, top: '10%', left: '5%', filter: 'blur(60px)', animation: 'maint-float 6s ease-in-out infinite', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: accent, opacity: 0.06, bottom: '10%', right: '10%', filter: 'blur(60px)', animation: 'maint-float 8s ease-in-out infinite reverse', zIndex: 0 }} />
    </div>
  )
}

function GradientTemplate({ data, children, textColor, accent }: {
  data: MaintenanceData; children: React.ReactNode; textColor: string; accent: string
}) {
  return (
    <div className="maintenance-root" style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', overflow: 'hidden',
      background: `linear-gradient(-45deg, ${accent}, ${accent}88, #667eea, #764ba2, ${accent})`,
      backgroundSize: '400% 400%',
      animation: 'maint-gradient-shift 15s ease infinite',
      color: textColor,
    }}>
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', maxWidth: '720px', width: '100%', padding: '2rem',
        textAlign: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

function SplitScreenTemplate({ data, children, bg, textColor, accent, overlayOpacity }: {
  data: MaintenanceData; children: React.ReactNode; bg: string; textColor: string; accent: string; overlayOpacity: number
}) {
  const imageUrl = data.splitImageUrl || data.backgroundImageUrl
  return (
    <div className="maintenance-root" style={{
      display: 'flex', minHeight: '100vh', color: textColor,
    }}>
      {/* Left: content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem 2rem', background: bg,
        textAlign: 'center', minWidth: 0,
      }}>
        <div style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {children}
        </div>
      </div>

      {/* Right: image */}
      {imageUrl && (
        <div className="maintenance-split-image" style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: `url(${imageUrl}) center/cover no-repeat`,
          minHeight: '400px',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${accent}33, transparent)` }} />
        </div>
      )}
    </div>
  )
}

function VideoBackgroundTemplate({ data, children, bg, textColor, accent, overlayOpacity }: {
  data: MaintenanceData; children: React.ReactNode; bg: string; textColor: string; accent: string; overlayOpacity: number
}) {
  return (
    <div className="maintenance-root" style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', overflow: 'hidden', color: textColor,
    }}>
      {/* Video */}
      {data.videoUrl && (
        <video
          autoPlay loop muted playsInline
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 0,
          }}
        >
          <source src={data.videoUrl} type="video/mp4" />
        </video>
      )}

      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: bg, opacity: overlayOpacity, zIndex: 1 }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
        alignItems: 'center', maxWidth: '720px', width: '100%', padding: '2rem',
        textAlign: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

function DefaultTemplate({ data, children, bg, textColor, accent, overlayOpacity }: {
  data: MaintenanceData; children: React.ReactNode; bg: string; textColor: string; accent: string; overlayOpacity: number
}) {
  return (
    <div className="maintenance-root" style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', overflow: 'hidden',
      background: data.backgroundImageUrl ? `url(${data.backgroundImageUrl}) center/cover no-repeat fixed` : bg,
      color: textColor,
    }}>
      {data.backgroundImageUrl && (
        <div style={{ position: 'absolute', inset: 0, background: bg, opacity: overlayOpacity, zIndex: 0 }} />
      )}

      {/* Decorative gradient orbs */}
      <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}15, transparent 70%)`, top: '-200px', right: '-100px', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}10, transparent 70%)`, bottom: '-150px', left: '-100px', zIndex: 0 }} />

      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', maxWidth: '720px', width: '100%', padding: '2rem',
        textAlign: 'center', gap: '0.25rem',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Main Component ───

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  statusEndpoint = '/api/maintenance/status',
  forceLang,
}) => {
  const [data, setData] = useState<MaintenanceData | null>(null)
  const [currentLang, setCurrentLang] = useState<string>(forceLang || 'fr')
  const trackedRef = useRef(false)

  useEffect(() => {
    fetch(statusEndpoint)
      .then((r) => r.json())
      .then((d: MaintenanceData) => {
        setData(d)
        if (!forceLang && d.messages?.length) setCurrentLang(detectLanguage(d.messages))
      })
      .catch(() => {
        setData({
          enabled: true, template: 'minimal',
          messages: [{ language: 'fr', title: 'Site en maintenance', description: 'Nous revenons bientot.' }],
        })
      })
  }, [statusEndpoint, forceLang])

  // Track page view once per page load
  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    const trackBase = statusEndpoint.replace('/status', '')
    fetch(`${trackBase}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: typeof window !== 'undefined' ? window.location.pathname : '/' }),
    }).catch(() => {})
  }, [statusEndpoint])

  const isDark = useColorMode(data?.darkMode || 'dark')
  const countdown = useCountdown(data?.estimatedEnd)

  const message = useMemo(
    () => data?.messages?.find((m) => m.language === currentLang) || data?.messages?.[0],
    [data?.messages, currentLang],
  )

  // Loading
  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Custom HTML template
  if (data.template === 'custom' && data.customHTML) {
    const html = sanitizeHTML(
      data.customHTML
        .replace(/\{\{title\}\}/g, message?.title || '')
        .replace(/\{\{description\}\}/g, message?.description || '')
        .replace(/\{\{estimatedEnd\}\}/g, data.estimatedEnd ? formatDate(data.estimatedEnd, currentLang) : '')
        .replace(/\{\{logoUrl\}\}/g, data.logoUrl || ''),
    )
    return (
      <>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        {data.customCSS && <style>{data.customCSS}</style>}
      </>
    )
  }

  // Resolve colors based on dark/light mode
  const rawBg = data.backgroundColor || '#0f172a'
  const rawText = data.textColor || '#f8fafc'
  const bg = isDark ? rawBg : (data.darkMode === 'auto' ? '#ffffff' : rawBg)
  const textColor = isDark ? rawText : (data.darkMode === 'auto' ? '#1e293b' : rawText)
  const accent = data.accentColor || '#3b82f6'
  const overlayOpacity = (data.backgroundOverlayOpacity ?? 70) / 100
  const langs = data.messages?.map((m) => m.language) || []
  const apiBase = statusEndpoint.replace('/status', '')

  const fontFamily = data.googleFont
    ? `"${data.googleFont}", system-ui, -apple-system, sans-serif`
    : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

  const content = (
    <ContentBlock
      data={data} message={message} countdown={countdown}
      currentLang={currentLang} accent={accent} textColor={textColor}
      apiBase={apiBase} glass={data.template === 'glassmorphism'}
    />
  )

  const templateMap: Record<string, React.ReactElement> = {
    'glassmorphism': (
      <GlassmorphismTemplate data={data} bg={bg} textColor={textColor} accent={accent} overlayOpacity={overlayOpacity}>
        {content}
      </GlassmorphismTemplate>
    ),
    'gradient': (
      <GradientTemplate data={data} textColor={textColor} accent={accent}>
        {content}
      </GradientTemplate>
    ),
    'split-screen': (
      <SplitScreenTemplate data={data} bg={bg} textColor={textColor} accent={accent} overlayOpacity={overlayOpacity}>
        {content}
      </SplitScreenTemplate>
    ),
    'video-background': (
      <VideoBackgroundTemplate data={data} bg={bg} textColor={textColor} accent={accent} overlayOpacity={overlayOpacity}>
        {content}
      </VideoBackgroundTemplate>
    ),
  }

  const templateElement = templateMap[data.template] || (
    <DefaultTemplate data={data} bg={bg} textColor={textColor} accent={accent} overlayOpacity={overlayOpacity}>
      {content}
    </DefaultTemplate>
  )

  return (
    <div style={{ fontFamily }}>
      {/* Google Font link */}
      {data.googleFont && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(data.googleFont)}:wght@400;600;700;800&display=swap`}
        />
      )}

      {/* Lottie player script */}
      {data.lottieUrl && (
        <script src="https://unpkg.com/@dotlottie/player-component@2/dist/dotlottie-player.mjs" type="module" />
      )}

      {/* Progress bar */}
      {data.showProgressBar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.06)', zIndex: 100 }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, animation: 'maint-progress 2.5s ease-in-out infinite' }} />
        </div>
      )}

      {/* Language switcher */}
      <LanguageSwitcher languages={langs} current={currentLang} onChange={setCurrentLang} accent={accent} textColor={textColor} />

      {templateElement}

      {/* Favicon */}
      {data.faviconUrl && (
        <link rel="icon" href={data.faviconUrl} />
      )}

      {/* Custom CSS */}
      {data.customCSS && <style>{data.customCSS}</style>}

      {/* Global animations */}
      <style>{`
        @keyframes maint-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes maint-blink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes maint-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes maint-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .maintenance-split-image { display: none !important; }
        }
        @media (max-width: 480px) {
          .maintenance-root { padding: 1rem !important; }
        }
      `}</style>
    </div>
  )
}
