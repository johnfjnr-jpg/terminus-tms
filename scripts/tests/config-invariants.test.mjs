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
let criteria, anchors, liveDocuments, livePayloads
let contactRoles, contactStances
let baseCosts

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

  // Round 35 Phase 2.
  const cr = await db.from('contact_roles').select('id, label, sort_order, active')
  assert.equal(cr.error, null, `contact_roles query failed: ${cr.error?.message}`)
  contactRoles = cr.data

  const cs = await db.from('contact_stances').select('id, label, axis, sort_order, active')
  assert.equal(cs.error, null, `contact_stances query failed: ${cs.error?.message}`)
  contactStances = cs.data

  // Round 11 Phase 7.
  const c = await db.from('scoring_criteria').select('id, record_type, criterion_key, name')
  assert.equal(c.error, null, `scoring_criteria query failed: ${c.error?.message}`)
  criteria = c.data

  const a = await db.from('scoring_anchors').select('criterion_id, version, score')
  assert.equal(a.error, null, `scoring_anchors query failed: ${a.error?.message}`)
  anchors = a.data

  // Every LIVE document, for invariant 10. Scoped to live deliberately:
  // soft-deleted documents predating the column are history, and rewriting
  // them would contradict the immutability decision for no gain.
  const dk = await db.from('records')
    .select('id, record_type, variant, document_kind, parent_record_id')
    .eq('record_type', 'document').is('deleted_at', null)
  assert.equal(dk.error, null, `document rows query failed: ${dk.error?.message}`)
  liveDocuments = dk.data

  // Every live record's current revision payload, for invariant 9. Read
  // once here rather than per test.
  const recs = await db.from('records').select('id, record_type').is('deleted_at', null)
  assert.equal(recs.error, null, `records query failed: ${recs.error?.message}`)
  const revs = await db.from('record_revisions')
    .select('record_id, revision_number, payload')
    .in('record_id', recs.data.map(r => r.id))
    .order('revision_number', { ascending: true })
  assert.equal(revs.error, null, `record_revisions query failed: ${revs.error?.message}`)
  const latest = {}
  for (const r of revs.data) latest[r.record_id] = r.payload
  livePayloads = Object.entries(latest).map(([record_id, payload]) => ({ record_id, payload }))

  // Round 36 Phase 1: Base Cost Data. numeric arrives from PostgREST as a
  // string, so coerce once here rather than in each assertion, where a
  // forgotten Number() would compare '8000' to 8000 and fail for a reason
  // that has nothing to do with the configuration.
  const bc = await db.from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost, install_cost_existing, install_cost_new, hosting_cost_month')
  assert.equal(bc.error, null, `base_cost_batches query failed: ${bc.error?.message}`)
  baseCosts = bc.data.map(r => ({
    ...r,
    unit_cost: Number(r.unit_cost),
    install_cost_existing: Number(r.install_cost_existing),
    install_cost_new: Number(r.install_cost_new),
    hosting_cost_month: Number(r.hosting_cost_month),
  }))
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
//   Round 11 Phase 4.1, 3 tick rules out, 5 score rules in    +2  -> 39
//   Round 11 Phase 4.2, 3 re-score rules                      +3  -> 42
//   Round 11 Phase 4.3, measurability confirmation            +1  -> 43
//   Round 11 Phase 5, Installer and Test Bed Tech Team        +2  -> 45
//
// UPDATED FROM THE MEASUREMENT EACH TIME, not from the projection, exactly
// as the paragraph above requires. The invariant fired on its own before
// this line was touched on both occasions - "Expected 38, found 37" after
// Phase 1, and "Expected 37, found 43" after Phase 4 - which is the
// assertion doing its job rather than an inconvenience: a deliberate
// configuration change is supposed to break it and be re-measured.
// Phase 7 re-derives 45 from the live table rather than carrying it forward
// on trust.
const EXPECTED_TEST_BED_RULES = 45

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


