// ── A SAVE'S PAYLOAD IS BUILT BEFORE IT IS SENT ─────────────────────────
//
// Round 7 Phase 0b, from a defect that sat live for three rounds.
//
// `saveTbDirtyEntries` ended in `tbPatch({ payload: payloadUpdate })` and
// `payloadUpdate` was declared NOWHERE. Every field save on the Test Bed screen
// raised `ReferenceError: payloadUpdate is not defined`, wrote nothing, and
// left the feedback element empty - a Save click that did nothing and said
// nothing.
//
// The declaration and an unrelated freshness check were ADJACENT, and the
// commit that removed the check took the two lines with it. Nothing failed:
// twenty-one gate stages stayed green, because nothing in the repository POSTed
// a Test Bed field save and no test imports a classic script.
//
// ── WHAT THIS SCAN IS, AND WHAT IT IS NOT ───────────────────────────────
//
// It is NARROW ON PURPOSE. A general "used but never declared" scan over these
// files was prototyped and produced 47 candidates, almost all noise: shell
// globals from app.js, single-letter parameters, and words leaking out of HTML
// template literals. A scan that cries wolf is worse than none, and building a
// real scope analyser is a linter rather than a check.
//
// So it asks ONE question, the one the defect answers: when a save sends
// `{ payload: X }` and X is a bare identifier, is X declared in that file at
// all? That is the exact shape, it is decidable, and it cannot go quiet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)

const vanillaFiles = () => readdirSync(new URL('frontend/', ROOT))
  .filter((f) => f.endsWith('.js'))

/** Every `payload: <bareIdentifier>` sent through a PATCH-shaped call. */
function payloadIdentifiers(code) {
  const out = []
  for (const m of code.matchAll(/(?:Patch|api\(\s*'PATCH'[^)]*)\s*\(?\s*\{[^{}]*\bpayload:\s*([A-Za-z_$][\w$]*)\s*[,}]/g)) {
    out.push(m[1])
  }
  // The commoner spelling: `tbPatch({ payload: x })` and `{ payload: x, ... }`
  for (const m of code.matchAll(/\{\s*payload:\s*([A-Za-z_$][\w$]*)\s*[,}]/g)) out.push(m[1])
  return [...new Set(out)]
}

const declaresIn = (code, name) =>
  new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(code)
  || new RegExp(`\\bfunction\\s+${name}\\b`).test(code)

test('the scan finds a payload identifier at all', () => {
  // Verification 12: a scan that returns nothing looks exactly like a scan
  // that found nothing.
  let total = 0
  for (const f of vanillaFiles()) {
    total += payloadIdentifiers(readCode(new URL(`frontend/${f}`, ROOT))).length
  }
  assert.ok(total > 0, 'no `payload: <identifier>` was seen in any vanilla file, '
    + 'so this scan is measuring nothing')
})

test('EVERY payload a save sends is an identifier the file declares', () => {
  const undeclared = []
  for (const f of vanillaFiles()) {
    const code = readCode(new URL(`frontend/${f}`, ROOT))
    for (const name of payloadIdentifiers(code)) {
      // A property shorthand or a shell global is not what this is about; the
      // defect is a LOCAL that was deleted. Anything the file declares passes.
      if (!declaresIn(code, name)) undeclared.push(`${f}: payload: ${name}`)
    }
  }
  assert.deepEqual(undeclared, [],
    'a save sends a payload identifier this file never declares, which is a '
    + 'ReferenceError at click time and writes nothing: ' + undeclared.join(', '))
})
