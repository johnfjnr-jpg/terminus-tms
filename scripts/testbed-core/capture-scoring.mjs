// ── ROUND A PHASE 2: THE SCORING RESPONSES, CAPTURED FROM THE ROUTES ─────
//
// The stage panel's scoring tests are driven only by what this writes. The
// scoring card's previous fixture was a hand-shaped `{ criterion_key: 'k1' }`,
// and the host fed the card from a state nothing ever set (audit B2), so a
// green suite said nothing about the screen.
//
// Captured, in the order the system produces them, against a tagged fixture
// Test Bed at Qualification:
//   criteria         GET /scoring-criteria?record_type=test_bed
//   exitQualification / exitSiteAssessment
//                    GET /records/:id/exit-criteria, for measurability visibility
//   refusals         real 400 bodies from POST /scores: a revision with no
//                    reason, and a level whose reason is required, sent empty
//   accepted         real 201 bodies: a first score, a revision with a reason,
//                    and a measurability confirmation
//   record           GET /test-beds/:id after all of it, so the payload series
//                    are the server's own entries
//
// UNWIRED: it writes a fixture file. Re-run when the scoring configuration
// changes. Run: node --env-file=.env scripts/testbed-core/capture-scoring.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const OUT = `${ROOT}/frontend-react/src/__tests__/fixtures/scoring-live.json`
const TAG = `TBCORE-P2CAP-${Date.now()}`
const why = 'captured as a real refusal body for the partial-failure tests'

const out = { source: 'scripts/testbed-core/capture-scoring.mjs', capturedAt: new Date().toISOString() }
try {
  const fx = await freshTestBed(TAG)
  const id = fx.bedId
  out.criteria = (await api('GET', '/scoring-criteria?record_type=test_bed')).data
  out.stageDefinitions = (await api('GET', '/stage-definitions?record_type=test_bed')).data
  out.exitQualification = (await api('GET', `/records/${id}/exit-criteria?stage=Qualification`)).data
  out.exitSiteAssessment = (await api('GET', `/records/${id}/exit-criteria?stage=Site%20Assessment`)).data

  out.accepted = {}
  out.refusals = {}
  const first = await api('POST', `/test-beds/${id}/scores`, { criterion: 'scoreRolloutPath', score: 3 })
  out.accepted.firstScore = { status: first.status, body: first.data }
  const revNoReason = await api('POST', `/test-beds/${id}/scores`, { criterion: 'scoreRolloutPath', score: 4 },
    { expect: 400, because: why })
  out.refusals.revisionWithoutReason = { status: revNoReason.status, body: revNoReason.data }
  const rev = await api('POST', `/test-beds/${id}/scores`, { criterion: 'scoreRolloutPath', score: 4, reason: 'The rollout owner confirmed a second site.' })
  out.accepted.revisionWithReason = { status: rev.status, body: rev.data }
  const lowNoReason = await api('POST', `/test-beds/${id}/scores`, { criterion: 'scoreClientCommitment', score: 1 },
    { expect: 400, because: why })
  out.refusals.requiredLevelWithoutReason = { status: lowNoReason.status, body: lowNoReason.data }
  const commit = await api('POST', `/test-beds/${id}/scores`, { criterion: 'scoreClientCommitment', score: 2, reason: 'No sponsor named yet.' })
  out.accepted.requiredLevelWithReason = { status: commit.status, body: commit.data }
  const meas = await api('POST', `/test-beds/${id}/measurability`, { confirmed: true })
  out.accepted.measurability = { status: meas.status, body: meas.data }

  const rec = (await api('GET', `/test-beds/${id}`)).data
  const keep = ['measurabilityConfirmed', ...out.criteria.map((c) => c.criterion_key)]
  out.record = { status: rec.status, latest_revision_number: rec.latest_revision_number,
    payload: Object.fromEntries(Object.entries(rec.payload ?? {}).filter(([k]) => keep.includes(k))) }

  console.log(`criteria ${out.criteria.length}: ${out.criteria.map((c) => `${c.criterion_key}[${(c.stages ?? []).map((s) => s.stage).join('|')}] v${c.current_version}`).join('  ')}`)
  console.log(`accepted: ${Object.entries(out.accepted).map(([k, v]) => `${k}=${v.status}`).join(' ')}`)
  console.log(`refusals: ${Object.entries(out.refusals).map(([k, v]) => `${k}=${v.status} "${v.body?.error}"`).join(' | ')}`)
  console.log(`record payload series: ${Object.entries(out.record.payload).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : typeof v}`).join(' ')}`)
  mkdirSync(`${ROOT}/frontend-react/src/__tests__/fixtures`, { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote ${OUT}`)
} finally {
  const r = await tearDown(TAG)
  console.log('teardown', r.removed.map((x) => x.record_type).join(','), 'remaining', r.remaining)
}
