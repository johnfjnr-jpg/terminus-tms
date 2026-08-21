// Round 17A Phase 6 - the live cost preview's key list.
// Runs under `npm test` (no database needed: this parses source files).
//
// WHY THIS EXISTS. The preview sends draft values to
// POST /api/test-beds/calculate, whose body schema names the keys it accepts.
// FASTIFY STRIPS BODY KEYS THE SCHEMA DOES NOT NAME, silently and by default,
// so a key misspelled on the client would not error: it would arrive absent,
// compute as zero, and render a confident wrong total on a tab whose numbers
// carry a go/no-go decision.
//
// That is Architecture rule 9's shape - an allowlist that gives no feedback
// when it excludes something - and the two lists are far enough apart that no
// one editing one would see the other. This asserts they are identical, and
// it parses the real files rather than restating either, the same method as
// the stylesheet invariant.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')

// The engine's own inputs, from the function that maps a payload onto it.
// If a cost key is ever added there, the two lists below must both grow, and
// this is what notices.
function engineKeys(src) {
  const fn = src.slice(src.indexOf('export function buildTestBedCostBreakdown'))
  const body = fn.slice(0, fn.indexOf('\n}'))
  return [...new Set([...body.matchAll(/payload\.(\w+)/g)].map(m => m[1]))].sort()
}

function schemaKeys(src) {
  const at = src.indexOf("app.post('/test-beds/calculate'")
  assert.ok(at > -1, 'the calculate route could not be found; this test is parsing the wrong file')
  const block = src.slice(at, src.indexOf('}, async (request, reply)', at))
  const list = block.slice(block.indexOf('properties: Object.fromEntries(['), block.indexOf('].map(k =>'))
  return [...list.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]).sort()
}

function clientKeys(src) {
  const at = src.indexOf('const TB_COST_INPUT_KEYS = [')
  assert.ok(at > -1, 'TB_COST_INPUT_KEYS could not be found; this test is parsing the wrong file')
  const list = src.slice(at, src.indexOf(']', at))
  return [...list.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]).sort()
}

test('the client key list and the route schema name exactly the same keys', () => {
  const server = read('../../src/routes/test-beds.js')
  const client = read('../../frontend/test-bed-detail.js')

  const s = schemaKeys(server)
  const c = clientKeys(client)

  // Calibration, per Verification 13: a comparison of two empty lists passes
  // and proves nothing, which is Verification 14's vacuous match. Both must be
  // populated before their equality means anything.
  assert.ok(s.length >= 10, `schema list looks unparsed: ${JSON.stringify(s)}`)
  assert.ok(c.length >= 10, `client list looks unparsed: ${JSON.stringify(c)}`)

  assert.deepEqual(c, s,
    'the browser sends keys the route does not accept, or omits ones it does; Fastify strips the difference silently')
})

test('every key the cost engine reads is in the accepted list', () => {
  const server = read('../../src/routes/test-beds.js')
  const engine = engineKeys(server)
  const s = schemaKeys(server)

  assert.ok(engine.length >= 10, `engine list looks unparsed: ${JSON.stringify(engine)}`)
  const missing = engine.filter(k => !s.includes(k))
  assert.deepEqual(missing, [],
    'buildTestBedCostBreakdown reads a key the calculate route will not accept, so the preview computes it as zero')
})
