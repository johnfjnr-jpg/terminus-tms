// ── PRUNE THE FIXTURE TAG LEDGER OF DEAD ENTRIES. Ruling R7 ──────────────
//
// tearDown() now prunes the tags it sweeps, but entries written before that
// existed stay for the life of the checkout, and every reader pays for them:
// `teardown-scoping.test.mjs` weighs each ledger tag, and each weigh scans
// `record_revisions` whole (~310ms, measured, whatever the tag matches).
//
// A tag with no LIVE record can teach a later sweep nothing: teardown soft
// deletes, so anything it swept is already gone from the live set. This removes
// exactly those, in ONE grouped query over the whole ledger, and writes nothing
// to the database.
//
// UNWIRED. Run: node --env-file=.env scripts/testbed-units/prune-ledger.mjs [--apply]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { admin, tagsToSweep, pagedSelect } from '../fixtures.mjs'
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
// The ledger lives beside the repo root's .scratch, where fixtures.mjs keeps it.
const TAGS = `${ROOT}/.scratch/fixture-tags.json`
const APPLY = process.argv.includes('--apply')
const db = admin()
const tags = tagsToSweep()
const or = (ts) => ts.map((t) => `payload->>name.ilike.${t}%`).join(',')
const CHUNK = 6
const liveNames = []
for (let i = 0; i < tags.length; i += CHUNK) {
  const rows = await pagedSelect(() => db.from('record_revisions')
    .select('name:payload->>name, records!inner(deleted_at)')
    .or(or(tags.slice(i, i + CHUNK)))
    .is('records.deleted_at', null), `live rows ${i}`)
  liveNames.push(...rows.map((r) => String(r.name ?? '')))
}
const alive = new Set()
for (const n of liveNames) { const hit = tags.find((t) => n.startsWith(t)); if (hit) alive.add(hit) }
const dead = tags.filter((t) => !alive.has(t))
console.log(`ledger ${tags.length} tags; with live records ${alive.size}; dead ${dead.length}`)
console.log(`alive: ${[...alive].join(', ') || 'none'}`)
if (!APPLY) { console.log('dry run; pass --apply to write the pruned ledger'); process.exit(0) }
writeFileSync(TAGS, JSON.stringify([...alive], null, 2))
console.log(`wrote ${TAGS}: ${alive.size} tags kept, ${dead.length} removed`)
