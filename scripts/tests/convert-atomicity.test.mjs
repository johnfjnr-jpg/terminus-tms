// The convert-atomicity migration's structural claims, asserted on the SQL. PURE.
//
// ─────────────────────────────────────────────────────────────
// WHY A SOURCE TEST AND NOT ONLY A PROBE
// ─────────────────────────────────────────────────────────────
//
// Ruling 2 - a failed audit_log insert rolls the conversion back - is
// implemented by CONSTRUCT rather than by code: a plpgsql function with no
// EXCEPTION block cannot commit part of itself, because any error propagates
// out and aborts the call. There is nothing to assert at runtime beyond one
// instance of it, and one instance does not prove the general claim.
//
// What CAN go wrong is somebody adding an exception handler later, in good
// faith, to improve an error message. That would silently restore the
// fire-and-forget behaviour this round removed, no test would fail, and the
// conversion would go back to committing without its audit trail. This test is
// the thing that fails.
//
// THE FILE IS READ THROUGH THE ESTATE'S STRIPPER, so a comment describing an
// exception block cannot satisfy or defeat any assertion here (Verification 39,
// and this file's own prose is exactly the hazard: it says "EXCEPTION" nine
// times).
//
// TARGETABLE BY PATH so the calibration can point it at a mutated COPY and
// never touch the real migration. Verification 44 asks a fault-injection
// harness to verify its own snapshot and its own restore; a harness that never
// writes to the source cannot fail either check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripSql } from '../lib/strip-comments.mjs'

const PATH = process.env.CONVERT_MIGRATION
  ?? new URL('../../supabase/migrations/20260908000001_convert_is_one_transaction.sql', import.meta.url).pathname

const raw = readFileSync(PATH, 'utf8')

// THE ESTATE'S stripSql DOES NOT REACH INSIDE A DOLLAR-QUOTED BODY, and it is
// right not to: CLAUDE.md Verification 39 names `$$ -- inside a plpgsql body $$`
// as one of the things a stripper must NOT eat, because a dollar-quoted string
// is code to Postgres and text to a scanner. Measured, not assumed - the first
// run of this file matched its own comments.
//
// So the file-level strip removes the SQL comments AROUND the functions, and
// bodyOf removes the plpgsql `--` comments INSIDE one. Both directions of that
// second strip are calibrated by scripts/convert-atomicity/calibrate-migration-test.mjs.
const sql = stripSql(raw)

const FUNCTIONS = ['convert_test_bed', 'create_opportunity_from_contact']

// `--` to end of line is a comment in plpgsql. A `--` inside a string literal
// would be eaten by this, which is why it is applied ONLY to the function
// bodies in this one migration and never offered as a general tool.
const stripPlpgsqlComments = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

// Each function's body, from its own `create or replace` to the closing `$$;`.
function bodyOf(name) {
  const start = sql.toLowerCase().indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1, `${name} is not declared in ${PATH}`)
  const end = sql.indexOf('$$;', start)
  assert.notEqual(end, -1, `${name} has no closing $$;`)
  return stripPlpgsqlComments(sql.slice(start, end))
}

test('both functions are declared', () => {
  for (const f of FUNCTIONS) assert.ok(sql.toLowerCase().includes(`create or replace function public.${f}(`), f)
})

test('NEITHER function carries an exception block, which is what makes the audit ruling real', () => {
  // `exception when` is the only form a plpgsql handler takes. Matching the
  // bare word would hit `raise exception`, which is the opposite thing and
  // appears in both bodies on purpose.
  for (const f of FUNCTIONS) {
    assert.doesNotMatch(bodyOf(f), /\bexception\s+when\b/i,
      `${f} has an exception handler: any error it swallows commits a partial conversion`)
  }
})

test('both functions raise, so the no-handler claim is about something that happens', () => {
  // Verification 14: "X is not present" needs a companion asserting X exists
  // somewhere, or the assertion is true by absence. A body that raises nothing
  // would pass the test above for the wrong reason.
  for (const f of FUNCTIONS) {
    assert.match(bodyOf(f), /raise exception/i, `${f} raises nothing, so it has no error to handle`)
  }
})

test('both functions are SECURITY INVOKER, never definer', () => {
  for (const f of FUNCTIONS) {
    const body = bodyOf(f)
    assert.match(body, /security invoker/i, `${f} must run as the caller`)
    assert.doesNotMatch(body, /security definer/i,
      `${f} as definer would satisfy every owner-scoped insert policy as its owner`)
  }
})

test('neither function restates the identity check the policies already make', () => {
  // The five insert policies all read auth.uid(). A guard raising on a null
  // auth.uid() would be a second reader of that fact (Verification 20) and
  // would mask the RLS refusal, making it unprovable.
  for (const f of FUNCTIONS) {
    assert.doesNotMatch(bodyOf(f), /if\s+v_actor\s+is\s+null/i,
      `${f} restates the identity check RLS makes, which hides the refusal`)
  }
})

