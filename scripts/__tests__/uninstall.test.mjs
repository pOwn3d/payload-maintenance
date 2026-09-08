import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  dropStatements,
  findReferencingFiles,
  isDeclaredDependency,
  shouldTouchData,
} from '../uninstall.mjs'

const PACKAGE_NAME = '@consilioweb/payload-maintenance'

const tempDirs = []
function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maint-uninstall-'))
  tempDirs.push(dir)
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(dir, relative)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, 'utf-8')
  }
  return dir
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true })
})

describe('uninstall — garde de detection', () => {
  it('ne touche a rien quand le plugin est introuvable dans le projet', () => {
    // La suppression des documents est irreversible : elle ne doit pas partir
    // sur un projet qui n a jamais eu le plugin (un `npx` lance dans le mauvais
    // repertoire, par exemple).
    const gate = shouldTouchData({
      keepData: false,
      forceData: false,
      referencingFiles: 0,
      declaredDependency: false,
    })
    expect(gate).toEqual({ proceed: false, reason: 'not-detected' })
  })

  it('part quand une source reference le paquet', () => {
    expect(
      shouldTouchData({
        keepData: false,
        forceData: false,
        referencingFiles: 1,
        declaredDependency: false,
      }).proceed,
    ).toBe(true)
  })

  it('part quand la dependance est declaree, meme sans reference en source', () => {
    expect(
      shouldTouchData({
        keepData: false,
        forceData: false,
        referencingFiles: 0,
        declaredDependency: true,
      }).proceed,
    ).toBe(true)
  })

  it('--keep-data l emporte sur tout, y compris --force-data', () => {
    expect(
      shouldTouchData({
        keepData: true,
        forceData: true,
        referencingFiles: 3,
        declaredDependency: true,
      }),
    ).toEqual({ proceed: false, reason: 'keep-data' })
  })

  it('--force-data ouvre la garde quand rien n est detecte', () => {
    expect(
      shouldTouchData({
        keepData: false,
        forceData: true,
        referencingFiles: 0,
        declaredDependency: false,
      }),
    ).toEqual({ proceed: true, reason: 'forced' })
  })
})

describe('uninstall — detection sur un vrai arborescence', () => {
  it('trouve les fichiers qui importent le paquet et ignore node_modules', () => {
    const dir = makeProject({
      'src/payload.config.ts': `import { maintenancePlugin } from '${PACKAGE_NAME}'`,
      'src/other.ts': 'export const x = 1',
      'src/node_modules/dep/index.ts': `require('${PACKAGE_NAME}')`,
      'src/.next/cache.ts': `import '${PACKAGE_NAME}'`,
    })

    const found = findReferencingFiles(path.join(dir, 'src'), PACKAGE_NAME).map((f) =>
      path.relative(dir, f),
    )
    expect(found).toEqual(['src/payload.config.ts'])
  })

  it('lit la dependance dans package.json, quel que soit le champ', () => {
    const declared = makeProject({
      'package.json': JSON.stringify({ dependencies: { [PACKAGE_NAME]: '^0.8.0' } }),
    })
    expect(isDeclaredDependency(declared, PACKAGE_NAME)).toBe(true)

    const dev = makeProject({
      'package.json': JSON.stringify({ devDependencies: { [PACKAGE_NAME]: '^0.8.0' } }),
    })
    expect(isDeclaredDependency(dev, PACKAGE_NAME)).toBe(true)

    const absent = makeProject({ 'package.json': JSON.stringify({ dependencies: {} }) })
    expect(isDeclaredDependency(absent, PACKAGE_NAME)).toBe(false)

    // Pas de package.json du tout : absence de preuve, pas preuve de presence.
    expect(isDeclaredDependency(makeProject({}), PACKAGE_NAME)).toBe(false)
  })
})

describe('uninstall — instructions de suppression des tables', () => {
  it('couvre les quatre collections ET le global, sur les trois adaptateurs', () => {
    // Le point qui coute cher si on l oublie : retirer le plugin sans ce script
    // conserve les IP de maintenance-analytics indefiniment.
    const drops = dropStatements([
      'maintenance-subscribers',
      'maintenance-history',
      'maintenance-analytics',
      'maintenance-webhook-logs',
    ])

    for (const table of [
      'maintenance_subscribers',
      'maintenance_history',
      'maintenance_analytics',
      'maintenance_webhook_logs',
      'maintenance',
    ]) {
      expect(drops.sqlite).toContain(table)
      expect(drops.postgres).toContain(table)
      expect(drops.mongo).toContain(table)
    }
  })

  it('suit les slugs personnalises au lieu de supposer les defauts', () => {
    // Les quatre slugs sont configurables : un script en dur laisserait une
    // installation renommee intacte tout en annoncant un succes.
    const drops = dropStatements(['abonnes', 'journal'], 'mode-maintenance')
    expect(drops.sqlite).toBe(
      'DROP TABLE IF EXISTS abonnes; DROP TABLE IF EXISTS journal; DROP TABLE IF EXISTS mode_maintenance;',
    )
    expect(drops.postgres).toContain('abonnes, journal, mode_maintenance')
  })
})
