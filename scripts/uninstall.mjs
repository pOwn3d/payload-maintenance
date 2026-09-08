#!/usr/bin/env node

/**
 * Uninstaller for @consilioweb/payload-maintenance.
 *
 * Why this script exists at all: removing the plugin by hand KEEPS the IP
 * addresses stored in `maintenance-analytics` — indefinitely, since the plugin
 * never had a retention — while deleting the only UI able to read or erase
 * them. That is the worst of both worlds, and it is silent.
 *
 * Contract, same as the other uninstallers in this family:
 *  - a DETECTION GATE: nothing destructive runs unless the plugin is really
 *    installed here (a source reference, or the dependency in package.json).
 *    `--force-data` overrides it;
 *  - `--keep-data` skips the data step entirely;
 *  - `--dry-run` counts without deleting;
 *  - the data step goes through the PAYLOAD LOCAL API (scripts/purge-data.mjs,
 *    run by `payload run`), not a `sqlite3` shell: it works on all three
 *    adapters and honours custom slugs, which a hardcoded binary does not.
 *
 * It never drops a table. Payload owns the schema; the statements are printed
 * for the operator to run, per adapter.
 *
 * Usage: npx maintenance-uninstall [--keep-data] [--dry-run] [--force-data]
 *                                  [--slugs a,b,c]
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

/**
 * Read our own name instead of hardcoding it: a literal that drifts from
 * package.json makes every `includes(PACKAGE_NAME)` check match nothing, so the
 * detection gate opens on an empty result while the destructive step still runs.
 */
function readOwnPackageName() {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name
  } catch {
    /* fall through */
  }
  return '@consilioweb/payload-maintenance'
}

const PACKAGE_NAME = readOwnPackageName()

/** Default slugs — every one of them is configurable, hence `--slugs`. */
const DEFAULT_SLUGS = [
  'maintenance-subscribers',
  'maintenance-history',
  'maintenance-analytics',
  'maintenance-webhook-logs',
]
const GLOBAL_SLUG = 'maintenance'

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
}

function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) {
    return 'bun'
  }
  return 'npm'
}

function run(cmd, cwd) {
  console.log(`  ${C.dim}$ ${cmd}${C.reset}`)
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

/** Source files that mention the package — evidence the plugin lives here. */
export function findReferencingFiles(dir, packageName = PACKAGE_NAME, found = []) {
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      findReferencingFiles(full, packageName, found)
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      try {
        if (fs.readFileSync(full, 'utf-8').includes(packageName)) found.push(full)
      } catch {
        /* unreadable file: not evidence either way */
      }
    }
  }
  return found
}

export function isDeclaredDependency(projectDir, packageName = PACKAGE_NAME) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'))
    return Boolean(
      pkg.dependencies?.[packageName] ||
        pkg.devDependencies?.[packageName] ||
        pkg.peerDependencies?.[packageName] ||
        pkg.optionalDependencies?.[packageName],
    )
  } catch {
    return false
  }
}

/**
 * The gate. Data is only touched when the plugin is demonstrably installed
 * here, or when the operator forces it. Kept as a pure function so the decision
 * is testable on its own.
 */
export function shouldTouchData({ keepData, forceData, referencingFiles, declaredDependency }) {
  if (keepData) return { proceed: false, reason: 'keep-data' }
  if (forceData) return { proceed: true, reason: 'forced' }
  if (referencingFiles > 0) return { proceed: true, reason: 'source-reference' }
  if (declaredDependency) return { proceed: true, reason: 'declared-dependency' }
  return { proceed: false, reason: 'not-detected' }
}

export function dropStatements(slugs, globalSlug = GLOBAL_SLUG) {
  const table = (slug) => slug.replace(/-/g, '_')
  const tables = [...slugs.map(table), table(globalSlug)]
  return {
    sqlite: tables.map((t) => `DROP TABLE IF EXISTS ${t};`).join(' '),
    postgres: `DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE;`,
    mongo: tables.map((t) => `db.${t}.drop()`).join('; '),
  }
}

