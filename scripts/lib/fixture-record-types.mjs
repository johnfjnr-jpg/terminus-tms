// ── THE ONE DEFINITION OF "THIS ROW BELONGS TO A TEST FIXTURE" ───────────
//
// Verification 20: a second reader of the same value always drifts. This
// convention was declared in `scripts/tests/gates.test.mjs` and NOWHERE
// ELSE - not even in `verify-harness.mjs`, which creates the rows. So
// `config-invariants.test.mjs`, asserting the same claim on the same table,
// had no way to know the convention existed.
//
// The consequence was measured: the two files disagreed, `node --test` runs
// them concurrently, and INVARIANT 2 and INVARIANT 4 went red or green by
// timing while the configuration held zero real orphans.
//
// ── A NAME, AND THE LIMITATION STATED RATHER THAN HIDDEN ─────────────────
//
// Verification 19 prefers a structural or DECLARED property to a name.
// There is none available here: `stage_gate_rules` carries
// `id, record_type, variant, from_stage, to_stage, requirement_type,
// requirement_detail, created_at` and nothing marks a row as a fixture.
//
// Where only a name exists, the remedy is ONE definition plus an assertion
// that the exclusion never swallows real configuration - which is
// `assertExclusionSpares` below, and it is the half that makes this correct
// rather than merely quiet.
//
// If a fixture-marking column is ever added, this predicate is the single
// place that changes.

/** The prefix `verify-harness` fixtures use for their synthetic record types. */
export const FIXTURE_RECORD_TYPE_PREFIX = 'harness_'

/**
 * True for a record_type that belongs to a test fixture rather than to the
 * product's configuration.
 */
export function isFixtureRecordType(recordType) {
  return String(recordType ?? '').startsWith(FIXTURE_RECORD_TYPE_PREFIX)
}

/**
 * THE COVERAGE ASSERTION, and the reason this module is not just a filter.
 *
 * An exclusion that hides a real orphan is worse than the race it closes.
 * This asserts the predicate excludes NOTHING that the product actually
 * configures: every record_type with `stage_definitions` rows must survive
 * it. Widen the prefix to swallow `test_bed` and this goes red.
 *
 * Derived from the database rather than from a hardcoded list, so a new
 * record type is covered by existing, without anybody editing this file.
 */
export function assertExclusionSpares(assert, stageDefinitionRows) {
  const configured = [...new Set(stageDefinitionRows.map((s) => s.record_type))].sort()
  assert.ok(configured.length > 0,
    'no record types are configured at all, so this assertion proves nothing')
  const swallowed = configured.filter(isFixtureRecordType)
  assert.deepEqual(swallowed, [],
    `the fixture exclusion swallows CONFIGURED record types, so the invariants `
    + `it guards have gone blind to real orphans in them:\n${JSON.stringify(swallowed, null, 2)}`)
  return configured
}
