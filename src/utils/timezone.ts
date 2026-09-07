/**
 * Get the current time shifted into a given IANA timezone.
 *
 * @deprecated Do not use this for scheduling comparisons. It formats "now" as
 * wall-clock text in the target zone and reparses it as server-local time, so
 * the Date it returns is offset by the difference between the two zones. Payload
 * date fields are absolute UTC instants, so comparing them against this value
 * started and ended maintenance windows hours early or late. `checkScheduleState`
 * now compares instants with a plain `new Date()`; this helper is kept only
 * because it is part of the published API surface, and is safe solely for
 * display formatting.
 */
export function getNowInTimezone(timezone: string | null | undefined): Date {
  if (!timezone) return new Date()
  try {
    const nowStr = new Date().toLocaleString('en-US', { timeZone: timezone })
    return new Date(nowStr)
  } catch {
    return new Date()
  }
}