function main() {
  const projectDir = process.env.INIT_CWD || process.cwd()
  const srcDir = path.join(projectDir, 'src')
  const pm = detectPackageManager(projectDir)

  const keepData = process.argv.includes('--keep-data')
  const forceData = process.argv.includes('--force-data')
  const dryRun = process.argv.includes('--dry-run')
  const slugs = (argValue('slugs') ?? DEFAULT_SLUGS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  console.log('')
  console.log(`  ${C.cyan}${PACKAGE_NAME}${C.reset} — uninstall`)
  console.log('  ─────────────────────────────────────────────')
  console.log(`  Project: ${C.yellow}${projectDir}${C.reset}`)
  console.log(`  Package manager: ${C.yellow}${pm}${C.reset}`)
  if (keepData) console.log(`  ${C.yellow}--keep-data: no document will be deleted${C.reset}`)
  if (dryRun) console.log(`  ${C.yellow}--dry-run: counting only${C.reset}`)
  console.log('')

  // ── 1. Where the plugin is referenced ─────────────────────────────
  console.log(`  ${C.cyan}[1/4]${C.reset} Looking for the plugin in this project...`)
  const referencing = findReferencingFiles(srcDir)
  const declared = isDeclaredDependency(projectDir)

  for (const file of referencing) {
    console.log(`  ${C.green}found${C.reset} ${path.relative(projectDir, file)}`)
  }
  if (referencing.length === 0) {
    console.log(`  ${C.yellow}no source file references ${PACKAGE_NAME}${C.reset}`)
  }
  console.log(
    `  ${declared ? C.green + 'declared' : C.yellow + 'not declared'}${C.reset} in package.json`,
  )
  // Deliberately NOT rewritten automatically: `maintenancePlugin()` sits inside
  // the host's `plugins` array with their own options and comments around it.
  // A regex edit there is how a payload.config.ts gets silently corrupted.
  console.log(`  ${C.dim}Remove the maintenancePlugin() call yourself before rebuilding.${C.reset}`)
  console.log('')

  // ── 2. Data ───────────────────────────────────────────────────────
  console.log(`  ${C.cyan}[2/4]${C.reset} Plugin data...`)
  const gate = shouldTouchData({
    keepData,
    forceData,
    referencingFiles: referencing.length,
    declaredDependency: declared,
  })

  if (!gate.proceed && gate.reason === 'not-detected') {
    console.log(`  ${C.yellow}${PACKAGE_NAME} was not found in this project.${C.reset}`)
    console.log(`  ${C.yellow}Skipping the irreversible delete step.${C.reset}`)
    console.log(`  ${C.dim}Force it with --force-data if you know the rows are there.${C.reset}`)
  } else if (!gate.proceed) {
    console.log(`  ${C.yellow}Skipped (--keep-data).${C.reset}`)
    console.log(`  ${C.yellow}The IP addresses in maintenance-analytics stay in your`)
    console.log(`  database, and the admin UI that could read them is going away.${C.reset}`)
  } else {
    const script = `node_modules/${PACKAGE_NAME}/scripts/purge-data.mjs`
    const runner = pm === 'npm' ? 'npx payload' : `${pm} payload`
    const flags = [`--slugs ${slugs.join(',')}`, dryRun ? '--dry-run' : ''].filter(Boolean).join(' ')
    // `payload run` is what gives the script the host's config, env and TS
    // pipeline. Without it, importing payload.config.ts from plain node fails.
    const ok = run(`${runner} run ${script} ${flags}`, projectDir)
    if (!ok) {
      console.log(`  ${C.red}The purge did not complete.${C.reset}`)
      console.log(`  ${C.dim}Run it yourself: ${runner} run ${script}${C.reset}`)
    }
  }
  console.log('')

  // ── 3. Remove the package ─────────────────────────────────────────
  console.log(`  ${C.cyan}[3/4]${C.reset} Removing the package...`)
  if (dryRun) {
    console.log(`  ${C.dim}skipped (--dry-run)${C.reset}`)
  } else {
    run(`${pm === 'npm' ? 'npm uninstall' : `${pm} remove`} ${PACKAGE_NAME}`, projectDir)
  }
  console.log('')

  // ── 4. Import map ─────────────────────────────────────────────────
  console.log(`  ${C.cyan}[4/4]${C.reset} Regenerating the import map...`)
  if (dryRun) {
    console.log(`  ${C.dim}skipped (--dry-run)${C.reset}`)
  } else {
    run(`${pm === 'npm' ? 'npx payload' : `${pm} payload`} generate:importmap`, projectDir)
  }
  console.log('')

  // ── What is left, and how to finish ───────────────────────────────
  const drops = dropStatements(slugs)
  console.log(`  ${C.green}Done.${C.reset}`)
  console.log('')
  console.log('  The tables themselves are still there: Payload owns the schema, and a')
  console.log('  plugin dropping tables from under it is how a database drifts away from')
  console.log('  the migration ledger. Finish with ONE of these, then run')
  console.log(`  ${C.dim}payload migrate:create${C.reset} so your migrations match the new config:`)
  console.log('')
  console.log(`  ${C.dim}SQLite     ${drops.sqlite}${C.reset}`)
  console.log(`  ${C.dim}PostgreSQL ${drops.postgres}${C.reset}`)
  console.log(`  ${C.dim}MongoDB    ${drops.mongo}${C.reset}`)
  console.log('')
  console.log(`  ${C.dim}The <slug>_id columns Payload adds to payload_locked_documents_rels`)
  console.log(`  for each collection stay behind; Payload ignores them.${C.reset}`)
  console.log('')
}

// Only run when invoked as a binary, so the helpers above stay importable by
// the test suite.
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (invokedDirectly) main()
