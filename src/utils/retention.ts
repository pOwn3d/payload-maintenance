import type { Payload } from 'payload'

/**
 * Retention sweep for the two collections that hold personal data.
 *
 * The plugin used to keep every analytics row — IP, user agent, referer —
 * forever, with no TTL, no hook and no endpoint to clear them. Deleting the
 * plugin then removed the only UI able to read or erase them.
 *
 * One function, three callers: the admin endpoint (manual fallback), the
 * Payload Jobs task registered when the host runs the job system, and the
 * uninstall script. Deliberately NOT a `setInterval`: an in-process timer does
 * not survive serverless and runs N times in parallel behind N instances.
 */

export interface RetentionOptions {
  /** Analytics collection slug — skipped when `analyticsRetentionDays` is unset. */
  analyticsSlug?: string
  /** Subscribers collection slug — skipped when `subscribersRetentionDays` is unset. */
  subscribersSlug?: string
  /** Default 395 (13 months, the CNIL ceiling for audience measurement). */
  analyticsRetentionDays?: number
  /** No default: deleting a subscriber also deletes the proof of their consent. */
  subscribersRetentionDays?: number
}

export interface RetentionReport {
  analytics: { deleted: number; cutoff: string } | null
  subscribers: { deleted: number; cutoff: string } | null
}

/** 13 months — the longest retention the CNIL accepts for audience measurement. */
export const DEFAULT_ANALYTICS_RETENTION_DAYS = 395

/** Guard against a config that would delete everything (or nothing) by accident. */
function normalizeDays(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const days = Math.floor(value)
  // `0` would mean "purge everything", which must never be reachable from a
  // scheduled task: an operator who wants that deletes the rows themselves.
  return days >= 1 ? days : null
}

function cutoffIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

async function purgeOlderThan(
  payload: Payload,
  collection: string,
  field: string,
  cutoff: string,
): Promise<number> {
  const result = await payload.delete({
    collection: collection as never,
    where: { [field]: { less_than: cutoff } },
    overrideAccess: true,
  })
  return Array.isArray((result as { docs?: unknown[] }).docs)
    ? (result as { docs: unknown[] }).docs.length
    : 0
}

/**
 * Deletes rows older than the configured retention.
 *
 * A collection with no configured retention is left untouched and reported as
 * `null`, so the caller can tell "nothing to purge" from "purged zero rows".
 */
export async function runRetentionPurge(
  payload: Payload,
  options: RetentionOptions,
  now: Date = new Date(),
): Promise<RetentionReport> {
  const report: RetentionReport = { analytics: null, subscribers: null }

  const analyticsDays = normalizeDays(options.analyticsRetentionDays)
  if (options.analyticsSlug && analyticsDays !== null) {
    const cutoff = cutoffIso(analyticsDays, now)
    report.analytics = {
      deleted: await purgeOlderThan(payload, options.analyticsSlug, 'timestamp', cutoff),
      cutoff,
    }
  }

  const subscribersDays = normalizeDays(options.subscribersRetentionDays)
  if (options.subscribersSlug && subscribersDays !== null) {
    const cutoff = cutoffIso(subscribersDays, now)
    report.subscribers = {
      deleted: await purgeOlderThan(payload, options.subscribersSlug, 'subscribedAt', cutoff),
      cutoff,
    }
  }

  return report
}
