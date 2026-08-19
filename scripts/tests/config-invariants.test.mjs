// Round 9 Phase 7 - invariants defending the gate configuration itself.
// Runs under `npm run test:db`.
//
// These are deliberately different in kind from gates.test.mjs. That file
// builds synthetic fixtures and asserts that computeBlocking BEHAVES
// correctly. This file asserts things about the LIVE CONFIGURATION: that
// the rows written across Rounds 7 and 9 are still there, still
// internally consistent, and still consistent with the other three tables
// that hold the same strings independently.
//
// The rows written in this round are only as durable as the assertions
// protecting them, and DESIGN_PRINCIPLES.md already records that when a
// control matters the assertion belongs in the suite, where it passes or
// fails, rather than in prose. Round 9 Phase 0 found the specific cost of
// not doing that: Round 7's "exactly 7 rules" check was performed
// honestly, written into a brief, and never encoded, so the real figure
// went unverified for two rounds and appears in no document.
//
// Every assertion reads live data. None of them creates a fixture, so
// there is nothing to tear down.

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient } from '../verify-harness.mjs'

let db
let rules, stages, refDocs, tracks

before(async () => {
  db = adminClient()

  const r = await db.from('stage_gate_rules')
    .select('id, record_type, variant, from_stage, to_stage, requirement_type, requirement_detail')
  assert.equal(r.error, null, `stage_gate_rules query failed: ${r.error?.message}`)
  rules = r.data

  const s = await db.from('stage_definitions').select('record_type, variant, stage_name, sort_order')
  assert.equal(s.error, null, `stage_definitions query failed: ${s.error?.message}`)
  stages = s.data

  const d = await db.from('stage_reference_docs').select('id, record_type, stage_name, document_name')
  assert.equal(d.error, null, `stage_reference_docs query failed: ${d.error?.message}`)
  refDocs = d.data

  const t = await db.from('approval_tracks').select('track_name')
  assert.equal(t.error, null, `approval_tracks query failed: ${t.error?.message}`)
  tracks = t.data
})

const tbRules = () => rules.filter(r => r.record_type === 'test_bed')

// ─────────────────────────────────────────────────────────────
// 1. Rule count, scoped to test_bed explicitly
// ─────────────────────────────────────────────────────────────
//
// SCOPED TO record_type = 'test_bed' ON PURPOSE, not asserted over the
// whole table. Other record types (contact, smoke_test) carry their own
// rules and are configured by other work; a whole-table count would make
// this assertion fail for reasons that have nothing to do with the Test
// Bed configuration it exists to defend, and the natural fix for that
// failure would be to bump the number, which defeats it entirely.
//
// The figure is MEASURED, not the projection. It was derived as:
//   Phase 0 baseline                                    10
//   Phase 4, transitions 1-4  (+4 +2 +6 +3)            +15  -> 25
//   Phase 5, transitions 5-7  (+6 +4 +4), Senior -1    +13  -> 38
// and then confirmed by direct query at 38 after each phase landed. If a
// future round changes the configuration, this number is expected to
// move: update it from a measurement, never from an expectation.
//
//   Round 11 Phase 1, exitQualDataAndUseCase retired         -1  -> 37
//
// UPDATED FROM THE MEASUREMENT, not from the projection, exactly as the
// paragraph above requires. The invariant fired on its own before this
// line was touched, reporting "Expected 38, found 37", which is the
// assertion doing its job rather than an inconvenience: a deliberate
// configuration change is supposed to break it and be re-measured.
//
// EXPECTED TO MOVE AGAIN THIS ROUND. Phase 4 replaces the three remaining
// tick criteria with five scored ones and adds the measurability
// confirmation and three re-score rules, so 37 is this phase's measured
// figure and not the round's. Phase 7 re-derives it from the live table
// once those rows exist.
const EXPECTED_TEST_BED_RULES = 37

