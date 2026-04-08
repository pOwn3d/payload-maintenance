/**
 * Get current time in a given IANA timezone for schedule comparison.
 * Returns a Date adjusted so that simple comparisons with schedule dates
 * (stored as local times) work correctly.
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
