// ── TEST BED UNITS PHASE 1: THE UNITS RESPONSES, CAPTURED FROM THE ROUTES ──
//
// The derive guard tests are driven ONLY by what this writes (Verification 47
// and its Round A extension: the capture is a committed script named in the
// fixture's source field). A tagged fixture bed gets counts through the record
// PATCH, then the bed, its empty units list, the derive answer and the units
// list after are taken from the routes themselves.
//
// UNWIRED: it writes a fixture file, it is not a check.
// Run: node --env-file=.env scripts/testbed-units/capture-units.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const OUT = `${ROOT}/frontend-react/src/__tests__/fixtures/units-live.json`
const TAG = `TBUNITS-CAP-${Date.now()}`
try {
  const fx = await freshTestBed(TAG)
  const rev = (await api('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  const counts = await api('PATCH', `/test-beds/${fx.bedId}`, { payload: { safesightCameras: 2, airQualitySensors: 1, hemirSensors: 0 }, expected_revision: rev })
  const bedWithCounts = (await api('GET', `/test-beds/${fx.bedId}`)).data
  const unitsBefore = (await api('GET', `/test-beds/${fx.bedId}/units`)).data
  const derive = await api('POST', `/test-beds/${fx.bedId}/units/derive`, {})
  const unitsAfter = (await api('GET', `/test-beds/${fx.bedId}/units`)).data
  if (!Array.isArray(unitsBefore) || unitsBefore.length !== 0) throw new Error(`expected no units before derive, got ${JSON.stringify(unitsBefore)}`)
  if (derive.data?.created !== 3) throw new Error(`expected derive to create 3, got ${JSON.stringify(derive.data)}`)
  writeFileSync(OUT, JSON.stringify({
    source: 'GET/PATCH /api/test-beds/:id, GET /api/test-beds/:id/units, POST /api/test-beds/:id/units/derive, captured by scripts/testbed-units/capture-units.mjs',
    capturedAt: new Date().toISOString(),
    countsPatchStatus: counts.status, bedWithCounts, unitsBefore,
    derive: { status: derive.status, body: derive.data }, unitsAfter,
  }, null, 2) + '\n')
  console.log(`counts ${counts.status}; units before ${unitsBefore.length}; derive ${derive.status} created ${derive.data.created}; units after ${unitsAfter.length}`)
  console.log(`wrote ${OUT}`)
} finally {
  const t = await tearDown(TAG)
  console.log('teardown', JSON.stringify(t.removed.map((x) => x.record_type)), 'remaining', t.remaining)
}
