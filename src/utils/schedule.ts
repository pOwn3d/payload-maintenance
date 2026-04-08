import { getNowInTimezone } from './timezone.js'

/**
 * Check if the current time falls within a scheduled maintenance window.
 * Used by status endpoint, middleware, and schedule-check handler to avoid
 * duplicating the same date comparison logic.
 *
 * @returns true if maintenance should be active, false if it should be inactive,
 *          null if schedule does not override the current state.
 */
export function checkScheduleState(opts: {
  enabled: boolean
  scheduledStart?: string | null
  scheduledEnd?: string | null
  autoEnable?: boolean
  autoDisable?: boolean
  timezone?: string | null
}): boolean | null {
  const now = getNowInTimezone(opts.timezone)

  // Auto-enable: maintenance is off, but scheduled start has passed
  if (opts.autoEnable && opts.scheduledStart && !opts.enabled) {
    const start = new Date(opts.scheduledStart)
    if (now >= start) return true
  }

  // Auto-disable: maintenance is on, but scheduled end has passed
  if (opts.autoDisable && opts.scheduledEnd && opts.enabled) {
    const end = new Date(opts.scheduledEnd)
    if (now >= end) return false
  }

  return null
}

/**
 * Convenience wrapper: returns the effective enabled state after schedule override.
 */
export function getEffectiveEnabled(opts: {
  enabled: boolean
  scheduledStart?: string | null
  scheduledEnd?: string | null
  autoEnable?: boolean
  autoDisable?: boolean
  timezone?: string | null
}): boolean {
  const override = checkScheduleState(opts)
  return override ?? opts.enabled
}
