/** Parse a Payload date field, returning null for absent or unparseable values. */
function toInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Check if the current time falls within a scheduled maintenance window.
 * Used by status endpoint, middleware, and schedule-check handler to avoid
 * duplicating the same date comparison logic.
 *
 * Payload date fields are absolute instants (ISO 8601, UTC). Both sides of the
 * comparison are therefore instants, and `opts.timezone` is deliberately NOT
 * applied here: it is a display concern. Shifting "now" into the configured
 * zone while the schedule stays absolute offsets every comparison by the zone's
 * UTC offset, which used to start maintenance hours early or late.
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
  /** Display-only; intentionally unused for comparisons. */
  timezone?: string | null
}): boolean | null {
  const now = new Date()
  const start = toInstant(opts.scheduledStart)
  const end = toInstant(opts.scheduledEnd)

  // Auto-enable: maintenance is off and we are INSIDE the scheduled window.
  // The upper bound matters: without it, any past scheduledStart re-enables
  // maintenance forever and the admin toggle can never turn the site back on.
  if (opts.autoEnable && start && !opts.enabled) {
    if (now >= start && (!end || now < end)) return true
  }

  // Auto-disable: maintenance is on, but the scheduled end has passed
  if (opts.autoDisable && end && opts.enabled) {
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
