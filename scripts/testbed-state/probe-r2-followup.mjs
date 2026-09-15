// ── R2: THE FOLLOW-UP TASK ON A TEST BED ─────────────────────────────────
//
// Run BEFORE the change to establish the refusal, and AFTER to establish the
// write. A pass/fail flips with the fix, which is what makes either reading
// evidence rather than an assertion (Verification 9).
//
// It asserts the REASON, not the status: a 400 for some other reason would
// satisfy "the write was refused" while proving nothing about the allowlist
// (Verification 14's wrong-reason clause).
import { api } from '../api-client.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

admin()
const TAG = 'tbst2'
const MODE = process.argv[2] ?? 'before'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}, mode=${MODE}\n`)

try {
  const body = {
    payload: { followUpDate: '2027-04-01', followUpDescription: 'Chase the site survey' },
    expected_revision: tb.revision,
  }
  // The client refuses a bare non-2xx unless the call says, in words, why it
  // expects one - which is exactly the discipline this probe wants in `before`.
  const r = MODE === 'before'
    ? await api('PATCH', `/test-beds/${tb.bedId}`, body,
        { expect: 400, because: 'followUpDate is not yet in TEST_BED_WRITABLE_KEYS' })
    : await api('PATCH', `/test-beds/${tb.bedId}`, body)
  console.log(`  PATCH -> ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`)

  if (MODE === 'before') {
    check(r.status === 400, `the write is refused today (${r.status})`)
    const named = r.data?.disallowed ?? []
    check(named.includes('followUpDate') && named.includes('followUpDescription'),
      `refused for the ALLOWLIST reason, naming both keys (${JSON.stringify(named)})`)
  } else {
    check(r.ok, `the write is accepted (${r.status} ${JSON.stringify(r.data?.error ?? '')})`)
    // A 2xx IS NOT A WRITE (Verification 40). Read the record back.
    const after = await api('GET', `/test-beds/${tb.bedId}`)
    const p = after.data?.payload ?? {}
    check(p.followUpDate === '2027-04-01',
      `the date is ON THE RECORD, not merely accepted (${JSON.stringify(p.followUpDate)})`)
    check(p.followUpDescription === 'Chase the site survey',
      `the description is on the record (${JSON.stringify(p.followUpDescription)})`)
    check(Number(after.data?.latest_revision_number) > Number(tb.revision),
      `the revision moved ${tb.revision} -> ${after.data?.latest_revision_number}`)
    // AND THE ALLOWLIST STILL REFUSES WHAT IT SHOULD. Widening it by two keys
    // must not widen it generally, which no assertion about the two new keys
    // can see.
    const bad = await api('PATCH', `/test-beds/${tb.bedId}`,
      { payload: { warrantyPct: 5 }, expected_revision: after.data?.latest_revision_number },
      { expect: 400, because: 'warrantyPct must stay closed, and widening by two keys must not widen generally' })
    check(bad.status === 400 && (bad.data?.disallowed ?? []).includes('warrantyPct'),
      `a key that must stay closed is STILL refused (${bad.status} ${JSON.stringify(bad.data?.disallowed ?? [])})`)
  }
} finally {
  const gone = await tearDown(TAG)
  console.log(`\nteardown ${TAG}: removed ${gone.removed?.length ?? 0}, remaining ${gone.remaining}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
if (bad.length) process.exit(1)
