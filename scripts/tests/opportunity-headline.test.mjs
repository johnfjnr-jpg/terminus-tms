// The figures the banner and the list table both show. Internal review items
// 1 and 3, 2026-09-02. Pure functions, no database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weightedValue, issuedMajor, totalContractValue } from '../../src/lib/opportunity-headline.js'

test('weighted is TCV x probability, computed and never stored', () => {
  assert.equal(weightedValue(1000000, 40), 400000)
  assert.equal(weightedValue(1545620, 10), 154562)
})

test('weighted is ABSENT when either side is, never zero', () => {
  // Architecture 11's shape: zero is a value somebody entered, and "nobody set
  // a probability" is a different statement. A weighted value of 0 claims the
  // deal is worth nothing.
  assert.equal(weightedValue(1000000, null), null)
  assert.equal(weightedValue(null, 40), null)
  assert.equal(weightedValue(undefined, undefined), null)
  assert.equal(weightedValue(1000000, NaN), null)
})

test('a probability of zero IS a value and produces zero', () => {
  // The other direction, and it is the one an over-eager null check breaks:
  // somebody deliberately setting 0% has said something.
  assert.equal(weightedValue(1000000, 0), 0)
})

test('the proposal version is the highest ISSUED major', () => {
  assert.equal(issuedMajor([
    { status: 'issued', major: 1, minor: 0 },
    { status: 'issued', major: 2, minor: 0 },
    { status: 'draft', major: 2, minor: 1 },
  ]), 2)
})

test('a draft is not an issued version, however high its major', () => {
  assert.equal(issuedMajor([{ status: 'draft', major: 9, minor: 1 }]), null)
})

test('nothing issued is NULL, which the screen renders as "none"', () => {
  // Ruled: "none", not blank. A blank reads as a figure that failed to load.
  assert.equal(issuedMajor([]), null)
  assert.equal(issuedMajor(undefined), null)
})

test('the version order is (major, minor), never the revision number', () => {
  // Round 41 established this for the transition gate and it holds here: a
  // version-to-version question is not answered with the opportunity's counter.
  // V1.0 carries a HIGHER revision here, and V2.0 is still the answer.
  assert.equal(issuedMajor([
    { status: 'issued', major: 2, minor: 0, revision_number: 3 },
    { status: 'issued', major: 1, minor: 0, revision_number: 99 },
  ]), 2)
})

test('an unpriced deal has NO contract value, not a zero one', () => {
  // The calculator returns 0 for a payload with no units, no lump sum and no
  // hosting. Rendering "$0" puts a confident figure where there is none, which
  // is CLAUDE.md rule 10's bright-zero-beside-dim-zero exactly.
  assert.equal(totalContractValue({}, { ssUnitCost: 1000 }, 0), null)
})

test('a payload the calculator cannot price reads as no value, not as an error', () => {
  // A list must not 500 over a derived column.
  assert.equal(totalContractValue({ structure: 'nonsense' }, null, 0), null)
  assert.equal(totalContractValue(null, null, 0), null)
})

// ── THE SURFACES, asserted from source ────────────────────────────────────
import { readFileSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'
const ROOT = new URL('../../', import.meta.url).pathname
const code = (p, kind) => stripComments(readFileSync(ROOT + p, 'utf8'), kind)

test('the banner shows the six ruled figures', () => {
  const app = code('frontend/app.js', 'js')
  for (const label of ['Total contract value', 'Probability', 'Weighted amount',
    'Est. close date', 'Age', 'Proposal version']) {
    assert.ok(app.includes(label), `the headline strip does not show "${label}"`)
  }
  // RULED: "none", not blank, when nothing is issued.
  assert.match(app, /issued_major\) \? `V\$\{opp\.issued_major\}` : null, \{ absent: 'none' \}/,
    'an unissued proposal does not read "none"')
})

test('the table has the eight ruled columns, each sortable', () => {
  const app = code('frontend/app.js', 'js')
  for (const label of ['Opportunity name', 'Opportunity owner', 'TCV', 'Probability',
    'Weighted value', 'Stage', 'Est. close date', 'Actual close date']) {
    assert.ok(app.includes(label), `the table has no "${label}" column`)
  }
  assert.match(app, /onclick="sortOppsBy\('\$\{c\.key\}'\)"/, 'the headers are not sortable')
  assert.match(app, /oppSort\.dir === 'asc' \? '&#9650;' : '&#9660;'/,
    'there are no ascending/descending arrow indicators')
})

test('"Terminus Lead" is renamed on the OPPORTUNITY and nowhere else', () => {
  // Architecture 6: a display rename stays a display rename. The payload key is
  // untouched, which is what lets the allowlist and every write path stay put.
  const ref = code('frontend/opportunity-reference.js', 'js')
  assert.match(ref, /\{ key: 'lead', label: 'Opportunity owner', staffField: true \}/,
    'the Opportunity still labels its owner "Terminus Lead"')
  assert.ok(!/label: 'Terminus Lead'/.test(ref), 'a Terminus Lead label survives on the Opportunity')
  // AND NOT ON THE OTHERS, because a Test Bed's lead is not an opportunity
  // owner and the rename would make those labels false.
  for (const f of ['frontend/test-bed-detail.js', 'frontend/account-detail.js']) {
    assert.match(code(f, 'js'), /label: 'Terminus Lead'/,
      `${f} lost its Terminus Lead label, which is not an opportunity owner`)
  }
})

test('the sort puts absent values last in BOTH directions', () => {
  // ── THE ASSERTION HAD TO BE TIGHTENED TO DISCRIMINATE ─────────────────
  //
  // The first version was /if \(xn\) return 1[\s\S]{0,40}if \(yn\) return -1/,
  // and the calibration that was supposed to break it - changing `return 1` to
  // `return 1 * dir`, which is the actual defect - STILL MATCHED, because the
  // ` * dir` sat inside the wildcard. It ran, it passed, and it could not tell
  // the two states apart: Verification 17.
  //
  // The direction multiplier must not touch the absent branches, so what is
  // asserted is that neither returns anything but a bare literal.
  const app = code('frontend/app.js', 'js')
  assert.match(app, /if \(xn\) return 1\s*\n/, 'the absent branch is multiplied by the direction')
  assert.match(app, /if \(yn\) return -1\s*\n/, 'the absent branch is multiplied by the direction')
  assert.ok(!/if \(xn\) return [^\n]*dir/.test(app),
    'reversing the sort would promote a column of blanks to the top')
  assert.ok(!/if \(yn\) return [^\n]*dir/.test(app),
    'reversing the sort would promote a column of blanks to the top')
})
