// ── THE STALENESS CHECK: THE MACHINE FINDS IT, NOT JOHN ──────────────────
//
// `INTERACTION_STANDARDS.md` lapsed after 2026-08-26 and was found by John
// checking a date. Measured at Phase 0: 18 days, 195 commits, 168 UI files
// touched, and 13 of 81 cited identifiers gone from the codebase - five of
// them in Section 5 alone, because `frontend/contact-detail.js` was retired
// in the migration and Section 5's two "real, working examples" lived in it.
//
// The document's whole value is that Part two is "read from source, not
// described from screenshots", with a file and a line per statement, "so a
// reader can check it rather than trust it". A citation that no longer
// resolves inverts that: it is a statement that LOOKS checkable and is false.
//
// ── IT FAILS RATHER THAN WARNS ───────────────────────────────────────────
//
// A warning nobody must act on is the empty-state sentence at gate scale.
// The escape hatch is explicit and lives in the document itself: an
// identifier the document deliberately cites as ABSENT is listed under its
// own heading, so "this does not exist" stays sayable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { stripJs } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const DOC = join(ROOT, 'INTERACTION_STANDARDS.md')
const doc = readFileSync(DOC, 'utf8')

const codeFiles = () => {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (/node_modules|dist|\.verify/.test(p)) continue
      if (e.isDirectory()) walk(p)
      else if (/\.(js|mjs|ts|tsx|html|css)$/.test(p)) out.push(p)
    }
  }
  // `scripts/` too: Section 12 cites the gate machinery that enforces it -
  // `frozenByRuling`, the conformance and staleness suites - and a document
  // that names its own enforcement must be able to have that checked.
  for (const d of ['frontend', 'frontend-react/src', 'src', 'scripts']) walk(join(ROOT, d))
  // Repo-root files too, non-recursively: the document cites the prototype
  // at the root, and a check that cannot see it reports a correct citation
  // as rot.
  for (const e of readdirSync(ROOT, { withFileTypes: true }))
    if (e.isFile() && /\.(js|mjs|ts|tsx|html|css)$/.test(e.name)) out.push(join(ROOT, e.name))
  return out
}
// NOT comment-stripped. The document cites identifiers that legitimately
// appear in a comment - a rationale it quotes, a name a comment explains -
// and this scan asks whether the name EXISTS in the estate, not whether it
// is executed. Verification 39 is about prose satisfying a check for CODE;
// here the citation is satisfied by presence of any kind, which is what the
// document claims.
const FILES = codeFiles()
const corpus = FILES.map((f) => readFileSync(f, 'utf8')).join('\n')
// A cited FILENAME is checked against the filesystem, not against file
// CONTENTS. `ParkForm.tsx` exists and no file mentions it, so a
// contents-only scan reported the document's newest and most accurate
// citation as rot - the check calling a correction stale.
const basenames = new Set(FILES.map((f) => f.split('/').pop()))
const resolves = (name) => (/\.(tsx|ts|js|mjs|html|css)$/.test(name)
  ? basenames.has(name)
  : corpus.includes(name.replace(/^[#.]/, '')))

/** The document's own escape hatch, read from the document. */
const assertedAbsent = () => {
  const m = /## Identifiers asserted ABSENT([\s\S]*?)(?=\n## |\n# |$)/.exec(doc)
  if (!m) return new Set()
  return new Set([...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]))
}

const cited = () => [...new Set([...doc.matchAll(/`([#.]?[A-Za-z_][\w$.-]{3,})`/g)]
  .map((m) => m[1]))]
  .filter((x) => !/\.md$|^https?/.test(x))
  .filter((x) => !/^(Round|Section|Phase)/.test(x))

test('every identifier INTERACTION_STANDARDS cites still exists', () => {
  const absent = assertedAbsent()
  const missing = cited().filter((c) => {
    if (absent.has(c)) return false
    return !resolves(c)
  })
  assert.deepEqual(missing, [],
    `INTERACTION_STANDARDS.md cites ${missing.length} identifier(s) that no longer exist.\n`
    + `  ${missing.join('\n  ')}\n`
    + '  Either the document is stale, or the name belongs under its\n'
    + '  "## Identifiers asserted ABSENT" heading.')
})

test('the escape hatch is USED, not merely available', () => {
  // Verification 14's true-by-absence: a check whose exemption list is empty
  // proves nothing about the exemption mechanism, and the mechanism is what
  // keeps "this does not exist" sayable.
  const absent = assertedAbsent()
  assert.ok(absent.size > 0,
    'no identifier is listed as asserted-absent, so the escape hatch is untested')
  for (const name of absent)
    assert.ok(doc.includes(`\`${name}\``),
      `${name} is listed as absent but the document never cites it`)
})

test('the check can SEE a stale citation', () => {
  // Verification 9: proven capable of failing, on a SYNTHETIC anchor so it
  // cannot be retired by the fix. Assembled from parts so this file cannot
  // satisfy its own scan.
  const fake = ['zz', 'NoSuch', 'Identifier', 'Anywhere'].join('')
  assert.equal(corpus.includes(fake), false, 'the synthetic anchor is not synthetic')
  const withFake = [...cited(), fake]
  const missing = withFake.filter((c) => !assertedAbsent().has(c) && !resolves(c))
  assert.deepEqual(missing, [fake], 'the check did not see an obviously stale citation')
})
