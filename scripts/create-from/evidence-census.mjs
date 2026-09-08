// PHASE 2: the evidence footprint, enumerated from a TAG IN THE DATABASE.
//
// Verification 11: never from a file the harness wrote. PROPOSAL ONLY - this
// script never deletes.
//
// EVERY SELECT'S ERROR IS CHECKED. Verification 8, and it is here because the
// Phase 1 version of this census did not: it selected audit_log.created_at,
// which does not exist, read the resulting null as an empty array, and
// reported the zero as a finding in a signed-off report. An unchecked read is
// at least visibly empty; an unchecked read behind a ?? [] is a false zero
// wearing the shape of a measurement.
import { admin } from '../fixtures.mjs'
const db = admin()
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

const revs = must(await db.from('record_revisions').select('record_id, payload')
  .ilike('payload->>name', '%cf1b-%'), 'revisions')
const ids = [...new Set(revs.map((r) => r.record_id))]
const recs = must(await db.from('records')
  .select('id, record_type, reference_code, owner_id, deleted_at').in('id', ids), 'records')
const { data: u } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const other = u.users.find((x) => x.email === 'ownership-other@terminus-probe.invalid')?.id
const nameOf = (id) => (revs.find((r) => r.record_id === id)?.payload?.name ?? '?')
const tagOf = (id) => (nameOf(id).match(/cf1b-[a-z0-9]+/) ?? ['cf1b-?'])[0]
const live = recs.filter((r) => !r.deleted_at)
const gone = recs.filter((r) => r.deleted_at)

console.log(`cf1b-* records: ${recs.length} total, ${live.length} LIVE, ${gone.length} already soft-deleted`)
const byTag = {}
for (const r of recs) {
  const k = tagOf(r.id)
  byTag[k] ??= { live: 0, gone: 0 }
  byTag[k][r.deleted_at ? 'gone' : 'live']++
}
console.log('\nby tag (each is one probe run):')
for (const [t, v] of Object.entries(byTag).sort()) console.log(`  ${t.padEnd(14)} ${String(v.live).padStart(3)} live   ${String(v.gone).padStart(3)} soft-deleted`)

// WHO DELETED THEM. A single shared timestamp is one bulk update, not a
// per-fixture teardown, and the difference is the whole finding.
const stamps = [...new Set(gone.map((r) => r.deleted_at))].sort()
console.log(`\ndistinct deleted_at values across ${gone.length} deletions: ${stamps.length}`)
for (const s of stamps) console.log(`  ${s}  ${gone.filter((r) => r.deleted_at === s).length} records`)

console.log(`\nLIVE, by owner:`)
console.log(`  handed to the probe account: ${live.filter((r) => r.owner_id === other).length}`)
console.log(`  owned by the test account:   ${live.filter((r) => r.owner_id !== other).length}`)

// THE AUDIT QUESTION, measured with its error checked this time.
const theirs = recs.filter((r) => r.owner_id === other)
const audit = must(await db.from('audit_log').select('record_id, action')
  .in('record_id', theirs.map((r) => r.id)), 'audit_log')
console.log(`\nAUDIT ROWS on the ${theirs.length} records owned by the probe account: ${audit.length}`)
const acts = {}
for (const a of audit) acts[a.action] = (acts[a.action] ?? 0) + 1
for (const [a, n] of Object.entries(acts).sort()) console.log(`  ${a.padEnd(22)} ${n}`)
console.log(audit.length === 0
  ? '  -> zero. The brief\'s claim that a source gains an audit row is not reproduced.'
  : '  -> non-zero. The Phase 1 report\'s "anomaly" was a false zero from an')
if (audit.length) console.log('     unchecked select error. THERE IS NO ANOMALY; the claim holds.')

console.log(`\nPROPOSAL: soft-delete the ${live.length} live cf1b-* records. Soft only;`)
console.log('no reference_number_counters row is touched (Verification 11).')
