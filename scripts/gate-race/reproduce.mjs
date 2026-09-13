// ── THE FORCED REPRODUCTION: make INVARIANT 2 fail ON DEMAND ─────────────
//
// The race is real but intermittent, and an intermittent failure is not a
// counterfactual. This makes it deterministic: create exactly the row a
// parallel gates.test.mjs run holds live, run config-invariants alone, and
// read WHICH assertion failed (Verification 9's clause - a red run and a
// red run look the same).
//
// It cleans up on every path, including a thrown one, and verifies the
// cleanup by re-querying rather than trusting the delete.
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = `harness_racefix_${process.pid}`
// TWO invariants, because build-discipline 8 says fix the class and the
// class has to be MEASURED, not inferred. INVARIANT 4 was reasoned to be
// exposed from `stage_reference_docs` holding only `test_bed` rows;
// Verification 26 says the clause after "so" is its own claim.
const MARKERS = {
  2: 'INVARIANT 2: no gate rule names a stage absent from stage_definitions',
  4: 'INVARIANT 4: every document_status document exists in stage_reference_docs for the same record_type and from_stage',
}

const runInvariants = () => {
  const t = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--test', '--env-file-if-exists=.env',
      'scripts/tests/config-invariants.test.mjs'],
      { cwd: '/Users/johnfryatt/terminus-tms', encoding: 'utf8', stdio: 'pipe' })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  // ANCHOR ON EACH NAMED ASSERTION, never the exit code.
  const fired = {}
  for (const [n, marker] of Object.entries(MARKERS))
    fired[n] = out.includes(`✖ ${marker}`) || out.includes(`not ok`) && out.includes(marker) && /✖/.test(out)
  return { fired, ms: Date.now() - t, out }
}

const created = []
try {
  const show = (label, r) => {
    console.log(`  ${label}`)
    for (const n of Object.keys(MARKERS)) console.log(`      INVARIANT ${n} failed: ${r.fired[n]}`)
    console.log(`      ${r.ms}ms`)
  }
  console.log('=== 1. BASELINE: no fixture row present ===')
  const before = runInvariants()
  show('baseline', before)

  console.log('\n=== 2. CREATE exactly what a parallel gates.test.mjs holds live ===')
  // BOTH shapes the harness actually creates: a payload rule (trips 2) and
  // a document_status rule (predicted to trip 4).
  for (const r of [
    { requirement_type: 'payload_field_required', requirement_detail: { field: 'name' } },
    { requirement_type: 'document_status', requirement_detail: { document: 'NDA', status: 'approved' } },
  ]) {
    const row = must(await db.from('stage_gate_rules').insert({
      record_type: TAG, variant: null,
      from_stage: 'Fixture Start', to_stage: 'Fixture End', ...r,
    }).select('id, requirement_type').single(), 'insert')
    created.push(row.id)
    console.log(`  created ${row.id}  ${row.requirement_type}`)
  }
  console.log(`    record_type ${TAG} - a synthetic type with NO stage_definitions`)
  console.log(`    and no stage_reference_docs, exactly as the harness makes`)

  console.log('\n=== 3. RUN config-invariants WITH the rows live ===')
  const during = runInvariants()
  show('with fixtures live', during)

  console.log('\n=== VERDICT ===')
  console.log(`  INVARIANT 2: ${before.fired[2]} -> ${during.fired[2]}  ${!before.fired[2] && during.fired[2] ? 'REPRODUCED' : 'not reproduced'}`)
  console.log(`  INVARIANT 4: ${before.fired[4]} -> ${during.fired[4]}  ${!before.fired[4] && during.fired[4] ? 'REPRODUCED' : 'not reproduced'}`)
  if (!before.fired[2] && during.fired[2]) {
    console.log('  REPRODUCED ON DEMAND. One row a parallel test holds live turns')
    console.log('  INVARIANT 2 red, with zero real orphans in the configuration.')
    console.log('  This is the counterfactual the fix must close.')
  } else {
    console.log('  *** NOT REPRODUCED. The mechanism is not what was measured, or')
    console.log('      the detector could not see it. Do not proceed on this.')
  }
} finally {
  if (created.length) {
    // The harness hard-deletes its own gate rules (verify-harness #hardDelete),
    // so this follows the same convention. Config rows, not record fixtures -
    // the soft-delete rule is about `records`.
    const { error } = await db.from('stage_gate_rules').delete().in('id', created)
    if (error) console.error(`  *** CLEANUP FAILED for ${created.join(', ')}: ${error.message}`)
    const left = must(await db.from('stage_gate_rules').select('id').eq('record_type', TAG), 'recheck')
    console.log(`\n  cleanup: re-queried by tag, ${left.length} rows remain (expected 0)`)
    if (left.length) process.exit(2)
  }
}
