import { describe, expect, it } from 'vitest'
import { checkScheduleState, getEffectiveEnabled } from '../utils/schedule.js'

/**
 * `checkScheduleState` reads the wall clock itself, so time is injected through
 * the *inputs*: every date is built relative to `Date.now()` at assertion time.
 * No global clock is faked, and no absolute date is hard-coded — the suite gives
 * the same verdict whatever day, timezone or DST state the machine is in.
 */
const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** ISO instant, `offsetMs` away from now (negative = past). */
const at = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString()

/** Same instant as `at(offsetMs)`, but written with an explicit UTC offset. */
function atWithOffset(offsetMs: number, offsetHours: number): string {
  const shifted = new Date(Date.now() + offsetMs + offsetHours * HOUR)
  const pad = (n: number) => String(n).padStart(2, '0')
  const sign = offsetHours >= 0 ? '+' : '-'
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}` +
    `${sign}${pad(Math.abs(offsetHours))}:00`
  )
}

describe('checkScheduleState — passage automatique en maintenance', () => {
  it('allume la maintenance quand on est entre le début et la fin de la fenêtre', () => {
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(-10 * MINUTE),
        scheduledEnd: at(+50 * MINUTE),
        autoEnable: true,
      }),
    ).toBe(true)
  })

  it('allume la maintenance quand le début est passé et qu aucune fin n est prévue', () => {
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(-10 * MINUTE),
        scheduledEnd: null,
        autoEnable: true,
      }),
    ).toBe(true)
  })

  it('ne rallume pas la maintenance une fois la fenêtre entièrement passée', () => {
    // Régression : l'admin a rouvert le site après l'intervention. Sans borne
    // haute, tout scheduledStart passé rallumait la maintenance en boucle et le
    // bouton de l'admin ne pouvait plus jamais rouvrir le site.
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(-3 * HOUR),
        scheduledEnd: at(-1 * HOUR),
        autoEnable: true,
        autoDisable: true,
      }),
    ).toBeNull()
  })

  it('ne rallume pas la maintenance à l instant exact où la fenêtre se referme', () => {
    // La borne de fin est exclusive : à la seconde où la fenêtre expire, le site
    // reste ouvert.
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(-1 * HOUR),
        scheduledEnd: at(-1),
        autoEnable: true,
      }),
    ).toBeNull()
  })

  it('n allume rien tant que la fenêtre n a pas commencé', () => {
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(+10 * MINUTE),
        scheduledEnd: at(+70 * MINUTE),
        autoEnable: true,
      }),
    ).toBeNull()
  })

  it('n allume rien quand autoEnable est désactivé, même en pleine fenêtre', () => {
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: at(-10 * MINUTE),
        scheduledEnd: at(+50 * MINUTE),
        autoEnable: false,
      }),
    ).toBeNull()
  })

  it('n annonce aucun changement quand la maintenance est déjà active dans la fenêtre', () => {
    expect(
      checkScheduleState({
        enabled: true,
        scheduledStart: at(-10 * MINUTE),
        scheduledEnd: at(+50 * MINUTE),
        autoEnable: true,
        autoDisable: true,
      }),
    ).toBeNull()
  })
})

describe('checkScheduleState — sortie automatique de maintenance', () => {
  it('éteint la maintenance quand la fin planifiée est dépassée', () => {
    expect(
      checkScheduleState({
        enabled: true,
        scheduledStart: at(-3 * HOUR),
        scheduledEnd: at(-1 * MINUTE),
        autoDisable: true,
      }),
    ).toBe(false)
  })

  it('laisse la maintenance active tant que la fin n est pas atteinte', () => {
    expect(
      checkScheduleState({
        enabled: true,
        scheduledStart: at(-10 * MINUTE),
        scheduledEnd: at(+10 * MINUTE),
        autoDisable: true,
      }),
    ).toBeNull()
  })

  it('n éteint rien quand autoDisable est désactivé, même après la fin', () => {
    expect(
      checkScheduleState({
        enabled: true,
        scheduledStart: at(-3 * HOUR),
        scheduledEnd: at(-1 * HOUR),
        autoDisable: false,
      }),
    ).toBeNull()
  })
})

describe('checkScheduleState — entrées invalides ou absentes', () => {
  it('ignore une planification sans aucune date', () => {
    expect(checkScheduleState({ enabled: false, autoEnable: true, autoDisable: true })).toBeNull()
    // Un champ date vidé dans l'admin arrive sous forme de chaîne vide.
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: '',
        scheduledEnd: '',
        autoEnable: true,
        autoDisable: true,
      }),
    ).toBeNull()
  })

  it('ignore une date de début illisible plutôt que de couper le site', () => {
    expect(
      checkScheduleState({
        enabled: false,
        scheduledStart: 'demain matin',
        autoEnable: true,
      }),
    ).toBeNull()
  })

  it('ignore une date de fin illisible plutôt que de rouvrir le site', () => {
    // Fail-closed : une fin incompréhensible ne doit pas sortir de maintenance.
    expect(
      checkScheduleState({
        enabled: true,
        scheduledEnd: 'jamais',
        autoDisable: true,
      }),
    ).toBeNull()
  })
})

describe('checkScheduleState — le fuseau est un réglage d affichage', () => {
  it('donne le même verdict quel que soit le fuseau configuré', () => {
    const window = {
      enabled: false,
      scheduledStart: at(-10 * MINUTE),
      scheduledEnd: at(+50 * MINUTE),
      autoEnable: true,
    }
    // Régression : « maintenant » était décalé dans le fuseau configuré alors
    // que les dates restaient absolues, ce qui démarrait la maintenance avec
    // plusieurs heures d'avance ou de retard selon l'offset.
    expect(checkScheduleState({ ...window, timezone: 'Pacific/Kiritimati' })).toBe(true) // UTC+14
    expect(checkScheduleState({ ...window, timezone: 'Pacific/Niue' })).toBe(true) // UTC-11
    expect(checkScheduleState({ ...window, timezone: null })).toBe(true)
  })

  it('ne rallume pas une fenêtre passée, même avec un fuseau très décalé', () => {
    const past = {
      enabled: false,
      scheduledStart: at(-4 * HOUR),
      scheduledEnd: at(-2 * HOUR),
      autoEnable: true,
    }
    expect(checkScheduleState({ ...past, timezone: 'Pacific/Kiritimati' })).toBeNull()
    expect(checkScheduleState({ ...past, timezone: 'Pacific/Niue' })).toBeNull()
  })

  it('compare des instants : une date avec offset explicite vaut son équivalent UTC', () => {
    const utc = checkScheduleState({
      enabled: false,
      scheduledStart: at(-10 * MINUTE),
      scheduledEnd: at(+50 * MINUTE),
      autoEnable: true,
    })
    const withOffsets = checkScheduleState({
      enabled: false,
      scheduledStart: atWithOffset(-10 * MINUTE, 2),
      scheduledEnd: atWithOffset(+50 * MINUTE, -5),
      autoEnable: true,
    })
    expect(withOffsets).toBe(utc)
    expect(withOffsets).toBe(true)
  })
})

describe('getEffectiveEnabled — état réellement servi aux visiteurs', () => {
  it('conserve l état enregistré quand aucune règle de planification ne s applique', () => {
    expect(getEffectiveEnabled({ enabled: true })).toBe(true)
    expect(getEffectiveEnabled({ enabled: false })).toBe(false)
  })

  it('ouvre la maintenance pendant la fenêtre même si le réglage est à off', () => {
    expect(
      getEffectiveEnabled({
        enabled: false,
        scheduledStart: at(-1 * MINUTE),
        scheduledEnd: at(+1 * HOUR),
        autoEnable: true,
      }),
    ).toBe(true)
  })

  it('rouvre le site quand la fin planifiée est dépassée', () => {
    expect(
      getEffectiveEnabled({
        enabled: true,
        scheduledEnd: at(-1 * MINUTE),
        autoDisable: true,
      }),
    ).toBe(false)
  })

  it('garde le site ouvert après la fenêtre au lieu de le refermer tout seul', () => {
    expect(
      getEffectiveEnabled({
        enabled: false,
        scheduledStart: at(-5 * HOUR),
        scheduledEnd: at(-4 * HOUR),
        autoEnable: true,
        autoDisable: true,
      }),
    ).toBe(false)
  })
})
