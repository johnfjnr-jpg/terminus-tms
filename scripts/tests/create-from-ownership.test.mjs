// The create-from ownership guards, asserted on the source. PURE.
//
// ── WHY THIS FILE EXISTS, AND IT IS NOT BELT-AND-BRACES ───────────────────
//
// A first attempt at these guards was inserted by pattern-anchor. It landed in
// SIX routes instead of four - including two GET routes - and because the bed
// selects did not fetch owner_id, `bed.owner_id` was undefined and the guard
// would have REFUSED EVERY CALLER INCLUDING THE OWNER.
//
// IT PARSED, AND THE SUITE WOULD HAVE PASSED, because no test opened those
// routes. That is the whole reason for this file: the failure was not a missing
// refusal, it was a refusal that admitted nobody, and only a check that knows
// WHICH routes should be guarded and that each can READ an owner can see it.
//
// Derived from CREATE_FROM_OWNERSHIP_BRIEF.md's ruled list, not from the code
// being changed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripJs } from '../lib/strip-comments.mjs'

// TARGETABLE BY ROOT so the calibration can point at a mutated COPY and never
// write to src/. Verification 44: a fault-injection harness that cannot touch
// the source has nothing for its snapshot checks to catch.
const ROOT = process.env.CREATE_FROM_ROOT ?? new URL('../../', import.meta.url).pathname
const FILES = {
  contacts: stripJs(readFileSync(ROOT + 'src/routes/contacts.js', 'utf8')),
  testBeds: stripJs(readFileSync(ROOT + 'src/routes/test-beds.js', 'utf8')),
}
// THE MARKER IS CODE, NOT PROSE. The first version of this file keyed on the
// guard's comment heading and read the sources through stripJs - so it stripped
// the comments and then looked for one, and found zero guards on a file with
// four. Verification 39 inverted, in the test written to enforce it.
//
// Keying on the comparison itself is also the better assertion: a comment can
// drift from the code beneath it, and this cannot.
const GUARD_RE = /owner_id !== request\.user\.id\)\s*return sendRefusal\(reply\)/
const hasGuard = (body) => GUARD_RE.test(body)

// R5's ruled list, route-level half. The two function-mediated paths are
// guarded inside the functions and are asserted by the migration's own test.
const GUARDED = [
  ['contacts', "app.post('/contacts/:id/create-test-bed'"],
  ['testBeds', "app.post('/test-beds/:id/customer-documents'"],
  ['testBeds', "app.post('/test-beds/:id/complete-document'"],
  ['testBeds', "app.post('/test-beds/:id/units/derive'"],
]

// Every route in a file, as {method, path, body}, so a guard can be attributed
// to the route that owns it rather than to the nearest line.
function routes(src) {
  const hits = [...src.matchAll(/app\.(get|post|patch|put|delete)\('([^']+)'/g)]
  return hits.map((m, i) => ({
    method: m[1], path: m[2],
    body: src.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : src.length),
  }))
}
const ALL = [...routes(FILES.contacts), ...routes(FILES.testBeds)]

test('exactly the four ruled route-level paths carry the guard', () => {
  const guarded = ALL.filter((r) => hasGuard(r.body)).map((r) => `${r.method} ${r.path}`)
  const want = GUARDED.map(([, a]) => {
    const m = a.match(/app\.(\w+)\('([^']+)'/)
    return `${m[1]} ${m[2]}`
  })
  assert.deepEqual(guarded.sort(), want.sort())
})

test('NO GET ROUTE carries the guard', () => {
  // The near-miss put it on /test-beds/:id/document-requirements and
  // /lifecycle-documents, which would have broken team-wide read.
  const gets = ALL.filter((r) => r.method === 'get' && hasGuard(r.body))
  assert.deepEqual(gets.map((r) => r.path), [],
    'a GET route is guarded: team-wide read is broken')
})

test('every guarded route can actually READ an owner', () => {
  // THE NEAR-MISS'S OWN MECHANISM. A guard comparing an undefined owner_id
  // refuses everybody, and nothing else in the suite would notice.
  //
  // THE OWNER IS NOT ALWAYS SELECTED IN THE ROUTE BODY. Three of the four read
  // the bed inline; create-test-bed gets its contact from the shared
  // loadQualifiedContact, so the check follows the loader rather than assuming
  // the select is where the guard is. The first version of this test asserted
  // the inline shape and failed on the one route that does it differently -
  // which is the same class of mistake as the guard it exists to police.
  const LOADERS = { 'loadQualifiedContact': FILES.contacts }
  for (const [file, anchor] of GUARDED) {
    const src = FILES[file]
    const i = src.indexOf(anchor)
    assert.notEqual(i, -1, `${anchor} not found`)
    const m = GUARD_RE.exec(src.slice(i))
    assert.ok(m, `${anchor}: no guard found`)
    const before = src.slice(i, i + m.index)

    if (/owner_id/.test(before)) continue   // selected inline

    // Otherwise the route must populate its variable from a loader, and that
    // loader must select owner_id.
    const loader = Object.keys(LOADERS).find((n) => new RegExp(`\\b${n}\\s*\\(`).test(before))
    assert.ok(loader,
      `${anchor}: the guard compares an owner the route neither selects nor loads`)
    const lsrc = LOADERS[loader]
    const li = lsrc.indexOf(`function ${loader}`)
    assert.notEqual(li, -1, `${loader} is not defined where expected`)
    assert.match(lsrc.slice(li, li + 900), /\.select\([^)]*owner_id/,
      `${anchor}: ${loader} does not select owner_id, so the guard compares undefined`)
  }
})

test('the guard refuses through sendRefusal, never a fabricated 42501', () => {
  // R2: 42501 stays reserved for refusals RLS itself raises. A route
  // synthesising it would make two sources indistinguishable.
  for (const r of ALL.filter((x) => hasGuard(x.body))) {
    const seg = r.body.slice(GUARD_RE.exec(r.body).index)
    assert.match(seg.slice(0, 900), /return sendRefusal\(reply\)/, `${r.path}`)
    assert.doesNotMatch(seg.slice(0, 900), /42501/, `${r.path} fabricates 42501`)
  }
})

test('R7: the approvals path is EXEMPT and must stay unguarded', () => {
  // create-from BY DESIGN - a non-owner acting there is the approval flow's
  // entire point - and R7 says no later sweep may close it. Asserted so a
  // sweep that tries, fails here.
  const tr = stripJs(readFileSync(ROOT + 'src/routes/transition-requests.js', 'utf8'))
  const r = routes(tr).find((x) => x.path === '/transition-requests/:id/approvals')
  assert.ok(r, 'the approvals route is gone')
  assert.ok(!hasGuard(r.body),
    'the approvals path has been guarded: it is create-from BY DESIGN and exempt by name under R7')
})
