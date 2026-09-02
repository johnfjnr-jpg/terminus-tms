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

// ── THE READ-ONLY RULE TARGETS CONTROL TYPES, NOT ENUMERATED CONTROLS ─────
//
// W1 made another user's record non-interactive and was measured green. The CSS
// named `input, textarea, select`, AND W1'S PROBE ENUMERATED THE SAME THREE
// TAGS, so the rule and its instrument shared one blind spot and confirmed each
// other. Measured 2026-09-02 on a non-owned record: all 55 form controls inert,
// and 18 elements that behave as controls still live.
//
// Three layers now, and each covers what the others cannot: CSS (applies
// whenever an element appears), the openRefField guard (no timing dependency at
// all), and the disabled sweep (stops the keyboard). Each is asserted, because
// losing any one of them silently restores a different half of the defect.
test('read-only covers the elements that BEHAVE as controls', () => {
  const css = code('frontend/style.css', 'css')
  assert.match(css, /\.is-not-mine \.ref-field-display/,
    'the click-to-edit display divs are not covered, so they still open editors')
  assert.match(css, /\.is-not-mine \.cd-name-display/, 'the record-name header is not covered')
  assert.match(css, /\.is-not-mine \[role="switch"\]/, 'switch-role controls are not covered')
})

test('and the keyboard path is closed, not just the mouse one', () => {
  const app = code('frontend/app.js', 'js')
  // pointer-events is a MOUSE guard. The reported defect went through a select
  // that was pointer-events: none and NOT disabled, so it stayed operable by
  // arrow keys once focused.
  assert.match(app, /function applyReadOnlyControls\(viewId, notMine\)/)
  assert.match(app, /c\.disabled = notMine/, 'form controls are not disabled, so the keyboard still reaches them')
  assert.match(app, /el\.setAttribute\('tabindex', notMine \? '-1' : '0'\)/,
    'edit-opening elements stay in the tab order, so Enter still opens them')
  // BOTH DIRECTIONS. Restoring is what makes it a toggle rather than a one-way
  // trip: W1's other half is that your own record stays fully typeable.
  assert.ok(!/c\.disabled = true\b/.test(app), 'the sweep disables unconditionally and never restores')
})

test('the one door every click-to-edit field opens through is guarded', () => {
  const ref = code('frontend/opportunity-reference.js', 'js')
  // The layer with NO timing dependency: CSS and the sweep both run at render,
  // this runs at the moment somebody tries.
  assert.match(ref, /if \(document\.getElementById\('view-opportunity-detail'\)\?\.classList\.contains\('is-not-mine'\)\) return/,
    'openRefField opens an editor on a record the server will refuse to save')
})

test('W1\'s probe enumerates by behaviour, so it cannot share the rule\'s blind spot', () => {
  const probe = code('scripts/probe-readonly-view.mjs', 'js')
  assert.match(probe, /const editOpeners = \[\.\.\.view\.querySelectorAll\(/,
    'the probe counts only form controls again, which is the blind spot it had')
  assert.match(probe, /el\.disabled === true \|\| el\.getAttribute\('tabindex'\) === '-1'/,
    'the probe treats pointer-events alone as read-only, which the defect disproved')
})
