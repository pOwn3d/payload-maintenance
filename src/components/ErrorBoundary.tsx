'use client'

import React from 'react'

/**
 * Error boundary for the components this plugin injects into the Payload admin.
 *
 * Why it exists: `MaintenanceNavLink` is mounted in `afterNavLinks`, so it
 * renders on EVERY admin page. Without a boundary, one exception in it — a
 * malformed config answer, a Payload version that changes `usePathname` — takes
 * down the whole panel, not just the maintenance feature.
 *
 * This is a hardened copy of the boundary shipped by payload-support, not a
 * plain one. The differences are deliberate, and each one fixes a real defect of
 * the original:
 *
 *  1. Retrying REMOUNTS the subtree (`key` bumped) instead of only clearing the
 *     flag. Clearing the flag re-renders the same failing element with the same
 *     props, which throws again immediately — a retry button that cannot work.
 *  2. `resetKeys` clears the error when the inputs change, so a boundary that
 *     caught on bad data recovers on its own once the data is replaced.
 *  3. `fallback` is honoured with `!== undefined`, so `fallback={null}` really
 *     renders nothing. Written as `fallback ?? <default/>` or `if (fallback)`,
 *     `null` falls through to the default error panel — the exact opposite of
 *     what a silent boundary is for.
 *  4. The error MESSAGE never reaches the screen. A server-side message can
 *     carry a path or an implementation detail; the console gets everything.
 *  5. `role="alert"` on the panel: the swap is otherwise silent for a screen
 *     reader, on the one screen the user sees when everything else failed.
 *  6. Colours are Payload theme tokens, not hex. The original hard-coded
 *     `#dc2626` / `#6b7280` / `#2563eb`, unreadable in dark mode.
 *  7. Strings are translated (fr/en), like the rest of this plugin.
 *
 * It does NOT catch async rejections in effects or errors thrown from event
 * handlers — React boundaries never do. Those still need a try/catch at the
 * call site (see the `.catch()` on the fetches in the wrapped components).
 */

const strings: Record<string, { title: string; hint: string; retry: string }> = {
  en: {
    title: 'This section could not be displayed',
    hint: 'The rest of the admin panel is unaffected. Details are in the browser console.',
    retry: 'Retry',
  },
  fr: {
    title: 'Cette section n a pas pu s afficher',
    hint: "Le reste du panneau d administration n est pas affecte. Le detail est dans la console du navigateur.",
    retry: 'Reessayer',
  },
}

/**
 * Read the language from the document rather than from `navigator`.
 *
 * Payload stamps `<html lang>`, and this runs only once an error has been
 * caught — i.e. on the client — so there is no server-rendered counterpart to
 * mismatch. `navigator.language` would be a hydration hazard for the same
 * reason it is in `MaintenanceNavLink`.
 */
function resolveLang(): 'en' | 'fr' {
  if (typeof document === 'undefined') return 'en'
  const lang = document.documentElement?.lang?.slice(0, 2).toLowerCase()
  return lang === 'fr' ? 'fr' : 'en'
}

export interface MaintenanceErrorBoundaryProps {
  children: React.ReactNode
  /** Rendered instead of the default panel. `null` renders nothing at all. */
  fallback?: React.ReactNode
  /** Identifies the component in the console log. */
  boundaryName?: string
  /** Any change to these values clears the error and remounts the children. */
  resetKeys?: unknown[]
}

interface MaintenanceErrorBoundaryState {
  hasError: boolean
  /** Bumped on every reset; used as the subtree `key` to force a remount. */
  attempt: number
}

/** Shallow compare — the same contract as a React dependency array. */
function keysChanged(previous?: unknown[], next?: unknown[]): boolean {
  if (previous === next) return false
  if (!previous || !next) return previous !== next
  if (previous.length !== next.length) return true
  return previous.some((value, index) => !Object.is(value, next[index]))
}

export class MaintenanceErrorBoundary extends React.Component<
  MaintenanceErrorBoundaryProps,
  MaintenanceErrorBoundaryState
> {
  constructor(props: MaintenanceErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, attempt: 0 }
  }

  static getDerivedStateFromError(): Partial<MaintenanceErrorBoundaryState> {
    // The error object is deliberately NOT kept in state: nothing renders it,
    // and holding it would tempt the next edit into printing it on screen.
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[maintenance] ${this.props.boundaryName || 'admin component'} crashed and was isolated:`,
      error,
      errorInfo,
    )
  }

  componentDidUpdate(previousProps: MaintenanceErrorBoundaryProps): void {
    if (!this.state.hasError) return
    if (keysChanged(previousProps.resetKeys, this.props.resetKeys)) this.reset()
  }

  reset = (): void => {
    this.setState((state) => ({ hasError: false, attempt: state.attempt + 1 }))
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      // The key is what makes `reset` meaningful: React unmounts the previous
      // subtree and builds a fresh one instead of re-rendering the instance
      // that just threw.
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>
    }

    // `!== undefined`, not `??`: `fallback={null}` means "degrade silently".
    if (this.props.fallback !== undefined) return this.props.fallback

    const t = strings[resolveLang()] ?? strings.en!

    return (
      <div
        role="alert"
        style={{
          padding: 24,
          margin: '16px 0',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 6,
          background: 'var(--theme-elevation-50)',
          color: 'var(--theme-text)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{t.title}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--theme-elevation-650)' }}>
          {t.hint}
        </p>
        <button
          type="button"
          onClick={this.reset}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'var(--theme-elevation-0)',
            background: 'var(--theme-elevation-800)',
            border: '1px solid var(--theme-elevation-800)',
            borderRadius: 4,
          }}
        >
          {t.retry}
        </button>
      </div>
    )
  }
}
