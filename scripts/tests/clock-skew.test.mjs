// The clock-skew retry, and whether the instrument that counts it can reach one.
// Round 38, third occurrence. Runs under `npm test` - a stubbed fetch, no network.
//
// ─────────────────────────────────────────────────────────────
// THE INSTRUMENT WAS THE FINDING
// ─────────────────────────────────────────────────────────────
//
// The retry used to wrap an OPERATION and was applied to exactly ONE call in the
// whole database suite. So when a run failed on PGRST303 inside
// config-invariants.test.mjs, the budget test at the end of the same run printed
// "retries this run: 0" and PASSED. The budget was holding because it covered
// almost nothing, which reads exactly like a platform that has settled down.
//
// Verification 13: a count of zero from an instrument never shown reaching one
// is not a measurement. These tests are that instrument being shown reaching
// one, which the previous version never was.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { skewRetryingFetch, clockSkew } from '../verify-harness.mjs'

const SKEW = () => new Response(
  JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }),
  { status: 401, headers: { 'Content-Type': 'application/json' } })
const OK = (body = { ok: true }) => new Response(JSON.stringify(body), { status: 200 })

function withFetch(responses, fn) {
  const real = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => { calls.push(url); return responses[calls.length - 1] ?? OK() }
  return fn(calls).finally(() => { globalThis.fetch = real })
}

// Silence the stderr announcement inside these tests; it is asserted separately.
function quiet(fn) {
  const real = process.stderr.write.bind(process.stderr)
  const lines = []
  process.stderr.write = (s) => { lines.push(s); return true }
  return Promise.resolve(fn(lines)).finally(() => { process.stderr.write = real })
}

test('a clean response is returned untouched and counts nothing', async () => {
  const before = clockSkew.retries
  await withFetch([OK({ hello: 'world' })], async (calls) => {
    const res = await skewRetryingFetch('https://example.invalid/rest/v1/records')
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { hello: 'world' },
      'the caller must get a body this function has not already consumed')
    assert.equal(calls.length, 1)
  })
  assert.equal(clockSkew.retries, before, 'a clean request must not move the counter')
})

test('A SKEW IS RETRIED, AND THE COUNTER MOVES', async () => {
  // The whole point. The previous implementation was never shown doing this on
  // any path the suite actually used.
  const before = clockSkew.retries
  await quiet(() => withFetch([SKEW(), OK({ second: true })], async (calls) => {
    const res = await skewRetryingFetch('https://example.invalid/rest/v1/stage_gate_rules')
    assert.equal(res.status, 200, 'the retry must be the response the caller sees')
    assert.deepEqual(await res.json(), { second: true })
    assert.equal(calls.length, 2, 'exactly one retry')
  }))
  assert.equal(clockSkew.retries, before + 1)
  assert.match(clockSkew.labels.at(-1), /stage_gate_rules/,
    'the label names the request, so a pattern is attributable rather than just a number')
})

test('it announces itself on stderr', async () => {
  const lines = []
  await quiet((captured) => withFetch([SKEW(), OK()], async () => {
    await skewRetryingFetch('https://example.invalid/rest/v1/approvals')
  }).then(() => lines.push(...captured)))
  assert.ok(lines.some((l) => /clock skew.*PGRST303/.test(l)), lines.join(''))
})

test('a NON-skew failure is returned as-is and never retried', async () => {
  // The discriminating half. A wrapper that retried every failure would pass the
  // test above while hiding real errors behind a second attempt, and would make
  // the counter meaningless as a platform signal.
  const before = clockSkew.retries
  const notSkew = () => new Response(JSON.stringify({ code: '23505', message: 'duplicate key' }), { status: 409 })
  await withFetch([notSkew()], async (calls) => {
    const res = await skewRetryingFetch('https://example.invalid/rest/v1/records')
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, '23505')
    assert.equal(calls.length, 1, 'no retry')
  })
  assert.equal(clockSkew.retries, before)
})

test('a failure with no JSON body is returned as-is', async () => {
  const before = clockSkew.retries
  const html = () => new Response('<html>gateway timeout</html>', { status: 504 })
  await withFetch([html()], async (calls) => {
    const res = await skewRetryingFetch('https://example.invalid/rest/v1/records')
    assert.equal(res.status, 504)
    assert.equal(calls.length, 1)
  })
  assert.equal(clockSkew.retries, before)
})

test('two skews in a row give up rather than looping', async () => {
  // The budget is one retry per request. A skew that persists is a platform
  // problem the run should surface, not one to grind against.
  const before = clockSkew.retries
  await quiet(() => withFetch([SKEW(), SKEW()], async (calls) => {
    const res = await skewRetryingFetch('https://example.invalid/rest/v1/records')
    assert.equal(res.status, 401, 'the second skew is returned to the caller')
    assert.equal(calls.length, 2)
  }))
  assert.equal(clockSkew.retries, before + 1, 'one retry attempted, then it stops')
})
