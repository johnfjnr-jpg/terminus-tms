// ── R10: DOES ANY LIVE TEST BED NOW FAIL A CRITERION IT ALREADY PASSED? ──
//
// The R8 measurement said 0 of 8 live Test Beds past Qualification are missing
// an approver, which is why this configuration could land without a backfill.
// That was measured BEFORE the rows existed, so it is a prediction until it is
// re-taken after (Verification 17: run the instrument against the state you are
// making the claim about).
//
// What it asks, per record: of the approver-named rules at a stage this record
// has ALREADY LEFT or is standing on, how many does its payload not satisfy?
// A record past those stages with an empty field is one this configuration has
// retrospectively put in an impossible position, and the count is the claim.
//
// COUNTS ONLY. No reference codes, no names: this output is quoted into a
// report, and CURRENT_STATE.md's rule 4 is the estate's standing position on
// what a quoted measurement may carry.
//
// Read-only. Creates nothing, so there is nothing to tear down.
// UNWIRED. Run: node --env-file=.env scripts/stage-panels/recheck-dirty-data.mjs
import { admin, pagedSelect } from '../fixtures.mjs'
import { approverRuleRows } from '../lib/approver-gate-rows.mjs'
import { gateFieldIsPresent } from '../../src/lib/stage-gate-fields.js'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const stages = must(await db.from('stage_definitions').select('stage_name,sort_order')
  .eq('record_type', 'test_bed').order('sort_order', { ascending: true }), 'stages')
const order = stages.map((s) => s.stage_name)
const rules = must(await db.from('stage_gate_rules')
  .select('from_stage,to_stage,requirement_type,requirement_detail').eq('record_type', 'test_bed'), 'rules')
const wanted = approverRuleRows(rules, order)

const beds = must(await db.from('records').select('id,status')
  .eq('record_type', 'test_bed').is('deleted_at', null), 'beds')

let past = 0, affected = 0, atQualification = 0
const perStage = {}
for (const b of beds) {
  const idx = order.indexOf(b.status)
  if (idx <= 0) { if (idx === 0) atQualification++; continue }
  past++
  const payload = (must(await db.from('record_revisions').select('payload')
    .eq('record_id', b.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0] ?? {}).payload ?? {}
  // Rules at a stage this record has already left, or is standing on: those are
  // the ones it has passed or must pass now, and the only ones a NEW rule can
  // retrospectively make impossible.
  const behind = wanted.filter((w) => order.indexOf(w.from_stage) <= idx)
  const unmet = behind.filter((w) => !gateFieldIsPresent(payload[w.field]))
  if (unmet.length) {
    affected++
    perStage[b.status] = (perStage[b.status] ?? 0) + 1
  }
}

console.log(`live Test Beds: ${beds.length}; at Qualification: ${atQualification}; past Qualification: ${past}`)
console.log(`approver-named rules now configured: ${wanted.length}`)
console.log(`past Qualification with a newly-unsatisfied earlier-stage criterion: ${affected}`)
if (affected) console.log(`  by current stage: ${JSON.stringify(perStage)}`)

// A zero from an instrument never shown to reach one is not a measurement
// (Verification 13). The positive case is built here rather than looked for: the
// same predicate, run against a payload with the fields cleared, must count the
// rules that a record at the last stage would fail.
const last = order.length - 1
const wouldFail = wanted.filter((w) => order.indexOf(w.from_stage) <= last)
  .filter((w) => !gateFieldIsPresent(({})[w.field])).length
console.log(`calibration: the same predicate against an EMPTY payload at the last stage counts ${wouldFail}`)
if (wouldFail === 0) { console.error('the predicate cannot reach a non-zero, so the zero above means nothing'); process.exit(2) }
