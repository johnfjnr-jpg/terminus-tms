// THE APPROVED TEARDOWN. Create-from ownership round close, 2026-09-08.
//
// A COUNTED CHANGE: ids listed before, a result per id, and a residue re-count
// afterwards that RE-QUERIES rather than trusting the update's own result
// (Verification 11).
//
// SOFT delete only. records carries ON DELETE RESTRICT from record_revisions,
// approvals and audit_log, so a hard delete is blocked or orphans history; and
// no reference_number_counters row is touched, because a counter deleted while
// a soft-deleted record still holds a code from it restarts and collides.
//
// Enumerated from the TAG IN THE DATABASE, never from a file. Every select's
// error is checked - the Phase 1 census did not, and reported a false zero.
import { admin } from '../fixtures.mjs'
const db = admin()
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

const revs = must(await db.from('record_revisions').select('record_id, payload')
  .ilike('payload->>name', '%cf1b-%'), 'revisions')
const ids = [...new Set(revs.map((r) => r.record_id))]
const nameOf = (id) => (revs.find((r) => r.record_id === id)?.payload?.name ?? '?')

const before = must(await db.from('records')
  .select('id, record_type, reference_code, deleted_at').in('id', ids), 'records before')
const live = before.filter((r) => !r.deleted_at)

console.log(`BEFORE: ${before.length} cf1b-* records, ${live.length} live, ${before.length - live.length} already soft-deleted\n`)
console.log('THE IDS, listed before anything is written:')
for (const r of live) console.log(`  ${r.id}  ${r.record_type.padEnd(10)} ${(r.reference_code ?? '--').padEnd(19)} ${nameOf(r.id)}`)
if (!live.length) { console.log('  (none)'); process.exit(0) }

// A FROZEN RECORD CANNOT BE TORN DOWN: refuse_write_while_frozen refuses every
// write to a record with an open transition request, the soft delete included.
const open = must(await db.from('transition_requests').select('id, record_id')
  .in('record_id', live.map((r) => r.id)).eq('status', 'open'), 'open requests')
console.log(`\nopen transition requests blocking the delete: ${open.length}`)
if (open.length) {
  must(await db.from('transition_requests').update({
    status: 'withdrawn', closed_at: new Date().toISOString(),
    close_reason: 'teardown: the fixture this request froze is being removed',
  }).in('id', open.map((r) => r.id)).select('id'), 'withdraw')
  console.log(`  ${open.length} withdrawn, not deleted - they are the audit trail`)
}

console.log('\nPER-ID RESULT:')
const stamp = new Date().toISOString()
let okCount = 0
for (const r of live) {
  const { data, error } = await db.from('records')
    .update({ deleted_at: stamp }).eq('id', r.id).select('id, deleted_at')
  const done = !error && data?.length === 1 && data[0].deleted_at
  if (done) okCount++
  console.log(`  ${done ? 'SOFT-DELETED' : 'FAILED      '}  ${r.id}  ${r.record_type}${error ? '  ' + error.message : ''}`)
}

// RE-QUERY. Never trust the update's own result.
const after = must(await db.from('records')
  .select('id, deleted_at').in('id', ids), 'records after')
const stillLive = after.filter((r) => !r.deleted_at)
console.log(`\nRESIDUE RE-COUNT, re-queried rather than assumed:`)
console.log(`  cf1b-* records live anywhere: ${stillLive.length}`)
console.log(`  soft-deleted this run:        ${okCount} of ${live.length}`)
console.log(`  counters touched:             0`)
process.exit(stillLive.length === 0 && okCount === live.length ? 0 : 1)
