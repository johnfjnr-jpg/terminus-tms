// ── W5: CAN A SOLO USER'S OWN WRITES FIRE THE STALE MESSAGE? ─────────────
//
// The investigation is a READ of the code path; this probe exists to turn the
// SERVER half of the reading into evidence rather than an assertion. It asks
// one question: are two record PATCHes carrying the SAME expected_revision
// enough to produce the 409 the client words as "changed in another session",
// with one account and no second session anywhere?
//
// It does NOT claim to reproduce John's sighting. W5 did not reproduce on his
// own deliberate retry, and a probe that constructs the condition says the
// condition is REACHABLE, which is a different and weaker claim than saying it
// is what happened.
//
// Read-only except its own tagged fixture, which it tears down.
// UNWIRED. Run: node --env-file=.env scripts/stage-panels/probe-w5.mjs
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data }))
  .catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const TAG = `TBSP-W5-${Date.now()}`
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }

let fx
try {
  fx = await freshTestBed(TAG)
  const held = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  console.log(`fixture ${TAG}; the screen would hold revision ${held}`)

  // Two writes, both carrying the revision the screen held when it loaded.
  // This is what the host does when a second write is issued before the first
  // one's reload has landed: `writePayload` closes over
  // `record.latest_revision_number`, and that only changes when `load()`
  // resolves and React re-renders.
  const first = await call('PATCH', `/test-beds/${fx.bedId}`, {
    payload: { testBedDuration: '12' }, expected_revision: held })
  const second = await call('PATCH', `/test-beds/${fx.bedId}`, {
    payload: { estGoLiveDate: '2027-01-01' }, expected_revision: held })

  console.log(`  first  ${first.status} ${JSON.stringify(first.data?.error ?? 'ok')}`)
  console.log(`  second ${second.status} ${JSON.stringify(second.data?.error ?? 'ok')}`)

  check(first.status < 300, 'the first write, carrying the held revision, is accepted', String(first.status))
  check(second.status === 409, 'the SECOND write, carrying the SAME held revision, is refused 409',
    `${second.status}: ${second.data?.error ?? ''}`)
  check(second.data?.stale === true, 'and it is flagged stale, which is what the client words as the message',
    JSON.stringify({ stale: second.data?.stale }))

  // The recovery the host already performs on a 409: re-read, then retry.
  const fresh = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  const retry = await call('PATCH', `/test-beds/${fx.bedId}`, {
    payload: { estGoLiveDate: '2027-01-01' }, expected_revision: fresh })
  check(fresh > held && retry.status < 300,
    're-reading the record and retrying the same write succeeds, so reloading does resolve it',
    `held ${held}, fresh ${fresh}, retry ${retry.status}`)

  // And the write that was refused stored NOTHING, so the message is about a
  // lost write rather than a cosmetic warning (Verification 40: a status is not
  // a write, read in the other direction).
  const payload = (must(await db.from('record_revisions').select('revision_number,payload')
    .eq('record_id', fx.bedId).order('revision_number', { ascending: false }).limit(1), 'payload')[0] ?? {})
  check(String(payload.payload?.testBedDuration ?? '') === '12',
    'the first write is in the record, so the refusal cost the second write only',
    JSON.stringify({ revision: payload.revision_number, testBedDuration: payload.payload?.testBedDuration }))
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
