// F5_TEARDOWN_SCALE ruling F1b (John, 2026-11-24): every fixture name the code
// builds starts with its tag EXACTLY, with no case transformation, so the
// switch of every tag filter from ilike to like (ruling F1) cannot rot. The
// F1a case census proved it for the rows that existed on 2026-11-24; this
// keeps it true for names written after.
//
// Each check is calibrated INSIDE the test, both directions, on built
// sources: a wrong name or call must be caught, a right one must pass. A
// detector that has never fired is an assertion, not a control (Verification 9).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nameSites, transformedCalls } from '../lib/fixture-name-tag.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// The files whose tag filters F1 switched, with the fixture names each builds
// today. A MINIMUM, not an exact count: a new conforming name is fine, and a
// population that shrank to nothing would make every check below vacuous.
const NAMED = {
  'scripts/fixtures.mjs': 5,
  'scripts/tests/teardown-scoping.test.mjs': 2,
  'scripts/probe-create-from-any-contact.mjs': 3,
}

test('the name check is calibrated: a transformed or prefixed name fails, a tag-first name passes', () => {
  const bad = [
    'const p = { name: `${tag.toLowerCase()} Contact` }',
    'const p = { name: `${TAG.toUpperCase()} Account` }',
    "const p = { name: 'probe ' + tag }",
    'const p = { name: `x-${tag} Opportunity` }',
    'const p = { name: label }',
  ]
  for (const s of bad) assert.equal(nameSites(s)[0]?.ok, false, `not caught: ${s}`)
  for (const s of ['const p = { name: `${tag} Contact` }', 'const p = { opportunity_name: `${TAG} convert` }', 'const n = (t) => ({ name: `${t} Opportunity` })']) {
    assert.equal(nameSites(s)[0]?.ok, true, `wrongly refused: ${s}`)
  }
  // Verification 39, both halves: prose cannot satisfy or trip it.
  assert.equal(nameSites('// name: `${tag.toLowerCase()} Contact`\nconst x = 1').length, 0, 'a comment was read as code')
})

for (const [file, min] of Object.entries(NAMED)) {
  test(`every fixture name in ${file} starts with its tag exactly`, () => {
    const sites = nameSites(readFileSync(join(ROOT, file), 'utf8'))
    assert.ok(sites.length >= min, `${file}: ${sites.length} name sites found, expected at least ${min}; the check would be vacuous`)
    const wrong = sites.filter((s) => !s.ok)
    assert.deepEqual(wrong.map((s) => `${s.key}: ${s.value}`), [],
      `${file} builds a fixture name that does not start with the tag exactly. tearDown's tag filter is a `
      + `case-sensitive prefix like (ruling F1), so this record would be unreachable by its own teardown.`)
  })
}

// The bad calls are ASSEMBLED, never written out: this file sits under
// scripts/, so a literal one would be found by the scan below and the scan
// would report its own calibration (measured on the first run: four hits,
// all here). An exemption would rot; an absent string cannot (Verification 9).
const call = (fn, arg) => `${fn}(${arg})`
test('the call check is calibrated: a case-transformed tag at a fixture or teardown call is caught', () => {
  for (const s of [call('tearDown', 'TAG.toLowerCase()'), call('freshOpportunity', '`${TAG}`.toUpperCase()'), call('rememberTag', 'tag.normalize()')]) {
    assert.equal(transformedCalls(s).transformed.length, 1, `not caught: ${s}`)
  }
  assert.equal(transformedCalls(`await ${call('tearDown', 'TAG')}; await ${call('freshOpportunity', '`${TAG}TB`')}`).transformed.length, 0, 'a plain tag was refused')
  assert.equal(transformedCalls(`// ${call('tearDown', 'TAG.toLowerCase()')}`).calls, 0, 'a comment was read as a call')
})

test('no fixture or teardown call in scripts/ passes a case-transformed tag', () => {
  const files = []
  const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p) } else if (/\.m?js$/.test(e)) files.push(p) } }
  walk(join(ROOT, 'scripts'))
  let calls = 0
  const hits = []
  for (const f of files) {
    const r = transformedCalls(readFileSync(f, 'utf8'))
    calls += r.calls
    for (const h of r.transformed) hits.push(`${relative(ROOT, f)}: ${h}`)
  }
  // Verification 14: the population must exist for its zero to mean anything.
  assert.ok(calls > 50, `only ${calls} fixture or teardown calls found across ${files.length} files; the scan is not reading them`)
  assert.deepEqual(hits, [], 'a tag is case-transformed on its way into a fixture or teardown call; the like filter would miss it')
})
