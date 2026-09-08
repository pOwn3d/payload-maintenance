/**
 * Data half of the uninstall, executed through `payload run`.
 *
 * It is a separate file because it needs Payload's own loader: `payload run`
 * resolves the host's `payload.config.ts`, applies its env and TypeScript
 * pipeline, then imports this module. A plain `node scripts/uninstall.mjs`
 * cannot do that.
 *
 * It uses the LOCAL API rather than a `sqlite3` shell, deliberately:
 *  - it works on SQLite, PostgreSQL and MongoDB alike, whereas a hardcoded
 *    `sqlite3` binary silently succeeds-by-doing-nothing on the other two;
 *  - it honours CUSTOM SLUGS. Every collection of this plugin is configurable
 *    (`subscribersSlug`, `historySlug`, `analyticsSlug`, `webhookLogsSlug`), so
 *    a script assuming the defaults would leave a renamed install untouched
 *    while reporting success.
 *
 * It deletes ROWS, not tables. Payload owns the DDL: dropping a table from
 * under it is how a database drifts from the migration ledger. The uninstaller
 * prints the DROP statements for the three adapters instead.
 *
 * Usage (called by bin/uninstall.mjs; runnable by hand too):
 *   pnpm payload run node_modules/@consilioweb/payload-maintenance/scripts/purge-data.mjs
 *   ... --slugs maintenance-subscribers,maintenance-analytics
 *   ... --dry-run
 */

import { pathToFileURL } from 'node:url'
import { getPayload } from 'payload'
import { findConfig } from 'payload/node'

const DEFAULT_SLUGS = [
  'maintenance-subscribers',
  'maintenance-history',
  'maintenance-analytics',
  'maintenance-webhook-logs',
]

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

const dryRun = process.argv.includes('--dry-run')
const slugs = (argValue('slugs') ?? DEFAULT_SLUGS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const configPath = findConfig()
const imported = await import(pathToFileURL(configPath).toString())
const config = await (imported.default ?? imported)
const payload = await getPayload({ config })

let failures = 0

for (const slug of slugs) {
  // A slug the host disabled (`enableAnalytics: false`) simply is not in the
  // config: report it and move on rather than aborting the whole run.
  if (!payload.collections?.[slug]) {
    console.log(`  -  ${slug}: not in this Payload config, skipped`)
    continue
  }

  try {
    const { totalDocs } = await payload.count({ collection: slug, overrideAccess: true })

    if (dryRun) {
      console.log(`  ?  ${slug}: ${totalDocs} document(s) would be deleted`)
      continue
    }

    if (totalDocs === 0) {
      console.log(`  OK ${slug}: already empty`)
      continue
    }

    // `id: { exists: true }` matches every row on all three adapters.
    await payload.delete({
      collection: slug,
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    console.log(`  OK ${slug}: ${totalDocs} document(s) deleted`)
  } catch (error) {
    failures++
    console.error(`  !! ${slug}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// The global cannot be deleted through the local API — Payload has no
// `deleteGlobal`. Its row is dropped with the table, which the uninstaller
// documents. Blanking it here would leave a half-erased singleton behind.
console.log('')
console.log('  Note: the "maintenance" global keeps its row until its table is dropped.')
console.log('  The uninstaller prints the statements for SQLite, PostgreSQL and MongoDB.')

await payload.destroy?.()
process.exit(failures > 0 ? 1 : 0)
