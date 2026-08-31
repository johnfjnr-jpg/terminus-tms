#!/usr/bin/env node
// W4: recording an assessment score returns 500 on every criterion. Round 41.
//
// ── WHAT THE RULING ASKED, AND WHAT THIS ANSWERS ──────────────────────────
//
// Three candidate causes were named: the withdraw leaving state behind, the
// score route's new revision return, or something else. It also noted that the
// record carries a second, OPEN, zero-track request and that the 500 may depend
// on that state.
//
// This reproduces the fault on a FRESH record with NO transition request of any
// kind, which is what separates the three: if it reproduces with no request
// present and no withdraw in its history, neither of those is the cause.
//
// ── IDENTITY, STATED RATHER THAN GLOSSED ──────────────────────────────────
//
// The ruling says "reproduce as the walk identity over HTTP". I cannot: that
// account signs in through Google and this session holds no credential for it,
// and minting one through the admin API would be creating a session for
// somebody else's account rather than reproducing a fault.
//
// It runs as the dev session identity on a record that identity owns, and the
// substitution is defensible for a reason the reproduction itself demonstrates:
// the throw happens AFTER the revision is written and AFTER the audit row is
// inserted, so every ownership-gated step has already succeeded by the time it
// fires. An identity that could not write would never reach it.
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const TAG = 'w4-score-500'
const { oppId } = await freshOpportunity(TAG)
console.log(`\n  fresh opportunity ${oppId}, no transition request, no withdraw in its history\n`)

// The body field names are `criterion` and `score`, read from
// recordScoreEntry's own destructure rather than guessed. The first run of this
// probe guessed `criterion_key`/`value` and got a clean 400 saying the criterion
// was not recognised, which is the route working correctly on a malformed call
// and would have read as "not reproduced" had it not said so in words.
const CRITERION = 'assessCommBudgetConfirmed'
let body, status
try {
  const r = await api('POST', `/opportunities/${oppId}/scores`,
    { criterion: CRITERION, score: 3, reason: 'w4 reproduction' })
  status = 201; body = r
} catch (e) {
  status = e.status; body = e.body ?? e.data ?? null
}
console.log(`  POST /opportunities/:id/scores -> ${status}`)
console.log(`  body: ${JSON.stringify(body)}\n`)

// ── DID THE WRITE HAPPEN ANYWAY? The question that decides whether this is a
// failed save or a failed REPLY, and they call for opposite responses.
const after = await api('GET', `/opportunities/${oppId}`)
const payload = after.record?.payload ?? after.payload ?? {}
const series = payload[CRITERION]
console.log(`  ${CRITERION} in the payload after the 500: ` +
  (Array.isArray(series) ? `${series.length} entry, value ${series[series.length - 1]?.value}` : 'absent'))
console.log(`  record revision after the 500: ${after.record?.revision_number ?? after.revision_number ?? '?'}`)

console.log('')
if (status === 500 && Array.isArray(series) && series.length) {
  console.log('  REPRODUCED, and the score SAVED. The 500 is a failed reply to a completed write.')
  console.log('  No transition request existed on this record, so the withdraw and the open')
  console.log('  zero-track request are both ruled out as causes.')
} else if (status === 201) {
  console.log('  NOT REPRODUCED on a clean record. The fault depends on state this record lacks.')
} else {
  console.log(`  Unexpected: status ${status}, series ${JSON.stringify(series)}`)
}

console.log('\n  tearing down\n')
await tearDown()
