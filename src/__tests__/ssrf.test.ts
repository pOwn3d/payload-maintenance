import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertPublicHttpUrl, isBlockedAddress } from '../utils/ssrf.js'
import { fireWebhook } from '../globals/Maintenance.js'

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adresses interdites au serveur', () => {
  it('bloque loopback, RFC1918, lien-local et métadonnées cloud', () => {
    for (const ip of [
      '127.0.0.1',
      '127.1.2.3',
      '0.0.0.0',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true)
    }
  })

  it('bloque la forme IPv6 mappée IPv4, qui atteint le même hôte', () => {
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true)
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true)
    expect(isBlockedAddress('[::ffff:127.0.0.1]')).toBe(true)
  })

  it('laisse passer une adresse publique', () => {
    expect(isBlockedAddress('93.184.216.34')).toBe(false)
    expect(isBlockedAddress('2606:4700::1111')).toBe(false)
  })
})

describe('assertPublicHttpUrl', () => {
  const lookup = (map: Record<string, string[]>) => async (host: string) => {
    const found = map[host]
    if (!found) throw new Error('ENOTFOUND')
    return found
  }

  it('refuse un littéral IP interne', async () => {
    const res = await assertPublicHttpUrl('http://169.254.169.254/latest/meta-data/')
    expect(res.ok).toBe(false)
  })

  it('refuse un nom qui résout vers une adresse interne (DNS)', async () => {
    const res = await assertPublicHttpUrl('https://interne.exemple.fr/hook', {
      lookup: lookup({ 'interne.exemple.fr': ['10.0.0.12'] }),
    })
    expect(res.ok).toBe(false)
  })

  it('refuse localhost et les protocoles non http(s)', async () => {
    expect((await assertPublicHttpUrl('http://localhost:8025/api/v2/messages')).ok).toBe(false)
    expect((await assertPublicHttpUrl('file:///etc/passwd')).ok).toBe(false)
    expect((await assertPublicHttpUrl('gopher://x/1')).ok).toBe(false)
  })

  it('accepte une destination publique', async () => {
    const res = await assertPublicHttpUrl('https://hooks.slack.com/services/T/B/X', {
      lookup: lookup({ 'hooks.slack.com': ['3.5.6.7'] }),
    })
    expect(res.ok).toBe(true)
  })

  it('applique l allow-list de hosts quand elle est fournie', async () => {
    const opts = {
      allowedHosts: ['hooks.slack.com'],
      lookup: lookup({ 'hooks.slack.com': ['3.5.6.7'], 'evil.tld': ['3.5.6.8'] }),
    }
    expect((await assertPublicHttpUrl('https://hooks.slack.com/x', opts)).ok).toBe(true)
    expect((await assertPublicHttpUrl('https://evil.tld/x', opts)).ok).toBe(false)
  })
})

