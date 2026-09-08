// Calibration of scripts/tests/convert-atomicity.test.mjs, in both directions.
//
// ─────────────────────────────────────────────────────────────
// THE HARNESS CANNOT DESTROY THE WORK IT IS CALIBRATING
// ─────────────────────────────────────────────────────────────
//
// Verification 44 asks a fault-injection harness to snapshot the actual bytes,
// assert the snapshot exists before injecting, compare the restored bytes after
// every injection, and stop dead on a mismatch. Two harnesses in this project
// destroyed the work they were calibrating in consecutive phases.
//
// This one is built so those checks have nothing to catch: it NEVER WRITES TO
// THE MIGRATION. The test reads its target from CONVERT_MIGRATION, so each
// injection is written to a fresh temporary copy and the real file is only ever
// read. Architecture rule 14(a) at the level of tooling - prefer the construct
// that cannot carry the error over the one that is safe if operated correctly.
//
// The final check confirms the real file is byte-identical to where it started
// anyway, because a harness that believes it cannot touch something is exactly
// the harness that should verify it.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const MIGRATION = ROOT + 'supabase/migrations/20260908000001_convert_is_one_transaction.sql'
const TEST = ROOT + 'scripts/tests/convert-atomicity.test.mjs'

const original = readFileSync(MIGRATION, 'utf8')
const originalHash = createHash('sha256').update(original).digest('hex')
const dir = mkdtempSync(join(tmpdir(), 'convert-cal-'))
console.log(`migration sha256 ${originalHash.slice(0, 16)}  scratch ${dir}\n`)

function run(sql, label) {
  // Keyed on the full path, per Verification 44: a basename is not unique
  // across a tree, and this repository mirrors names on purpose.
  const target = join(dir, `${label.replace(/[^a-z0-9]+/gi, '_')}.sql`)
  writeFileSync(target, sql)
  const r = spawnSync('node', ['--test', TEST], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, CONVERT_MIGRATION: target },
  })
  const out = r.stdout + r.stderr
  const fail = Number((out.match(/^. fail (\d+)$/m) ?? [])[1] ?? -1)
  const pass = Number((out.match(/^. pass (\d+)$/m) ?? [])[1] ?? -1)
  return { fail, pass, out }
}

// A run that produced no parseable result is a STOP, never a score.
// Verification 48: a stage that fails faster than it could do its work has not
// run, and a harness that reads "no result" as "caught it" reports three
// successful calibrations for an expired token.
function must(label, sql, expectFail, matcher) {
  const { fail, pass, out } = run(sql, label)
  if (fail < 0 || pass < 0) {
    console.log(`  STOP  ${label}: the test run produced no parseable result`)
    console.log(out.slice(-800))
    process.exit(2)
  }
  const fired = expectFail ? fail > 0 : fail === 0
  const named = !matcher || out.includes(matcher)
  console.log(`  ${fired && named ? 'FIRED' : 'SILENT'}  ${label}  (pass ${pass}, fail ${fail})`)
  if (!fired) console.log(`         expected ${expectFail ? 'at least one failure' : 'no failures'}`)
  if (fired && !named) console.log(`         fired, but not on the expected test: looked for "${matcher}"`)
  return fired && named
}

const results = []
const inject = (label, from, to, matcher) => {
  if (!original.includes(from)) {
    console.log(`  STOP  ${label}: the anchor is not in the file, so this injection is a no-op`)
    process.exit(2)
  }
  results.push(must(label, original.replace(from, to), true, matcher))
}

console.log('DIRECTION ONE: each claim, falsified')

inject('an exception handler is added',
  'end;\n$$;\n\ncomment on function public.convert_test_bed',
  'exception when others then null;\nend;\n$$;\n\ncomment on function public.convert_test_bed',
  'NEITHER function carries an exception block')

inject('a function becomes SECURITY DEFINER',
  'security invoker\nset search_path = public\nas $$\ndeclare\n  v_actor uuid := auth.uid();\n  v_bed',
  'security definer\nset search_path = public\nas $$\ndeclare\n  v_actor uuid := auth.uid();\n  v_bed',
  'SECURITY INVOKER')

inject('an identity guard is restated in the function',
  "  if p_bed_id is null then",
  "  if v_actor is null then\n    raise exception 'not signed in' using errcode = 'PT401';\n  end if;\n  if p_bed_id is null then",
  'restates the identity check')

inject('the deleted_at exclusion is dropped from the count',
  '            and o.deleted_at is null\n',
  '\n',
  'deleted_at exclusion')

inject('the limit refusal is given PT409 instead',
  "using errcode = 'PT422'",
  "using errcode = 'PT409'",
  'raises PT422')

inject('the advisory lock is removed',
  '  perform pg_advisory_xact_lock(hashtextextended(p_bed_id::text, 0));\n',
  '\n',
  'advisory lock on the bed')

inject('the bed reference_code becomes a caller parameter',
  '  p_bed_id          uuid,\n  p_payload         jsonb,',
  '  p_bed_id          uuid,\n  p_bed_reference_code text,\n  p_payload         jsonb,',
  'identity or record state as a parameter')

// INVERTED 2026-09-08, with the migration it calibrates. It used to inject the
// REMOVAL of a self-recording ledger row and expect a failure. That row is what
// broke the push (23505 at statement 7, the CLI's own insert colliding with
// it), so the claim is now that the file must NOT carry one, and the injection
// adds one back.
inject('a self-recording ledger row is added back',
  'grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;',
  "grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;\n\ninsert into supabase_migrations.schema_migrations (version)\nvalues ('20260908000001')\non conflict (version) do nothing;",
  'does NOT self-record its ledger row')

inject('the grant is dropped',
  'grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;',
  '',
  'executable by the authenticated role')

inject('an insert is lost from the contact path',
  '  insert into public.record_contacts (\n    record_id, contact_id, role, created_by\n  ) values (\n    v_opp.id, p_contact_id, \'commercial buyer\', v_actor\n  );\n',
  '',
  'all five writes are present')

console.log('\nDIRECTION TWO: prose must not satisfy or defeat the scan')

// A COMMENT saying the forbidden thing, inside the body. Under a strip that
// does not reach into a dollar-quoted body, this would fail the test - which is
// exactly the fault Verification 39 names, and the first run of the test file
// hit it for real.
results.push(must('a comment mentioning an exception handler leaves it green',
  original.replace('  perform pg_advisory_xact_lock',
    '  -- deliberately no `exception when others` handler here, per ruling 2\n  perform pg_advisory_xact_lock'),
  false))

results.push(must('a comment mentioning security definer leaves it green',
  original.replace('  perform pg_advisory_xact_lock',
    '  -- a security definer function would bypass every policy below\n  perform pg_advisory_xact_lock'),
  false))

results.push(must('the untouched file is green', original, false))

// The harness verifies the thing it believes it cannot have touched.
const after = readFileSync(MIGRATION, 'utf8')
const afterHash = createHash('sha256').update(after).digest('hex')
console.log(`\nmigration sha256 after ${afterHash.slice(0, 16)}  unchanged = ${afterHash === originalHash}`)
if (afterHash !== originalHash) { console.log('THE HARNESS MODIFIED THE MIGRATION. STOP.'); process.exit(2) }

const fired = results.filter(Boolean).length
console.log(`\n${fired}/${results.length} calibrations behaved as required`)
process.exit(fired === results.length ? 0 : 1)
