// ── ROUND A PHASE 1: THE EXIT-CRITERIA RESPONSES, CAPTURED FROM THE ROUTE ──
//
// The component tests for the exit-criteria panel are driven ONLY by what
// this script writes. The brief forbids a hand-shaped array here, and
// Verification 47 says why: the panel read `[]` for months because its test
// fixture was shaped to the reader rather than the server. So the responses
// are taken from GET /api/records/:id/exit-criteria itself, once, and stored
// in one shared file.
//
// THE STATES ARE BUILT THE WAY THE SYSTEM BUILDS THEM. A fixture Test Bed is
// created through the API, and the met rows come from ordinary PATCHes through
// the record route: three Qualification data-entry fields, and one real tick
// key (`exitMonAllMeetingActionsCompleted`, a member of the server's
// TB_EXIT_CRITERION_KEYS). The route's own `?stage=` is used to read stages
// other than the record's current one, which is the same call the panel makes.
//
// UNWIRED: it writes a fixture file, it is not a check. Re-run it when the gate
// rules change, and the tests then measure the new configuration.
//
// Run: node --env-file=.env scripts/testbed-core/capture-exit-criteria.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const OUT_DIR = `${ROOT}/frontend-react/src/__tests__/fixtures`
const OUT = `${OUT_DIR}/exit-criteria-live.json`
const TAG = `TBCORE-P1CAP-${Date.now()}`

const read = async (bedId, stage) =>
  (await api('GET', `/records/${bedId}/exit-criteria?stage=${encodeURIComponent(stage)}`)).data
const revisionOf = async (bedId) => (await api('GET', `/test-beds/${bedId}`)).data.latest_revision_number
const patch = async (bedId, payload) => {
  const r = await api('PATCH', `/test-beds/${bedId}`, { payload, expected_revision: await revisionOf(bedId) })
  return r.status
}

const cases = {}
try {
  const fx = await freshTestBed(TAG)
  console.log(`fixture ${TAG}: bed ${fx.bedId}`)

  cases.qualificationFresh = await read(fx.bedId, 'Qualification')
  cases.monitoringUnticked = await read(fx.bedId, 'Monitoring and Analysis')
  cases.installation = await read(fx.bedId, 'Installation and Commissioning')
  cases.finalStage = await read(fx.bedId, 'Closed')

  console.log('PATCH three Qualification data-entry fields:',
    await patch(fx.bedId, { testBedDuration: 6, estimatedInstallationDate: '2027-01-15', estGoLiveDate: '2027-03-01' }))
  console.log('PATCH the tick key to a timestamp:',
    await patch(fx.bedId, { exitMonAllMeetingActionsCompleted: new Date().toISOString() }))
  cases.qualificationDataEntryMet = await read(fx.bedId, 'Qualification')
  // A MET COMPUTED ROW. None of the states above has one on screen (the met
  // data-entry rows are hidden by the split), so a test of computed-row met-ness
  // would pass by absence. A score recorded through the score route itself is
  // a process requirement (min_length), so it stays visible, read-only, and met.
  console.log('POST a score for scoreRolloutPath:',
    (await api('POST', `/test-beds/${fx.bedId}/scores`, { criterion: 'scoreRolloutPath', score: 4 })).status)
  cases.qualificationScored = await read(fx.bedId, 'Qualification')
  cases.monitoringTicked = await read(fx.bedId, 'Monitoring and Analysis')

  for (const [k, v] of Object.entries(cases)) {
    const reqs = v.requirements ?? []
    console.log(`  ${k.padEnd(26)} from=${v.from_stage} to=${v.to_stage} requirements=${reqs.length} met=${reqs.filter((r) => r.met).length} blocking=${v.blocking?.length}`)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT, JSON.stringify({
    source: 'GET /api/records/:id/exit-criteria, captured by scripts/testbed-core/capture-exit-criteria.mjs',
    capturedAt: new Date().toISOString(),
    cases,
  }, null, 2) + '\n')
  console.log(`wrote ${OUT}`)
} finally {
  const r = await tearDown(TAG)
  console.log('teardown', JSON.stringify(r.removed.map((x) => x.record_type)), 'remaining', r.remaining)
}
