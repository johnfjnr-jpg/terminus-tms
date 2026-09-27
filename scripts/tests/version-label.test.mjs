// ── P6: THE WORKING VERSION'S GRAMMAR, AND THE ONE LABEL ─────────────────
//
// John's walk 2026-09-27. The three sentences are his, verbatim, and they are
// a decision rather than a rendering, so they are asserted where the decision
// lives: a pure module, with no browser, no server and no fixture.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { versionLabel, workingVersionLabel } from '../../src/lib/version-label.js'
import { stripComments } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

test('W2s label: V0.n keeps its minor, a whole major drops it', () => {
  assert.equal(versionLabel({ major: 0, minor: 3 }), 'V0.3')
  assert.equal(versionLabel({ major: 2, minor: 0 }), 'V2')
  assert.equal(versionLabel({ major: 2, minor: 1 }), 'V2.1')
  // A version that is not one reads as nothing rather than as "Vundefined".
  assert.equal(versionLabel(null), null)
  assert.equal(versionLabel({ minor: 1 }), null)
})

test('P6: the three states John ruled, in his words', () => {
  const issued = { major: 2, minor: 0 }
  const draft = { major: 0, minor: 3 }

  assert.equal(
    workingVersionLabel({ version: issued, draftSaved: false, editedSince: true }),
    'V2 - Under Edit - Not saved',
    'latest version issued, record edited since, no draft saved')

  assert.equal(
    workingVersionLabel({ version: draft, draftSaved: true, editedSince: false }),
    'V0.3',
    'draft saved, unchanged since')

  assert.equal(
    workingVersionLabel({ version: draft, draftSaved: true, editedSince: true }),
    'V0.3 - Under Edit',
    'draft saved, edited since')
})

/* ── THE FOURTH STATE THE RULING DOES NOT NAME, ANSWERED AND FLAGGED ──────
   John gave three sentences. A record whose latest version is ISSUED and which
   has NOT been edited since is a real state and is not among them: it is a
   record sitting exactly on its issued price.

   It reads as the bare label, because both other "nothing has moved" states do
   and because the two suffixes each say something that would not be true here.
   Asserted so the answer is a decision on the record rather than a default
   nobody chose, and reported as an unstated state rather than presented as
   ruled. */
test('P6: the unstated fourth state reads as the bare label', () => {
  assert.equal(
    workingVersionLabel({ version: { major: 2, minor: 0 }, draftSaved: false, editedSince: false }),
    'V2')
})

test('P6: no version at all is nothing, not a label about nothing', () => {
  assert.equal(
    workingVersionLabel({ version: null, draftSaved: false, editedSince: false }),
    null)
})

/* ── THE ONE SOURCE IS ACTUALLY ONE. P6's own words ──────────────────────
   The ruling asked for labels "from the ONE version-label source". Phase 0
   found four copies of the rule, all agreeing, which is Verification 20's
   benign end and not a reason to keep four.

   This is the assertion that keeps it at one: the ternary that expresses the
   rule may appear in the shared module and nowhere else. It fails the day
   somebody inlines a fifth copy, which is exactly how the first four arrived. */
test('the label rule is implemented ONCE across the estate', () => {
  const files = [
    'src/lib/approval-page.js',
    'src/lib/version-approval.js',
    'src/lib/opportunity-headline.js',
    'frontend-react/src/versions/model.ts',
    'frontend/app.js',
  ]
  // The shape of the rule, not a formatting of it: a V0 branch keyed on the
  // major being zero.
  const RULE = /major === 0[^\n]*V0\./
  for (const f of files) {
    const src = stripComments(readFileSync(ROOT + f, 'utf8'), f.endsWith('.ts') ? 'js' : 'js')
    assert.ok(!RULE.test(src),
      `${f} carries its own copy of the version-label rule. `
      + 'P6 requires one source: import it from src/lib/version-label.js.')
  }
  const one = stripComments(readFileSync(ROOT + 'src/lib/version-label.js', 'utf8'), 'js')
  assert.match(one, RULE, 'the shared module does not carry the rule it exists to hold')
})