test('both functions are executable by the authenticated role', () => {
  for (const f of FUNCTIONS) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to authenticated`, 'i'), f)
  }
})

test('convert_test_bed takes the advisory lock on the bed, and the contact path does not', () => {
  assert.match(bodyOf('convert_test_bed'), /pg_advisory_xact_lock\(hashtextextended\(p_bed_id::text, 0\)\)/i,
    'the lock is what makes the conversion count true')
  assert.doesNotMatch(bodyOf('create_opportunity_from_contact'), /pg_advisory_xact_lock/i,
    'there is no read-then-write on the contact path, so a lock there protects nothing')
})

test('the conversion count preserves the deleted_at exclusion', () => {
  const body = bodyOf('convert_test_bed')
  assert.match(body, /o\.deleted_at is null/i,
    'a soft-deleted Opportunity must not count, or deleting one cannot free its bed')
  assert.match(body, /converted_from_test_bed_id = p_bed_id/i, 'the count must be scoped to this bed')
})

test('the limit refusal raises PT422, and it is not one of the codes already in use', () => {
  assert.match(bodyOf('convert_test_bed'), /errcode = 'PT422'/)
  // Enumerated from the estate rather than recalled: PT422 must not already
  // mean something else. PT409 in particular means "the record moved under you",
  // which a conversion limit is not.
  const IN_USE = ['PT400', 'PT401', 'PT403', 'PT404', 'PT409', 'PT412', 'PT423', 'PT500']
  assert.ok(!IN_USE.includes('PT422'), 'PT422 collides with an existing code')
  assert.doesNotMatch(bodyOf('convert_test_bed'), /errcode = 'PT409'/,
    'a conversion limit is not a staleness conflict')
})

test('neither function accepts identity or record state as a parameter', () => {
  // Architecture rule 12's test: a parameter is the caller's claim, and owner,
  // actor, account_id and the source record's reference_code are facts the
  // database holds.
  for (const f of FUNCTIONS) {
    const at = sql.toLowerCase().indexOf(`create or replace function public.${f}(`)
    const signature = sql.slice(at, at + sql.slice(at).indexOf(')'))
    for (const forbidden of ['p_owner', 'p_actor', 'p_created_by', 'p_account_id', 'p_bed_reference_code']) {
      assert.ok(!signature.includes(forbidden),
        `${f} takes ${forbidden}: identity and record state are derived, not accepted`)
    }
  }
})

test('the migration does NOT self-record its ledger row', () => {
  // SUPERSEDES the assertion this replaced, and the superseded reasoning is
  // left visible per Verification 29 rather than deleted.
  //
  // IT USED TO READ "the migration carries its own ledger row", from
  // Architecture rule 10: applying through the Supabase dashboard does not
  // write to supabase_migrations.schema_migrations, so the row travels in the
  // same paste, guarded `on conflict (version) do nothing` and therefore "safe
  // under both paths".
  //
  // THE PREMISE FAILED, MEASURED LIVE 2026-09-08. `supabase db push` failed on
  // this migration with 23505 at statement 7 and rolled the whole thing back;
  // neither function was created. The CLI writes the ledger row ITSELF after
  // running the file, in the same transaction, with an insert carrying no
  // conflict clause - so it is the CLI's insert that collides with the row the
  // file already wrote. The file's own `on conflict` protects the file's
  // statement and can do nothing about the CLI's.
  //
  // A decision whose comparison has lost a leg is RE-TAKEN, not re-weighed.
  // The rule's by-hand case is real and unaddressed by this: if this file is
  // ever applied through the dashboard, the ledger row is inserted afterwards
  // as a separate statement.
  assert.doesNotMatch(sql, /insert into supabase_migrations\.schema_migrations/i,
    'a self-recording ledger insert collides with the CLI\'s own and rolls the migration back')
})

test('the plpgsql comment strip keeps the code it is applied to', () => {
  // Verification 39's second half, on this file's own local stripper. A strip
  // that ate the body would make every assertion above a silent pass.
  for (const f of FUNCTIONS) {
    const body = bodyOf(f)
    for (const t of ['public.records', 'public.record_revisions', 'public.opportunity_details', 'public.audit_log']) {
      assert.ok(body.includes(`insert into ${t} (`), `${f}: the strip ate the insert into ${t}`)
    }
  }
  assert.ok(bodyOf('create_opportunity_from_contact').includes('insert into public.record_contacts ('),
    'the strip ate the contact link insert')
})

test('all five writes are present in the two functions, so atomicity is about something', () => {
  // Verification 14 again: "no exception handler" is only worth asserting if
  // there are writes for a handler to have swallowed.
  const convert = bodyOf('convert_test_bed')
  const fromContact = bodyOf('create_opportunity_from_contact')
  const count = (body) => (body.match(/insert into public\./g) ?? []).length
  assert.equal(count(convert), 4, 'convert_test_bed writes records, revision, details and audit')
  assert.equal(count(fromContact), 5, 'the contact path adds the record_contacts link')
})
