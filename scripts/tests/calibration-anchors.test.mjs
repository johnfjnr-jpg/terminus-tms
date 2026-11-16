// Every calibrate.mjs case's anchor occurs EXACTLY ONCE in its target file.
// Ruled by John 2026-11-16, GOLDEN_STATUS Phase 2 sign-off.
//
// calibrate.mjs is not a gate stage. When G5 (ee177d8) made case 3's anchor
// `structure: 'single'` occur twice, the calibrator could not run, nothing ran
// it, and the gate's comment went on saying "five injections, five fired" for
// six weeks. This test is the cheap half of that calibrator: it never injects
// anything, it only asks whether every injection still has exactly one place
// to land. Zero hits and two hits are both red, and both name the case.
//
// The count is the one `inject` uses (raw text, split on the anchor), so this
// test and the calibrator cannot disagree about what "unique" means. It reads
// the files on disk, which is the committed tree whenever the gate runs.
//
// Each anchor is counted against the ORIGINAL file. No case today puts two
// edits in one file; if one does, its second anchor is counted before the
// first edit, which is stricter than inject and still correct.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'
import { paths, buildCases } from '../golden-deals/calibration-cases.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const P = paths(ROOT)
const FILES = new Set(Object.values(P))
const never = () => { throw new Error('the anchor test never runs a case') }

let CASES = []
let buildError = null
try {
  ;({ CASES } = buildCases(P, readFileSync(P.expect, 'utf8'), { harness: never, compute: never, echoTest: never, gate: never }))
} catch (e) { buildError = e }

test('the calibration cases build from the committed tree', () => {
  assert.equal(buildError, null, `buildCases threw: ${buildError?.message}`)
  // Verification 14: a loop over an empty population passes by never running.
  assert.ok(CASES.length > 0, 'no cases were built, so every per-case test below is missing')
})

const count = (file, anchor) => readFileSync(file, 'utf8').split(anchor).length - 1

for (const [i, c] of CASES.entries()) {
  test(`case ${i + 1} anchors are unique: ${c.name}`, () => {
    assert.ok(c.edits.length > 0, `case ${i + 1} has no edits, so it injects nothing`)
    const bad = []
    for (const [file, anchor] of c.edits) {
      assert.ok(FILES.has(file), `case ${i + 1} injects into ${file}, which calibrate.mjs does not snapshot`)
      const n = count(file, anchor)
      if (n !== 1) bad.push(`${relative(ROOT, file)}: anchor x${n}, need 1:\n${anchor}`)
    }
    assert.deepEqual(bad, [], `case ${i + 1} (${c.name}) cannot inject:\n${bad.join('\n')}`)
  })
}
