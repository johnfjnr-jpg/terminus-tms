// Every script talks HTTP through the one throwing client. Round 38.
// Runs under `npm test` - a source scan plus pure calls, no network.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS IS A TEST AND NOT A CONVENTION
// ─────────────────────────────────────────────────────────────
//
// An unchecked response is an assumed success, and it happened twice in one
// round: a fixture whose three PATCHes were all refused 400 and which reported
// nothing, and a route answering 500 to every call that a source scan passed
// cleanly. By CLAUDE.md Verification 19 twice is a class, and the fix for a
// class is not remembering.
//
// `fetch` resolves for a 500 exactly as for a 200, so checking is an extra step
// taken every time, whose omission is invisible. api-client.mjs inverts that:
// NOT checking is the extra step, and it has to be spelled out with a reason.
// This test is what stops a second client appearing beside it.

// THE PURE SUITE IS PURE, and that has to include credentials. These tests stub
// fetch and never leave the process, so they must not need a signed-in session
// on disk. Set before any import that might read one.
process.env.TMS_ACCESS_TOKEN = 'test-token-not-a-real-credential'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { api, ApiError } from '../../scripts/api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

function scriptFiles(dir = 'scripts') {
  const out = []
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...scriptFiles(join(dir, e.name)))
    else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) out.push(join(dir, e.name))
  }
  return out
}

// The files allowed to call fetch, each with the reason. Two, and they are at
// different layers rather than being two clients:
//
//   api-client.mjs      the HTTP API client. Throws on any non-2xx unless the
//                       call names the status and says why.
//   verify-harness.mjs  the TRANSPORT under supabase-js, retrying a PostgREST
//                       clock-skew response. It must NOT throw: it hands the
//                       Response back to supabase-js, which does its own error
//                       handling. A throwing transport would turn every
//                       checked { error } into an exception.
//
// Adding a file here is a decision. Forgetting one is a failure, which is the
// direction that matters.
const MAY_CALL_FETCH = {
  'api-client.mjs': 'the HTTP API client, and the one that throws',
  'verify-harness.mjs': 'the transport under supabase-js, which retries clock skew and must not throw',
}

test('no script calls fetch directly except the two that are allowed to', () => {
  const offenders = []
  for (const file of scriptFiles()) {
    if (Object.keys(MAY_CALL_FETCH).some((f) => file.endsWith(f))) continue
    const text = readFileSync(join(ROOT, file), 'utf8')
    text.split('\n').forEach((line, i) => {
      // A comment mentioning fetch is prose, not a call.
      const code = line.replace(/\/\/.*$/, '')
      if (/\bfetch\s*\(/.test(code)) offenders.push(`${file}:${i + 1}`)
    })
  }
  assert.deepEqual(offenders, [],
    'these bypass the throwing client, so a non-2xx there is silent again:\n  ' + offenders.join('\n  '))
})

test('every exempt file exists, so the list cannot rot', () => {
  // An exemption naming a file that no longer exists reads exactly like a
  // considered decision, and quietly stops covering anything.
  const files = scriptFiles()
  for (const name of Object.keys(MAY_CALL_FETCH)) {
    assert.ok(files.some((f) => f.endsWith(name)), `exempt file ${name} does not exist`)
  }
})

test('and each exempt file ACTUALLY calls fetch, or the exemption is dead', () => {
  // The other direction. An exemption for a file that no longer needs one is
  // a hole standing open for the next thing written into it.
  for (const name of Object.keys(MAY_CALL_FETCH)) {
    const file = scriptFiles().find((f) => f.endsWith(name))
    const text = readFileSync(join(ROOT, file), 'utf8')
    const calls = text.split('\n').some((l) => /\bfetch\s*\(/.test(l.replace(/\/\/.*$/, '')))
    assert.ok(calls, `${name} is exempt from the fetch scan and does not call fetch`)
  }
})

test('the scan can SEE a direct fetch', () => {
  // Calibration. The assertion above is an absence, and an absence from an
  // instrument never shown reaching one is not a measurement.
  // ASSEMBLED, not written literally. A calibration string containing the token
  // it calibrates would be found by the scan above, in this file, and the fix
  // for that is not to exempt the file: an exemption would stop the scan
  // policing every other test too.
  const CALL = 'fet' + 'ch('
  const bad = `  const res = await ${CALL}\`\${BASE}/api\${path}\`, { method })`
  const comment = `  // ${CALL}) resolves for a 500 exactly as for a 200`
  const isCall = (line) => /\bfetch\s*\(/.test(line.replace(/\/\/.*$/, ''))
  assert.equal(isCall(bad), true, 'a real call must be found')
  assert.equal(isCall(comment), false, 'prose about fetch must not be')
})

// ─────────────────────────────────────────────────────────────
// The client's own behaviour
// ─────────────────────────────────────────────────────────────

function withFetch(status, body, fn) {
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })
  return fn().finally(() => { globalThis.fetch = real })
}

test('a non-2xx THROWS when the call said nothing', async () => {
  await withFetch(500, { error: 'boom' }, async () => {
    await assert.rejects(() => api('PATCH', '/accounts/x', {}), ApiError)
  })
})

test('a 2xx returns normally', async () => {
  await withFetch(200, { ok: true }, async () => {
    const r = await api('GET', '/x')
    assert.equal(r.status, 200)
    assert.deepEqual(r.data, { ok: true })
  })
})

test('a call that EXPECTS a refusal gets it back as a result, not a throw', async () => {
  await withFetch(409, { error: 'stale' }, async () => {
    const r = await api('PATCH', '/x', {}, { expect: 409, because: 'the record moved' })
    assert.equal(r.status, 409)
    assert.equal(r.data.error, 'stale')
  })
})

test('but expecting 409 and getting 500 still throws', async () => {
  // The whole point. A probe asserting a refusal must not read an unexpected
  // server fault as the refusal it wanted.
  await withFetch(500, { error: 'boom' }, async () => {
    await assert.rejects(
      () => api('PATCH', '/x', {}, { expect: 409, because: 'the record moved' }),
      (e) => e instanceof ApiError && e.status === 500)
  })
})

test('an opt-out with no stated reason is refused', async () => {
  // A boolean flag would have been copy-pasted onto calls that never thought
  // about it. The reason is what makes the opt-out reviewable later.
  await withFetch(409, {}, async () => {
    await assert.rejects(() => api('PATCH', '/x', {}, { expect: 409 }), /needs because/)
  })
})

test('a reason with no status is refused too', async () => {
  await withFetch(200, {}, async () => {
    await assert.rejects(() => api('GET', '/x', undefined, { because: 'vibes' }), /Say which status/)
  })
})
