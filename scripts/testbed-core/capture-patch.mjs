// ── ROUND A RULING R12: THE TEST BED PATCH RESPONSES, CAPTURED FROM THE ROUTE ──
//
// The R12 unit tests drive a host save (the use-case list's whole-list PATCH)
// and must not answer it with a hand-shaped body (the brief's exit gate, point
// 3). So the answers come from PATCH /api/test-beds/:id itself: one accepted
// use-case write, and one real refusal (a payload that is not an object, which
// the route refuses 400 before any write).
//
// UNWIRED: it writes a fixture file, it is not a check. Re-run it when the
// route's answer changes.
//
// Run: node --env-file=.env scripts/testbed-core/capture-patch.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const OUT = `${ROOT}/frontend-react/src/__tests__/fixtures/testbed-patch-live.json`
const TAG = `TBCORE-P5CAP-${Date.now()}`

try {
  const fx = await freshTestBed(TAG)
  const rev = (await api('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  const accepted = await api('PATCH', `/test-beds/${fx.bedId}`, { payload: { useCases: ['a use case'] }, expected_revision: rev })
  // scripts/api-client.mjs THROWS on a non-2xx, carrying the route's status and body.
  const refused = await api('PATCH', `/test-beds/${fx.bedId}`, { payload: 'not an object', expected_revision: rev + 1 })
    .catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
  if (accepted.status !== 200 && accepted.status !== 201) throw new Error(`the accepted write was not accepted: ${accepted.status} ${JSON.stringify(accepted.data)}`)
  if (refused.status !== 400) throw new Error(`the refusal was not a 400: ${refused.status} ${JSON.stringify(refused.data)}`)
  writeFileSync(OUT, JSON.stringify({
    source: 'PATCH /api/test-beds/:id, captured by scripts/testbed-core/capture-patch.mjs',
    capturedAt: new Date().toISOString(),
    accepted: { status: accepted.status, body: accepted.data },
    refused: { status: refused.status, body: refused.data },
  }, null, 2) + '\n')
  console.log(`accepted ${accepted.status} keys=${Object.keys(accepted.data ?? {}).join(',')}; refused ${refused.status} ${JSON.stringify(refused.data)}`)
  console.log(`wrote ${OUT}`)
} finally {
  const r = await tearDown(TAG)
  console.log('teardown', JSON.stringify(r.removed.map((x) => x.record_type)), 'remaining', r.remaining)
}