test('INVARIANT 1: test_bed carries exactly the configured number of gate rules', () => {
  const byTransition = {}
  for (const r of tbRules()) {
    const k = `${r.from_stage} -> ${r.to_stage}`
    byTransition[k] = (byTransition[k] ?? 0) + 1
  }
  assert.equal(tbRules().length, EXPECTED_TEST_BED_RULES,
    `test_bed gate rule count changed.\nExpected ${EXPECTED_TEST_BED_RULES}, found ${tbRules().length}.\nPer transition:\n${JSON.stringify(byTransition, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 2. Orphaned rules, every record type
// ─────────────────────────────────────────────────────────────
//
// The sibling of the assertion in gates.test.mjs, which excludes its own
// run's synthetic record_type. This one excludes nothing: it asserts
// across every record type in the table, including any harness type that
// a concurrent run has left behind, which would itself be a teardown
// failure worth surfacing.
test('INVARIANT 2: no gate rule names a stage absent from stage_definitions', () => {
  const live = new Set(stages.map(s => `${s.record_type}||${s.stage_name}`))
  const orphans = rules
    .filter(r => !live.has(`${r.record_type}||${r.from_stage}`) || !live.has(`${r.record_type}||${r.to_stage}`))
    .map(r => ({ id: r.id, record_type: r.record_type, from_stage: r.from_stage, to_stage: r.to_stage }))
  assert.deepEqual(orphans, [],
    `gate rules naming a stage that does not exist:\n${JSON.stringify(orphans, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 3. Explicit scope on every test_bed approval rule
// ─────────────────────────────────────────────────────────────
//
// Round 7 Phase 3.1 made an ABSENT scope default to 'revision', for
// continuity with every rule written before it. That default is correct
// and stays. It also means a Test Bed stage gate written without a scope
// is silently wrong rather than obviously wrong: every PATCH creates a
// new revision, so the next field edit voids the approval and re-blocks
// the gate while the tick still displays as given.
//
// This catches that at the moment the rule is written, rather than months
// later when someone reports that approvals keep disappearing.
//
// Scoped to test_bed deliberately: Deal Sheet and Opportunity commercial
// approvals are revision-scoped BY DESIGN, so asserting this table-wide
// would be asserting the opposite of the intended behaviour elsewhere.
test('INVARIANT 3: every approval_obtained rule on test_bed carries an explicit scope', () => {
  const missing = tbRules()
    .filter(r => r.requirement_type === 'approval_obtained')
    .filter(r => r.requirement_detail?.scope === undefined)
    .map(r => ({ id: r.id, from_stage: r.from_stage, to_stage: r.to_stage, requirement_detail: r.requirement_detail }))
  assert.deepEqual(missing, [],
    `test_bed approval rules with no explicit scope (they will silently default to "revision" and be voided by the next field edit):\n${JSON.stringify(missing, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 4. Document gates align with the document catalogue
// ─────────────────────────────────────────────────────────────
//
// stage_gate_rules.requirement_detail.document and
// stage_reference_docs.document_name hold the same names as INDEPENDENT
// FREE STRINGS, with nothing in the schema aligning them. That gap is
// recorded in DESIGN_PRINCIPLES.md and this assertion is what closes it.
//
// The match is on the rule's own from_stage, because a document gates the
// EXIT from the stage that produces it. A document catalogued against a
// different stage than the rule that names it would leave an operator
// looking for it on the wrong tab.
//
// No case folding and no trimming, deliberately: the point is that the
// strings are identical, and a comparison that tolerates a difference
// would tolerate exactly the drift this exists to catch.
test('INVARIANT 4: every document_status document exists in stage_reference_docs for the same record_type and from_stage', () => {
  const catalogue = new Set(refDocs.map(d => `${d.record_type}||${d.stage_name}||${d.document_name}`))
  const unmatched = rules
    .filter(r => r.requirement_type === 'document_status')
    .filter(r => !catalogue.has(`${r.record_type}||${r.from_stage}||${r.requirement_detail?.document}`))
    .map(r => ({ id: r.id, record_type: r.record_type, from_stage: r.from_stage,
                 document: r.requirement_detail?.document }))
  assert.deepEqual(unmatched, [],
    `document gates with no matching stage_reference_docs row for their own from_stage:\n${JSON.stringify(unmatched, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 5. Tracks, one direction only
// ─────────────────────────────────────────────────────────────
//
// ONE DIRECTIONAL ONLY, and the asymmetry is deliberate. A rule naming a
// track that does not exist can never be satisfied, because approvals.track
// is a foreign key to approval_tracks, so no approval could ever be
// recorded against it. That is a broken gate.
//
// The reverse is not a fault. approval_tracks is an admin-managed
// vocabulary, and a track referenced by no rule is simply not in use
// today: 'Senior' sits there deliberately after Round 9 Phase 5 removed
// its only rule, because the tier concept may return, and 'Finance' has
// never been referenced by anything. Asserting the reverse would turn an
// intentional business decision into a test failure.
test('INVARIANT 5: no gate rule names a track absent from approval_tracks', () => {
  const known = new Set(tracks.map(t => t.track_name))
  const unknown = rules
    .filter(r => r.requirement_type === 'approval_obtained')
    .filter(r => !known.has(r.requirement_detail?.track))
    .map(r => ({ id: r.id, record_type: r.record_type, from_stage: r.from_stage,
                 track: r.requirement_detail?.track }))
  assert.deepEqual(unknown, [],
    `gate rules naming a track absent from approval_tracks (no approval can ever satisfy these):\n${JSON.stringify(unknown, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 6. No duplicate configuration rows
// ─────────────────────────────────────────────────────────────
//
// Neither table carries a unique constraint, so a duplicate is legal at
// the database level, invisible in the UI, and doubles a requirement.
//
// This is the agreed SUBSTITUTE for a migration-ledger parity check.
// Round 9 Phase 2 found the local and remote ledgers disagreeing
// silently, which replayed two already-applied migrations; no damage
// followed only because both happened to guard their writes. A direct
// ledger assertion was costed and declined: PostgREST does not expose the
// supabase_migrations schema and no arbitrary-SQL RPC exists, so reaching
// it needs either a new public view or a CLI dependency and a third
// credential. This catches the DAMAGE that drift causes, whatever the
// cause, using only the credentials the suite already has. CLAUDE.md
// Architecture rule 7 addresses the cause.
test('INVARIANT 6: no duplicate rows in stage_gate_rules or stage_reference_docs', () => {
  const ruleSeen = new Map()
  for (const r of rules) {
    const k = `${r.record_type}|${r.variant}|${r.from_stage}|${r.to_stage}|${r.requirement_type}|${JSON.stringify(r.requirement_detail)}`
    ruleSeen.set(k, [...(ruleSeen.get(k) ?? []), r.id])
  }
  const dupRules = [...ruleSeen.entries()].filter(([, ids]) => ids.length > 1)
    .map(([k, ids]) => ({ key: k, count: ids.length, ids }))
  assert.deepEqual(dupRules, [],
    `duplicate stage_gate_rules rows (legal in the schema, invisible in the UI, doubles a requirement):\n${JSON.stringify(dupRules, null, 2)}`)

  const docSeen = new Map()
  for (const d of refDocs) {
    const k = `${d.record_type}|${d.stage_name}|${d.document_name}`
    docSeen.set(k, [...(docSeen.get(k) ?? []), d.id])
  }
  const dupDocs = [...docSeen.entries()].filter(([, ids]) => ids.length > 1)
    .map(([k, ids]) => ({ key: k, count: ids.length, ids }))
  assert.deepEqual(dupDocs, [],
    `duplicate stage_reference_docs rows:\n${JSON.stringify(dupDocs, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 7. Every forward transition is gated
// ─────────────────────────────────────────────────────────────
//
// The check that would have caught Round 9's adjacency hole as a
// CONFIGURATION GAP rather than as an accident. That hole was found only
// because a broken verification script skipped a stage and the skip
// succeeded: gate rules are keyed on the (from, to) pair, so a transition
// with no rules is not weakly gated, it is completely ungated, and
// nothing in the suite was looking at which pairs had rules at all.
//
// Scoped to test_bed, and to ADJACENT pairs only, which is now exactly
// the set the transition endpoint permits going forward (Round 9 Phase
// 4A.1). A non-adjacent pair is refused by the endpoint and does not need
// rules; an adjacent one is reachable by any operator and must have at
// least one.
//
// Deliberately asserts "at least one rule", not a specific count: what
// each transition requires is a business decision that will keep
// changing, and pinning it here would duplicate invariant 1 badly.
test('INVARIANT 7: every adjacent forward transition on test_bed carries at least one gate rule', () => {
  const ladder = stages
    .filter(s => s.record_type === 'test_bed' && s.variant === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(s => s.stage_name)

  const configured = new Set(tbRules().map(r => `${r.from_stage}||${r.to_stage}`))
  const ungated = []
  for (let i = 0; i < ladder.length - 1; i++) {
    const pair = `${ladder[i]}||${ladder[i + 1]}`
    if (!configured.has(pair)) ungated.push({ from_stage: ladder[i], to_stage: ladder[i + 1] })
  }
  assert.deepEqual(ungated, [],
    `adjacent test_bed transitions with no gate rules at all - an operator can walk straight through these:\n${JSON.stringify(ungated, null, 2)}`)
})
