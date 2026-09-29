// ── R-VL4's GUARD: NO SITE OUTSIDE THE COMPOSER BUILDS A VERSION LABEL ───
//
// Ruled by John 2026-09-29, and it REPLACES a guard that could not work.
//
// ── WHY THE OLD ONE COULD NOT WORK ───────────────────────────────────────
//
// `version-label.test.mjs` asserted the rule appeared in the shared module and
// in no other file - by checking A HARDCODED LIST OF FIVE FILES, none of them
// in `src/routes/`. It reported clean while THREE full copies of the ternary
// sat outside its list, in deal-sheet-versions.js, transition-requests.js and
// records.js. Verification 19 exactly: an enumeration by NAME fails on the
// unrecorded instance, and the reassuring verdict is the one nobody calibrates.
//
// ── SO THIS WALKS, AND NAMES NOTHING ─────────────────────────────────────
//
// It reads every source file under src/ and reports any that composes a version
// label. There is no list to fall out of date, so a sixth site is a red test
// rather than a silence.
//
// ── IT MATCHES SHAPES, NOT ONE SPELLING ──────────────────────────────────
//
// A label is "the letter V next to a version number" and there is more than one
// way to write that. Matching only the ternary would pass on
// `\`V${v.major}\`` - which is most of what Phase 0 actually found.
//
// COMMENTS ARE STRIPPED FIRST (Verification 39), because this file and the
// module it guards both talk about the thing they forbid, and prose must not be
// able to satisfy or trip a source scan.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

/** The ONE place a version label may be composed. */
const COMPOSER = 'src/lib/version-label.js'

/**
 * The shapes a label can be built in.
 *
 * ASSEMBLED FROM PARTS so this file does not contain the literal patterns it
 * hunts. The estate has been caught twice by a scan matching its own source
 * (Verification 39's Round 8 clause), and an exemption list rots where an
 * absent string cannot.
 */
const V = 'V'
const SHAPES = [
  ['a template literal on the major', new RegExp('`' + V + '\\$\\{')],
  ['a template literal on a zero major', new RegExp('`' + V + '0\\.\\$\\{')],
  ['string concatenation', new RegExp('[\'"]' + V + '[\'"]\\s*\\+')],
]

const walk = (dir, out = []) => {
  for (const entry of readdirSync(ROOT + dir)) {
    const p = `${dir}/${entry}`
    if (/node_modules|\/dist\//.test(p)) continue
    const s = statSync(ROOT + p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(js|mjs)$/.test(entry)) out.push(p)
  }
  return out
}

const offenders = () => {
  const found = []
  for (const f of walk('src')) {
    if (f === COMPOSER) continue
    const src = stripComments(readFileSync(ROOT + f, 'utf8'), 'js')
    src.split('\n').forEach((line, i) => {
      for (const [what, re] of SHAPES) {
        if (re.test(line)) found.push({ f, line: i + 1, what, text: line.trim().slice(0, 80) })
      }
    })
  }
  return found
}

test('R-VL4: the composer is the only place a version label is built', () => {
  const found = offenders()
  assert.equal(found.length, 0,
    `${found.length} site(s) outside ${COMPOSER} compose a version label:\n`
    + found.map((h) => `    ${h.f}:${h.line}  ${h.what}\n      ${h.text}`).join('\n')
    + `\n  Import versionLabel from ${COMPOSER} instead.`)
})

test('the guard WALKS src rather than reading a list, so a new file is covered', () => {
  // The old guard's whole defect was a five-name list. This asserts the walk
  // reaches the directories the three escaped copies lived in, so the fix
  // cannot regress to naming files.
  const files = walk('src')
  assert.ok(files.length > 50, `the walk found only ${files.length} files, which is not a walk`)
  for (const dir of ['src/routes/', 'src/lib/']) {
    assert.ok(files.some((f) => f.startsWith(dir)),
      `the walk does not reach ${dir}, where three copies hid from the previous guard`)
  }
})

test('the composer itself DOES compose, so a silent guard would be visible', () => {
  // Verification 9: a guard proven only by being green has not been proven. If
  // the shapes stopped matching anything at all, the first test above would
  // pass for the wrong reason forever. The composer is the known positive.
  const src = stripComments(readFileSync(ROOT + COMPOSER, 'utf8'), 'js')
  assert.ok(SHAPES.some(([, re]) => src.split('\n').some((l) => re.test(l))),
    'no shape matches the composer, so the scan can no longer see a label being built')
})
