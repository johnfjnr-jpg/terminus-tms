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

/* R-VL4, John 2026-09-29: ONE FORMAT, ALWAYS. This test used to be called
   "V0.n keeps its minor, a whole major drops it" and asserted `V2` for a
   version stored as 2.0. The data was always 2.0; only the printing dropped
   the minor, so one row had two names depending on which surface you read. */
test('R-VL4: a label always carries its minor', () => {
  assert.equal(versionLabel({ major: 0, minor: 3 }), 'V0.3')
  assert.equal(versionLabel({ major: 2, minor: 0 }), 'V2.0')
  assert.equal(versionLabel({ major: 2, minor: 1 }), 'V2.1')
  assert.equal(versionLabel({ major: 1, minor: 0 }), 'V1.0')
  // Two-digit parts must not be mangled into one number.
  assert.equal(versionLabel({ major: 12, minor: 34 }), 'V12.34')
  // A version that is not one reads as nothing rather than as "Vundefined".
  assert.equal(versionLabel(null), null)
  assert.equal(versionLabel({ minor: 1 }), null)
})

/* R-VL4 converged John's three sentences onto the one format:
     "V1.1"  |  "V1.1 - Under Edit"  |  "V1.0 - Under Edit - Not saved"
   The grammar is unchanged; what changed is that the label inside it now
   always carries its minor. */
test('P6: the three states John ruled, in his words', () => {
  const issued = { major: 2, minor: 0 }
  const draft = { major: 0, minor: 3 }

  assert.equal(
    workingVersionLabel({ version: issued, draftSaved: false, editedSince: true }),
    'V2.0 - Under Edit - Not saved',
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
    'V2.0')
})

test('P6: no version at all is nothing, not a label about nothing', () => {
  assert.equal(
    workingVersionLabel({ version: null, draftSaved: false, editedSince: false }),
    null)
})

/* ── RETIRED 2026-09-29, AND REPLACED BY A GUARD THAT WALKS ──────────────

   This file used to hold a test called "the label rule is implemented ONCE
   across the estate". It checked A HARDCODED LIST OF FIVE FILES for the V0
   ternary, and it had been GREEN while THREE full copies of the rule sat in
   `src/routes/` - deal-sheet-versions.js, transition-requests.js and
   records.js - because none of those five names was a route.

   Verification 19: an enumeration by NAME fails on the unrecorded instance,
   and the reassuring verdict is the one nobody calibrates.

   Its replacement is `scripts/tests/version-label-composer.test.mjs`, which
   WALKS every file under src/ with no list at all, matches the shapes a label
   can be built in rather than one spelling of the rule, and was calibrated RED
   against those three copies before they were removed: 11 sites in 3 files.

   Retired rather than left beside its replacement, because a guard that cannot
   fail is worse than no guard: somebody reading this file would have found a
   green test named "implemented ONCE" and stopped looking. */
