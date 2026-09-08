import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { anonymizeIp } from '../utils/anonymizeIp.js'
import {
  runRetentionPurge,
  DEFAULT_ANALYTICS_RETENTION_DAYS,
} from '../utils/retention.js'

describe('anonymizeIp — troncature avant écriture', () => {
  it('met le dernier octet IPv4 à zéro', () => {
    expect(anonymizeIp('203.0.113.42')).toBe('203.0.113.0')
    expect(anonymizeIp('8.8.8.8')).toBe('8.8.8.0')
    expect(anonymizeIp('  10.0.0.255  ')).toBe('10.0.0.0')
  })

  it('garde les trois premiers groupes IPv6 (/48) et recompresse', () => {
    expect(anonymizeIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::')
    // `::` peut représenter n'importe quel nombre de groupes nuls : les groupes
    // manquants à gauche sont des zéros par définition, et sont réécrits.
    expect(anonymizeIp('2001:db8::1')).toBe('2001:db8:0::')
    expect(anonymizeIp('::1')).toBe('0:0:0::')
    expect(anonymizeIp('2001:DB8:85A3::1')).toBe('2001:db8:85a3::')
  })

  it('traite la forme IPv4-mappée comme une IPv4', () => {
    // `::ffff:203.0.113.42` est l'écriture IPv6 d'une adresse IPv4 : la partie
    // qui identifie est la partie décimale, c'est elle qu'il faut tronquer.
    expect(anonymizeIp('::ffff:203.0.113.42')).toBe('::ffff:203.0.113.0')
  })

  it('ignore l identifiant de zone', () => {
    expect(anonymizeIp('fe80::1%eth0')).toBe('fe80:0:0::')
  })

  it('renvoie "unknown" plutôt que de stocker une valeur non reconnue', () => {
    // Le sentinelle des endpoints quand aucune adresse ne peut être résolue.
    expect(anonymizeIp('unknown')).toBe('unknown')
    expect(anonymizeIp('')).toBe('unknown')
    expect(anonymizeIp(null)).toBe('unknown')
    expect(anonymizeIp(undefined)).toBe('unknown')
    expect(anonymizeIp('999.1.1.1')).toBe('unknown')
    expect(anonymizeIp('<script>alert(1)</script>')).toBe('unknown')
    expect(anonymizeIp('zzzz:db8:85a3::1')).toBe('unknown')
  })
})

interface DeleteCall {
  collection: string
  where: Record<string, { less_than?: string }>
}

function makePayload(calls: DeleteCall[], deleted = 3): Payload {
  return {
    delete: async (args: DeleteCall) => {
      calls.push(args)
      return { docs: Array.from({ length: deleted }, (_, i) => ({ id: i })), errors: [] }
    },
    logger: { error: vi.fn(), info: vi.fn() },
  } as unknown as Payload
}

const NOW = new Date('2026-09-08T12:00:00.000Z')

describe('runRetentionPurge', () => {
  it('supprime les analytics antérieures à la rétention et rend le seuil utilisé', async () => {
    const calls: DeleteCall[] = []
    const report = await runRetentionPurge(
      makePayload(calls),
      { analyticsSlug: 'maintenance-analytics', analyticsRetentionDays: 30 },
      NOW,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.collection).toBe('maintenance-analytics')
    expect(calls[0]?.where.timestamp?.less_than).toBe('2026-08-09T12:00:00.000Z')
    expect(report.analytics).toEqual({ deleted: 3, cutoff: '2026-08-09T12:00:00.000Z' })
    expect(report.subscribers).toBeNull()
  })

  it('ne touche pas aux abonnés tant que subscribersRetentionDays n est pas posé', async () => {
    // Défaut assumé : la ligne d'un abonné est aussi la preuve de son
    // consentement (consentAt / consentSource / ip). L'effacer sur minuterie
    // affaiblit le dossier au lieu de l'améliorer.
    const calls: DeleteCall[] = []
    const report = await runRetentionPurge(
      makePayload(calls),
      {
        analyticsSlug: 'maintenance-analytics',
        subscribersSlug: 'maintenance-subscribers',
        analyticsRetentionDays: DEFAULT_ANALYTICS_RETENTION_DAYS,
      },
      NOW,
    )

    expect(calls.map((c) => c.collection)).toEqual(['maintenance-analytics'])
    expect(report.subscribers).toBeNull()
  })

  it('purge les abonnés sur subscribedAt quand la rétention est configurée', async () => {
    const calls: DeleteCall[] = []
    const report = await runRetentionPurge(
      makePayload(calls),
      {
        subscribersSlug: 'abonnes',
        subscribersRetentionDays: 10,
      },
      NOW,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.collection).toBe('abonnes')
    expect(calls[0]?.where.subscribedAt?.less_than).toBe('2026-08-29T12:00:00.000Z')
    expect(report.subscribers?.deleted).toBe(3)
  })

  it('refuse une rétention de 0 ou négative au lieu de tout supprimer', async () => {
    // Une tâche planifiée qui interprète `0` comme « purge tout » efface la
    // collection entière chaque nuit. La valeur est rejetée, pas normalisée.
    const calls: DeleteCall[] = []
    const report = await runRetentionPurge(
      makePayload(calls),
      {
        analyticsSlug: 'maintenance-analytics',
        subscribersSlug: 'maintenance-subscribers',
        analyticsRetentionDays: 0,
        subscribersRetentionDays: -5,
      },
      NOW,
    )

    expect(calls).toHaveLength(0)
    expect(report).toEqual({ analytics: null, subscribers: null })
  })

  it('ignore une collection désactivée par ses options', async () => {
    const calls: DeleteCall[] = []
    await runRetentionPurge(
      makePayload(calls),
      { analyticsSlug: undefined, analyticsRetentionDays: 30 },
      NOW,
    )
    expect(calls).toHaveLength(0)
  })

  it('applique le défaut de 13 mois', () => {
    expect(DEFAULT_ANALYTICS_RETENTION_DAYS).toBe(395)
  })
})