describe('fireWebhook — SSRF avec exfiltration', () => {
  it('n émet aucune requête vers une adresse interne et journalise le refus', async () => {
    // Régression MNT-04 : la seule garde était le protocole, donc un admin (ou
    // tout rôle délégué via `adminAccess`) pointait le webhook sur
    // 169.254.169.254 et relisait 2000 octets de la réponse dans les logs.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const created: Array<{ collection: string; data: Record<string, unknown> }> = []
    const payload = { create: async (args: any) => { created.push(args); return {} } }

    await fireWebhook(
      { type: 'custom', url: 'http://169.254.169.254/latest/meta-data/iam/' },
      'activated',
      'admin@site.tld',
      logger(),
      payload,
      'maintenance-webhook-logs',
      'maintenance-history',
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(created).toHaveLength(1)
    expect(created[0]!.data.status).toBe('failed')
    expect(String(created[0]!.data.responseBody)).toContain('Refused before sending')
  })

  it('ne suit pas une redirection vers une cible interne', async () => {
    // Un host externe autorisé qui répond 302 vers 169.254.169.254 contournait
    // le contrôle fait sur l URL initiale : la chaîne est refusée en bloc.
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const created: any[] = []
    const payload = { create: async (args: any) => { created.push(args); return {} } }

    await fireWebhook(
      { type: 'custom', url: 'https://exemple-public.fr/hook' },
      'activated',
      'admin@site.tld',
      logger(),
      payload,
      'maintenance-webhook-logs',
      undefined,
      undefined,
      async () => ['93.184.216.34'],
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: 'manual' })
    const log = created.find((c) => c.collection === 'maintenance-webhook-logs')
    expect(log.data.status).toBe('failed')
    expect(String(log.data.responseBody)).toContain('Redirect refused')
  })

  it('envoie normalement vers une destination publique', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const created: any[] = []
    const payload = { create: async (args: any) => { created.push(args); return {} } }

    await fireWebhook(
      { type: 'slack', url: 'https://hooks.slack.com/services/T/B/X' },
      'activated',
      'admin@site.tld',
      logger(),
      payload,
      'maintenance-webhook-logs',
      undefined,
      undefined,
      async () => ['3.5.6.7'],
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(created[0]!.data.status).toBe('success')
  })
})

describe('MNT2-01 — la fenêtre de DNS rebinding', () => {
  it('refuse une cible http:// en clair, même vers une adresse publique', async () => {
    // Le contrôle d'adresse résout le nom lui-même, puis `fetch` le résout une
    // seconde fois : un enregistrement à TTL 0 glisse 169.254.169.254 dans la
    // seconde résolution. La socket ne peut pas être épinglée ici (le `fetch` de
    // Node ignore un en-tête `Host` fourni par l'appelant — vérifié), donc c'est
    // le certificat TLS qui sert d'épingle : un service interne ne peut pas
    // présenter un certificat valide pour le domaine de l'attaquant. En clair,
    // cette épingle n'existe pas : la cible est refusée.
    const publicLookup = async () => ['93.184.216.34']
    const enClair = await assertPublicHttpUrl('http://rebind.evil.tld/hook', {
      lookup: publicLookup,
    })
    expect(enClair.ok).toBe(false)
    expect(enClair.ok === false && enClair.reason).toContain('plaintext')

    // https vers la même cible reste accepté.
    expect(
      (await assertPublicHttpUrl('https://rebind.evil.tld/hook', { lookup: publicLookup })).ok,
    ).toBe(true)
    // …et l'appelant qui sait ce qu'il fait peut toujours l'autoriser.
    expect(
      (
        await assertPublicHttpUrl('http://rebind.evil.tld/hook', {
          lookup: publicLookup,
          allowPlaintextHttp: true,
        })
      ).ok,
    ).toBe(true)
  })

  it('re-résout la cible avant chaque nouvelle tentative', async () => {
    // Le guard était évalué UNE seule fois, avant la boucle de 3 tentatives :
    // l'attaquant disposait de trois résolutions successives, espacées de 1 s
    // puis 2 s, pour faire basculer son DNS après le contrôle.
    let call = 0
    const flipping = async () => {
      call++
      return call === 1 ? ['93.184.216.34'] : ['169.254.169.254']
    }
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const created: any[] = []
    const payload = { create: async (args: any) => { created.push(args); return {} } }

    await fireWebhook(
      { type: 'custom', url: 'https://rebind.evil.tld/hook' },
      'activated',
      'admin@site.tld',
      logger(),
      payload,
      'maintenance-webhook-logs',
      undefined,
      undefined,
      flipping,
    )

    // Une seule requête sortante : la deuxième tentative est refusée au contrôle.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(call).toBeGreaterThanOrEqual(2)
    const log = created.find((c) => c.collection === 'maintenance-webhook-logs')
    expect(log.data.status).toBe('failed')
    expect(String(log.data.responseBody)).toContain('Refused before retry')
    expect(String(log.data.responseBody)).toContain('169.254.169.254')
  }, 10_000)
})