// ─────────────────────────────────────────────────────────────
// 8. Scoring criteria referenced by a gate rule exist, with anchors
// ─────────────────────────────────────────────────────────────
//
// Round 11 Phase 7. The same shape as invariant 4, which closed the gap where
// stage_gate_rules and stage_reference_docs held document names as
// independent free strings with nothing aligning them. Here it is
// stage_gate_rules.requirement_detail.field against
// scoring_criteria.criterion_key, and the failure mode is worse: a gate
// naming a criterion that does not exist blocks on a field nothing can ever
// write, so the transition is unsatisfiable from inside the product. That is
// the Round 7 Phase 3.2 shape, where a correctly configured gate had no
// operator path to satisfy it.
//
// ANCHORS ARE ASSERTED TOO, because a criterion with no anchors is scoreable
// in principle and refused in practice: POST /scores returns 409 rather than
// record a score against a definition that does not exist.
test('INVARIANT 8: every criterion named by a gate rule exists and carries anchors', () => {
  const byKey = Object.fromEntries(criteria.map(c => [`${c.record_type}||${c.criterion_key}`, c]))
  const anchoredIds = new Set(anchors.map(a => a.criterion_id))

  // ROUND 25 PHASE 1, RECORDED AND DELIBERATELY NOT FIXED HERE.
  //
  // This filter sees only payload_field_required rules naming a field. The
  // assessment_current rule type added in Round 24 names NO field: it resolves
  // the set of criteria required at a stage or earlier. So a criterion pulled
  // into a rollup can carry no anchors and this invariant will not say so; the
  // failure surfaces later as a 409 from the score endpoint, which refuses to
  // record against a criterion with no definition.
  //
  // Not fixed in Round 25 because that round ships zero assessment_current
  // rows, so the extension would be a branch nothing exercises, which is the
  // shape Architecture rule 8 warns about. It belongs with the round that
  // inserts the first rollup row.
  const scoreRules = rules.filter(r =>
    r.requirement_type === 'payload_field_required' &&
    String(r.requirement_detail?.field ?? '').startsWith('score'))

  const problems = []
  for (const r of scoreRules) {
    const key = `${r.record_type}||${r.requirement_detail.field}`
    const crit = byKey[key]
    if (!crit) {
      problems.push({ id: r.id, from_stage: r.from_stage, to_stage: r.to_stage,
        field: r.requirement_detail.field, problem: 'no scoring_criteria row' })
      continue
    }
    if (!anchoredIds.has(crit.id)) {
      problems.push({ id: r.id, from_stage: r.from_stage, to_stage: r.to_stage,
        field: r.requirement_detail.field, problem: 'criterion exists but has no anchors' })
    }
  }
  assert.deepEqual(problems, [],
    `gate rules naming a criterion that does not exist, or one with no anchors - both are gates nothing can satisfy:\n${JSON.stringify(problems, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 9. Stored scores reference an anchor version that exists and is complete
// ─────────────────────────────────────────────────────────────
//
// Round 11 Phase 7. AMENDED before it was written, because the obvious
// phrasing fails on legitimate data: anchors exist for scores 1, 3 and 5
// only, and 2 and 4 are deliberately "between these", so asserting that a
// row exists for the exact score would report every genuine 2 and 4 as an
// orphan.
//
// THE REFERENT IS THE VERSION, NOT THE ROW. Complete means the version
// carries the full set of anchors that criterion defines at any version, so a
// half-inserted version is caught rather than silently accepted as a
// definition a historical score can point at. An orphaned version means a
// recorded judgement has no definition, which is the one thing anchor
// versioning exists to prevent.
test('INVARIANT 9: every stored score references a complete anchor version', () => {
  const keys = new Set(criteria.map(c => c.criterion_key))
  const byId = Object.fromEntries(criteria.map(c => [c.id, c]))

  // What a complete set looks like per criterion: the scores that criterion
  // has anchors for at ANY version. Derived from the data, not assumed to be
  // {1,3,5}, so giving 2 or 4 real wording later needs no change here.
  const scoresByCriterion = {}
  const versionsByCriterion = {}
  for (const a of anchors) {
    (scoresByCriterion[a.criterion_id] ??= new Set()).add(a.score)
    ;((versionsByCriterion[a.criterion_id] ??= {})[a.version] ??= new Set()).add(a.score)
  }

  const problems = []
  for (const { record_id, payload } of livePayloads) {
    for (const [key, value] of Object.entries(payload ?? {})) {
      if (!keys.has(key) || !Array.isArray(value)) continue
      const crit = criteria.find(c => c.criterion_key === key)
      if (!crit) continue
      const expected = scoresByCriterion[crit.id] ?? new Set()
      for (const entry of value) {
        const v = entry?.anchorVersion
        const held = versionsByCriterion[crit.id]?.[v]
        if (!held) {
          problems.push({ record_id, criterion: key, anchorVersion: v ?? null, problem: 'version does not exist' })
          continue
        }
        const missing = [...expected].filter(sc => !held.has(sc))
        if (missing.length) {
          problems.push({ record_id, criterion: key, anchorVersion: v, problem: `version incomplete, missing anchors for ${missing.join(', ')}` })
        }
      }
    }
  }
  assert.deepEqual(problems, [],
    `stored scores pointing at an anchor version that does not exist or is incomplete - the judgement has no definition:\n${JSON.stringify(problems, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// 10. No live document carries a null document_kind
// ─────────────────────────────────────────────────────────────
//
// Round 11 Phase 7. The CHECK constraint added with the column is NOT VALID,
// so it exempts every row that existed before it and governs writes only from
// that moment on. THAT EXEMPTION IS A DATA PROPERTY AND THEREFORE ASSERTABLE,
// unlike the reader-side discipline it sits beside: nothing can assert that a
// future query remembers to filter on the kind, because that leaves no trace
// in the data.
//
// A document with a null kind appears in NEITHER the Terminus queries nor the
// Customer Documents query. It is invisible rather than wrong, which is the
// harder failure to notice: nothing renders incorrectly, a document simply
// stops existing as far as the product is concerned.
test('INVARIANT 10: no live document record has a null document_kind', () => {
  const orphans = liveDocuments
    .filter(d => d.document_kind === null || d.document_kind === undefined)
    .map(d => ({ id: d.id, variant: d.variant, parent_record_id: d.parent_record_id }))
  assert.deepEqual(orphans, [],
    `live documents with no document_kind - these appear in neither the Terminus queries nor the Customer Documents query:\n${JSON.stringify(orphans, null, 2)}`)
})

// ─────────────────────────────────────────────────────────────
// INVARIANTS 11 AND 12: the Key Customer Contacts vocabularies
// ─────────────────────────────────────────────────────────────
//
// Round 35 Phase 2. Both tables are configuration, seeded by migration and
// edited through Supabase's own editor, so nothing in the application would
// notice a row being retitled, retired or given the wrong axis. These are the
// assertions that would.
//
// INVARIANT 12 IS THE ONE THAT MATTERS. The axis column is not decoration: it
// says which stance values compete for a slot. Six values on "disposition" are
// mutually exclusive, and Pain Owner sits on its own axis because someone can
// own the problem AND block the fix, which is precisely what the live
// Organisational criterion "Political dynamics: who gains and who loses if
// this goes ahead" exists to record.
//
// Moving Pain Owner onto the disposition axis would leave every query, route
// and test still passing while quietly making that case unrecordable, because
// the constraint lives in the data rather than in code. That is the shape
// Architecture rule 8's fourth variant describes, arriving from the
// configuration side, and this is the assertion that refuses it.

test('INVARIANT 11: the contact vocabularies carry exactly their configured rows, all active', () => {
  const roles = contactRoles.map(r => r.label).sort()
  assert.deepEqual(roles, [
    'Commercial Buyer', 'Cyber Sec', 'DPO', 'Executive Sponsor', 'IT',
    'Legal', 'Procurement', 'QHSE', 'Technical Buyer',
  ], 'contact_roles has drifted from the nine configured in Round 35 Phase 2')

  const stances = contactStances.map(s => s.label).sort()
  assert.deepEqual(stances, [
    'Blocker', 'Champion', 'Neutral', 'Pain Owner', 'Sceptic', 'Supporter', 'Unknown',
  ], 'contact_stances has drifted from the seven configured in Round 35 Phase 2')

  // A retired row is legitimate configuration, so this is not "active must be
  // true" - it is that nothing has been retired WITHOUT a round saying so.
  const retired = [...contactRoles, ...contactStances].filter(x => x.active !== true).map(x => x.label)
  assert.deepEqual(retired, [],
    `rows retired with no round accounting for it: ${retired.join(', ')}`)

  // sort_order is what the picker orders by, so a duplicate is a picker whose
  // order depends on which row the database happens to return first.
  for (const [name, rows] of [['contact_roles', contactRoles], ['contact_stances', contactStances]]) {
    const orders = rows.map(r => r.sort_order)
    assert.equal(new Set(orders).size, orders.length, `${name} has duplicate sort_order values`)
  }
})

test('INVARIANT 12: Pain Owner is on its own axis, so a Pain Owner who is a Blocker stays recordable', () => {
  const axisOf = label => contactStances.find(s => s.label === label)?.axis

  // Present-first, so a renamed row fails as a missing label rather than as a
  // pair of undefineds comparing equal. Verification rule 14.
  for (const label of ['Champion', 'Supporter', 'Neutral', 'Sceptic', 'Blocker', 'Unknown', 'Pain Owner']) {
    assert.ok(axisOf(label), `stance "${label}" is missing, so every axis claim below is vacuous`)
  }

  const disposition = ['Champion', 'Supporter', 'Neutral', 'Sceptic', 'Blocker', 'Unknown']
  const shared = new Set(disposition.map(axisOf))
  assert.equal(shared.size, 1,
    'the six competing stances must share one axis, or the scale means nothing')

  assert.notEqual(axisOf('Pain Owner'), axisOf('Blocker'),
    'Pain Owner shares an axis with Blocker, which makes "owns the problem and blocks the fix" unrecordable and silently breaks Political dynamics')
  assert.notEqual(axisOf('Pain Owner'), axisOf('Champion'),
    'Pain Owner shares an axis with Champion, which makes the commonest good case unrecordable')

  // The negative half, as its own assertion rather than as an assumption: two
  // values that SHOULD compete must still land on one axis, otherwise this
  // test would pass just as well against a table where every row has a unique
  // axis and nothing competes with anything.
  assert.equal(axisOf('Supporter'), axisOf('Blocker'),
    'Supporter and Blocker must compete, or a contact could be recorded as both')
})

// ─────────────────────────────────────────────────────────────
// 13-14. Base Cost Data, Round 36 Phase 1
// ─────────────────────────────────────────────────────────────
//
// These twelve figures are the round. Everything Phase 2 puts on the
// Commercials tab is arithmetic on them, so a silent change here is a silent
// change to every deal's cost basis, and nothing else in the suite would
// notice: the calculator tests use their own literals, and the tab renders
// whatever it is given.
//
// Round 36 Phase 0 recorded the specific shape this defends against. A
// migration changed a scoring level's reason_required and left a message in
// score-entry.js describing the OLD configuration; no line of code changed, no
// test could fail, and git log -S on the string returned only the commit that
// wrote it. A catalog of numbers maintained by hand in the Supabase editor is
// the same exposure with a shorter fuse.
const CATALOG = {
  safesight:   { unit_cost: 8000,   install_cost_existing: 2000, install_cost_new: 20000, hosting_cost_month: 200 },
  air_quality: { unit_cost: 2000,   install_cost_existing: 500,  install_cost_new: 1000,  hosting_cost_month: 100 },
  hemir:       { unit_cost: 100000, install_cost_existing: 5000, install_cost_new: 10000, hosting_cost_month: 500 },
}

test('INVARIANT 13: the base cost catalog carries exactly the figures the business supplied', () => {
  // Present-first, so a renamed or missing product fails as a missing product
  // rather than as two undefineds comparing equal. Verification rule 14.
  for (const product of Object.keys(CATALOG)) {
    const rows = baseCosts.filter(b => b.product === product)
    assert.ok(rows.length > 0, `no batch exists for "${product}", so every figure asserted below is vacuous`)
  }

  // Compared against the CURRENT batch per product, not against every row.
  // A superseded batch legitimately holds different figures - that is what a
  // batch is - so asserting over the whole table would fail the first time the
  // business enters a new manufacturing run, and the natural fix would be to
  // delete the history this table exists to keep.
  const today = new Date().toISOString().slice(0, 10)
  for (const [product, expected] of Object.entries(CATALOG)) {
    const current = baseCosts
      .filter(b => b.product === product && b.effective_from <= today)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]

    assert.ok(current, `"${product}" has no batch effective on or before ${today}, so the Commercials tab would silently omit it`)
    assert.deepEqual({
      unit_cost: current.unit_cost,
      install_cost_existing: current.install_cost_existing,
      install_cost_new: current.install_cost_new,
      hosting_cost_month: current.hosting_cost_month,
    }, expected, `the current ${product} batch has drifted from the figures the business supplied in Round 36`)
  }
})

test('INVARIANT 14: one batch per product per date, so "current" has exactly one answer', () => {
  // The resolver in routes/base-costs.js takes the newest effective_from at or
  // before a date. Two batches sharing a product and a date make that ordering
  // arbitrary, and the route would pick by whichever row the database returned
  // first, which is not a decision anyone made.
  //
  // The rule is restated here rather than imported from the route DELIBERATELY.
  // A test that reuses the implementation's own derivation passes by
  // construction and stops asking anything, which is the Round 30 failure:
  // a rule whose answer has become constant is indistinguishable from a rule
  // that is working.
  const seen = new Map()
  for (const b of baseCosts) {
    const key = `${b.product}@${b.effective_from}`
    assert.ok(!seen.has(key),
      `two batches share product "${b.product}" and effective_from ${b.effective_from}, so which one is current is undefined`)
    seen.set(key, b.id)
  }

  // The negative half, as its own assertion. Without it this test would pass
  // just as well against an EMPTY table, which is the exact shape Verification
  // rule 13 names: a count of zero from an instrument never shown reaching one.
  assert.ok(baseCosts.length >= Object.keys(CATALOG).length,
    `base_cost_batches holds ${baseCosts.length} rows, fewer than the ${Object.keys(CATALOG).length} products the catalog defines`)

  // Every row names a product the CHECK constraint allows. Asserted rather than
  // assumed: the constraint and this list are two places holding the same three
  // strings, and a migration that widens one without the other is exactly how
  // the tab would gain a product nothing renders.
  for (const b of baseCosts) {
    assert.ok(CATALOG[b.product],
      `base_cost_batches holds product "${b.product}", which this suite and the Commercials tab know nothing about`)
  }
})

// ─────────────────────────────────────────────────────────────
// The Commercial gate on an Opportunity is version-scoped
// ─────────────────────────────────────────────────────────────
//
// Round 38, CLAUDE.md Verification 23. Round 20 wrote Opportunity's approval
// rules stage-scoped, following a convention established for Test Beds, and a
// stage-scoped Commercial approval survives every revision: the owner drops
// margin, extends terms and adds discounted units, and the gate stays green.
//
// THIS ALSO CATCHES A REPLAY. 20260822000003 inserts those rules guarded on
// requirement_detail = {"scope":"stage","track":...}. Once 20260829000005 has
// changed them that guard no longer matches, so replaying it would insert a
// SECOND, stage-scoped Commercial rule beside the version-scoped one - two rules
// answering the same question opposite ways. The ledger has been observed
// drifting from the schema, so this is the thing that notices.

test('no Opportunity Commercial approval rule is stage-scoped', async () => {
  const { data, error } = await db
    .from('stage_gate_rules')
    .select('from_stage, to_stage, requirement_detail')
    .eq('record_type', 'opportunity')
    .eq('requirement_type', 'approval_obtained')
  assert.equal(error, null, error?.message)

  const commercial = data.filter((r) => r.requirement_detail?.track === 'Commercial')
  assert.ok(commercial.length > 0, 'no Commercial rules found at all, so this scan measures nothing')

  const wrong = commercial
    .filter((r) => r.requirement_detail?.scope !== 'version')
    .map((r) => `${r.from_stage} -> ${r.to_stage}: ${JSON.stringify(r.requirement_detail)}`)
  assert.deepEqual(wrong, [],
    'these Commercial rules survive a re-price, so a green gate can describe a price nobody saw:\n  '
    + wrong.join('\n  '))
})

test('and every Commercial rule is version-scoped exactly once per transition', async () => {
  // The replay would produce a duplicate rather than a wrong scope, so counting
  // is the half that catches it.
  const { data } = await db
    .from('stage_gate_rules')
    .select('from_stage, to_stage, requirement_detail')
    .eq('record_type', 'opportunity')
    .eq('requirement_type', 'approval_obtained')
  const commercial = data.filter((r) => r.requirement_detail?.track === 'Commercial')
  const perTransition = {}
  for (const r of commercial) {
    const k = `${r.from_stage} -> ${r.to_stage}`
    perTransition[k] = (perTransition[k] ?? 0) + 1
  }
  const duplicated = Object.entries(perTransition).filter(([, n]) => n > 1)
  assert.deepEqual(duplicated, [],
    'a transition carries more than one Commercial rule, which is a replay of 20260822000003')
})

test('Technical and Legal remain stage-scoped, deliberately', async () => {
  // Recorded honestly in DESIGN_PRINCIPLES.md: stage scope is wrong for them
  // too, just less dangerously. This pins the CURRENT state so that changing it
  // is a visible decision rather than a drift, exactly as ownership.test.mjs
  // pins the write boundary it disagrees with.
  const { data } = await db
    .from('stage_gate_rules')
    .select('requirement_detail')
    .eq('record_type', 'opportunity')
    .eq('requirement_type', 'approval_obtained')
  for (const track of ['Technical', 'Legal']) {
    const rows = data.filter((r) => r.requirement_detail?.track === track)
    assert.ok(rows.length > 0, `no ${track} rules found`)
    assert.ok(rows.every((r) => r.requirement_detail?.scope === 'stage'),
      `${track} is no longer stage-scoped; if that is intended, this test is the decision point`)
  }
})
