#!/usr/bin/env node
// ── THE SUB-KEY CENSUS ───────────────────────────────────────────────────
//
// Does the engine read any NESTED payload sub-key that no writer supplies?
//
// ── WHY IT EXISTS, AND WHY THE CENSUS ABOVE IT COULD NOT SEE THIS ────────
//
// The golden deals round's Phase 0 censused every payload KEY the engine reads
// against every key `readDealPayload` writes. It came back clean of orphans,
// and it was blind to the finding, because `contractorMilestones` IS written
// and IS read: what is never written is the `usd` INSIDE each row.
//
// Verification 33 exactly, a measure with a shape: a key-level census cannot
// see a dead sub-key however carefully it is computed. So this is the
// instrument aimed one level down, and it is the one that fires.
//
// ── IT IS A PROXY CENSUS, NOT A GREP ─────────────────────────────────────
//
// The engine says what it asked for. A `get` trap on each nested row records
// every sub-key read, across every structure and installation shape, so a
// sub-key read on one branch only is still seen. Nothing here depends on
// matching a name in source, which is the fault Verification 39 is about.
//
// ── CALIBRATED IN BOTH DIRECTIONS, BY CONSTRUCTION ───────────────────────
//
// `milestones` and `factoring` are censused in the same run and come back
// clean, which is the silent-on-healthy half taken on real neighbours rather
// than on a synthetic case. The failing half is the live instance below. If
// `contractorMilestones` is ever brought into line, INJECT by adding a
// sub-key read to one of the other two and confirm this still fires.
//
// ── WIRED TO THE GATE AS A PERMANENT STAGE. A2, John 2026-09-28 ──────────
//
// The paragraph this replaces said it was deliberately unwired pending the
// ruling, because the two possible rulings wanted different things from it: a
// fix makes it a permanent green guard, and a ruling that the schedule was
// never meant to price would have needed a declared exemption for that
// sub-key - which before the ruling would have been an exemption for a defect.
//
// JOHN RULED THE FIX. So `contractorMilestones.usd` is now read nowhere and
// written nowhere, the census passes, and it is a stage in
// `scripts/verify-all.mjs` named "payload sub-key census". The route's 400 on
// an arriving `usd` stays, so the write side is closed independently of this.
//
// IT WAS BORN RED, which is what makes its green worth reading. Verification
// 9's clause about a detector nothing schedules is the reason it is a stage
// rather than a script somebody remembers to run.
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { GOLDEN_CATALOG } from './deals.mjs'

/**
 * What the surface actually writes into each nested object.
 *
 * READ OFF THE WRITERS, not assumed: `readMilestones` and
 * `readContractorMilestones` (payload.ts:255-275) both push
 * `{ month, label, pct, incomplete }`, and `readDealPayload` builds
 * `factoring` as `{ enabled, ratePct, termMonths, method }` (payload.ts:378).
 *
 * AND `usd` IS NOT MERELY ABSENT, IT IS REFUSED. `PATCH /opportunities/:id`
 * answers 400 for any milestone row carrying one, naming the reason
 * (opportunities.js:748), so no caller can supply it either.
 */
const WRITTEN = {
  milestones: ['month', 'label', 'pct', 'incomplete'],
  contractorMilestones: ['month', 'label', 'pct', 'incomplete'],
  factoring: ['enabled', 'ratePct', 'termMonths', 'method'],
}

/** Array indices and intrinsics are not sub-keys of a row. */
const NOISE = /^\d+$|^(length|constructor)$/

const reads = Object.fromEntries(Object.keys(WRITTEN).map((k) => [k, new Set()]))
const spy = (bucket, obj) => new Proxy(obj, {
  get(t, k) { if (typeof k === 'string') reads[bucket].add(k); return t[k] },
  has(t, k) { if (typeof k === 'string') reads[bucket].add(k); return k in t },
})

// Every shape a nested row can be read on. Hybrid reads customer milestones,
// Lump Sum reads contractor milestones, and factoring is on throughout.
const SHAPES = [
  ['twoPhase', 'Terminus Contractor - Lump Sum'],
  ['twoPhase', 'Terminus Contractor - Per Unit'],
  ['hybrid', 'Terminus Contractor - Lump Sum'],
  ['hybrid', 'Terminus Contractor - Per Unit'],
  ['single', 'Terminus Contractor - Lump Sum'],
]

for (const [structure, installResp] of SHAPES) {
  const payload = {
    paymentMode: 'capex', structure, installResp,
    ssExisting: 22, ssNew: 14, aqm: 7, hemir: 3,
    duration: 60, recoveryMonths: 18, targetMargin: 30, warrantyPct: 4,
    lumpSumCost: 214000, invoicing: 'annual',
    milestones: [
      { month: 2, label: 'Contract start', pct: 60, incomplete: false },
      { month: 7, label: 'Go live', pct: 40, incomplete: false },
    ],
    contractorMilestones: [
      { month: 1, label: 'Contract start', pct: 60, incomplete: false },
      { month: 5, label: 'Go live', pct: 40, incomplete: false },
    ],
    factoring: { enabled: true, ratePct: 1.4, termMonths: 24, method: 'declining' },
  }
  payload.milestones = payload.milestones.map((r) => spy('milestones', r))
  payload.contractorMilestones = payload.contractorMilestones.map((r) => spy('contractorMilestones', r))
  payload.factoring = spy('factoring', payload.factoring)

  const { rates } = resolveRates(payload, GOLDEN_CATALOG)
  calculateDeal(buildDealInputs(payload, { testBedCost: 0, rates }))
}

let orphans = 0
let silent = 0
for (const bucket of Object.keys(WRITTEN)) {
  const read = [...reads[bucket]].filter((k) => !NOISE.test(k)).sort()
  const missing = read.filter((k) => !WRITTEN[bucket].includes(k))
  console.log(bucket)
  console.log(`  the surface writes  ${WRITTEN[bucket].join(', ')}`)
  console.log(`  the engine reads    ${read.join(', ') || '(nothing)'}`)
  // A bucket the engine never touched cannot discriminate, and a census that
  // counted it as clean would be Verification 14's check with nothing on
  // either side. It is reported as UNMEASURED rather than as a pass.
  if (read.length === 0) { silent += 1; console.log('  UNMEASURED: no shape in this run reads this object at all') }
  if (missing.length) { orphans += missing.length; console.log(`  READ AND NEVER WRITTEN: ${missing.join(', ')}`) }
  console.log()
}

if (silent) {
  console.log(`STOPPED: ${silent} object(s) unmeasured, so this run proves nothing about them.`)
  process.exit(2)
}
if (orphans) {
  console.log(`FAIL: ${orphans} sub-key(s) the engine reads and no writer supplies.`)
  process.exit(1)
}
console.log('PASS: every sub-key the engine reads is one the surface writes.')
