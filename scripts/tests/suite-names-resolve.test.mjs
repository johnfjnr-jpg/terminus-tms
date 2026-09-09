// EVERY TEST FILE THE SUITE NAMES EXISTS ON DISK.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
//
// `package.json` named `scripts/tests/vanilla-coupling.test.mjs` in the pure
// suite. The file was deleted in `a763653` in Round 6 and never removed from
// the list. Measured:
//
//   node --test <missing>          -> exit 1
//   node --test <real> <missing>   -> exit 0     SILENTLY IGNORED
//   npm test                       -> 502/502, 0 fail
//
// Alone it fails. Alongside a real file the runner ignores it, so the suite
// reported GREEN over a name resolving to nothing for several rounds. That is
// the estate's own recorded shape: six tests once sat unrun while every commit
// message said the suite was green, and only a COUNT surfaced it.
//
// ── AND THE CARRIED ITEM NAMED ONE. THERE WERE TWO. ───────────────────────
//
// `reference-coupling.test.mjs`, retired in the same round, was also still
// listed. A guard that checked the one name we knew about would have passed
// while the second phantom rode green - Verification 19 as extended: a name
// used as an ENUMERATION fails by silent omission.
//
// So this reconciles the WHOLE list against disk rather than checking known
// names, and fails on any future one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'))

/** Every test file named by any suite script, with the script that names it. */
export function suiteNames(scripts = pkg.scripts) {
  const out = []
  for (const [key, cmd] of Object.entries(scripts)) {
    if (!/^test(:|$)/.test(key)) continue
    for (const m of String(cmd).matchAll(/scripts\/tests\/[A-Za-z0-9._-]+\.test\.mjs/g)) {
      out.push({ key, file: m[0] })
    }
  }
  return out
}

test('every test file named by a suite exists on disk', () => {
  const named = suiteNames()
  assert.ok(named.length > 40, `only ${named.length} test files named; the scan is not finding the suites`)
  const missing = named.filter(({ file }) => !existsSync(`${ROOT}${file}`))
  assert.deepEqual(missing.map((m) => `${m.key}: ${m.file}`), [],
    'A suite names a file that does not exist. `node --test` IGNORES it when other\n'
    + '      files are present, so the suite reports GREEN over a name resolving to\n'
    + '      nothing. Remove the name, or restore the file.')
})

test('the scan can see a phantom, so its zero is a measurement', () => {
  // Verification 13: a count of zero from an instrument never shown reaching
  // one is not a measurement. The scan is run against a synthetic phantom.
  const fake = { test: 'node --test scripts/tests/no-secrets.test.mjs scripts/tests/does-not-exist.test.mjs' }
  const named = suiteNames(fake)
  const missing = named.filter(({ file }) => !existsSync(`${ROOT}${file}`))
  assert.equal(missing.length, 1, 'the scan cannot see a phantom name, so its zero means nothing')
  assert.match(missing[0].file, /does-not-exist/)
})
