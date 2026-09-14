// ── THE RETRY, CALIBRATED THREE WAYS ────────────────────────────────────
//
//   1. It RECOVERS from an intermittent stall, and LOGS it with durations.
//   2. It FAILS on a consistent one - RETRY_LIMIT in a row - because at that
//      point it is not intermittent and failing is the honest answer.
//   3. It does NOT retry a non-timeout error, which would be a second guard
//      failing open.
//
// A retry that cannot fail is the evidence-destroying move this sequence
// exists to refuse, so (2) is the one that matters.
//
// The stalls are INJECTED at the query layer rather than waited for: a real
// one arrives 2 times in 20 and cannot be scheduled.
import { pagedSelect, stallLog } from '../fixtures.mjs'

let ok = true
const say = (pass, what, detail) => { if (!pass) ok = false
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`) }

/** A fake query builder: fails `failTimes` with a stall, then succeeds. */
const stallingQuery = (failTimes, msg = 'canceling statement due to statement timeout') => {
  let n = 0
  return () => ({
    order: () => ({
      range: async () => {
        n++
        if (n <= failTimes) { await new Promise((r) => setTimeout(r, 30)); return { data: null, error: { message: msg } } }
        return { data: [{ id: 1, record_id: 'r' }], error: null }
      },
    }),
  })
}

console.log('=== 1. IT RECOVERS FROM AN INTERMITTENT STALL, AND LOGS IT ===')
{
  const before = stallLog.length
  const t0 = Date.now()
  const rows = await pagedSelect(stallingQuery(1), 'calib-intermittent')
  const ms = Date.now() - t0
  say(rows.length === 1, 'the scan recovered and returned its rows', `${rows.length} row(s)`)
  const entry = stallLog[stallLog.length - 1]
  say(stallLog.length === before + 1, 'the retry was RECORDED, not swallowed')
  say(!!entry && entry.attempts === 2, 'the record carries the attempt count', `attempts ${entry?.attempts}`)
  say(!!entry && entry.durations.length === 2, 'and each attempt DURATION', `[${entry?.durations.join(', ')}]ms`)
  say(!!entry && entry.recovered === true, 'and that it recovered')
  say(ms >= 2000, 'it WAITED before retrying rather than racing the stall', `${ms}ms elapsed`)
}

console.log('\n=== 2. IT FAILS ON A CONSISTENT TIMEOUT ===')
{
  let threw = null
  try { await pagedSelect(stallingQuery(99), 'calib-consistent') }
  catch (e) { threw = e.message }
  say(!!threw, 'a persistent stall THROWS rather than looping to green')
  say(!!threw && /no longer intermittent/.test(threw), 'and says why, in the failure itself')
  say(!!threw && /3 attempts/.test(threw), 'naming the attempt count', threw?.match(/(\d+) attempts/)?.[0])
  say(!!threw && /durations \[/.test(threw), 'and the durations, so a stall logs AS a stall')
  const entry = stallLog[stallLog.length - 1]
  say(!!entry && entry.recovered === false, 'the record marks it NOT recovered')
}

console.log('\n=== 3. IT DOES NOT RETRY A NON-TIMEOUT ERROR ===')
{
  const before = stallLog.length
  let threw = null
  try { await pagedSelect(stallingQuery(99, 'column "nope" does not exist'), 'calib-other') }
  catch (e) { threw = e.message }
  say(!!threw, 'a non-timeout error throws')
  say(stallLog.length === before, 'and was NOT retried', `${stallLog.length - before} retry records`)
  say(!!threw && !/no longer intermittent/.test(threw), 'and is not dressed up as a stall')
}

console.log(`\n  ${ok ? 'ALL THREE CLAIMS HOLD.' : '*** A CLAIM FAILED. ***'}`)
process.exit(ok ? 0 : 1)
