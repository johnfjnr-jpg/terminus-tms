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
import { stripComments, stripHtml } from '../lib/strip-comments.mjs'
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
  // T1: Account is its own column, not a caption under the name. It is a thing
  // you sort and scan by, which a sub-line is not.
  for (const label of ['Opportunity name', 'Account', 'Opportunity owner', 'TCV', 'Probability',
    'Weighted value', 'Stage', 'Est. close date', 'Actual close date']) {
    assert.ok(app.includes(label), `the table has no "${label}" column`)
  }
  assert.match(app, /onclick="sortOppsBy\('\$\{c\.key\}'\)"/, 'the headers are not sortable')
  assert.match(app, /oppSort\.dir === 'asc' \? '&#9650;' : '&#9660;'/,
    'there are no ascending/descending arrow indicators')
  // The Account column reads the ACCOUNT, never payload.company_name, which is
  // the Opportunity's own copy and can differ from the account it is linked to.
  assert.match(app, /value: \(o\) => o\.account_name \?\? null/,
    'the Account column reads a payload copy rather than the account')
  assert.ok(!/ot-sub">\$\{escHtml\(o\.payload\?\.company_name/.test(app),
    'the company name is still a caption under the name as well as a column')
})

test('T2: every column is allocated, and content is clipped rather than overflowed', () => {
  const css = code('frontend/style.css', 'css')
  // `table-layout: fixed` plus `nowrap` OVERFLOWS rather than clipping, which
  // is what put Stage on top of Est. close date. Neither column was too narrow;
  // the text simply ran out of its own box.
  assert.match(css, /\.opp-table th, \.opp-table td \{[^}]*overflow: hidden/,
    'a cell can overflow onto its neighbour again')
  assert.match(css, /\.opp-table th, \.opp-table td \{[^}]*text-overflow: ellipsis/)
  // ALL NINE sized, not the first two. Leaving the rest to share what is left
  // means adding a column silently re-allocates every other one.
  for (let i = 1; i <= 9; i++) {
    assert.match(css, new RegExp(`\\.opp-table th:nth-child\\(${i}\\), \\.opp-table td:nth-child\\(${i}\\) \\{ width:`),
      `column ${i} has no width of its own`)
  }
  assert.match(css, /\.opp-table \.tag \{ max-width: 100%/,
    'the stage tag can set its column width again')
})

test('"Terminus Lead" is renamed on the OPPORTUNITY and nowhere else', () => {
  // Architecture 6: a display rename stays a display rename. The payload key is
  // untouched, which is what lets the allowlist and every write path stay put.
  // RE-POINTED, Round 6 Phase R. Architecture 6 is unchanged and the label is
  // still descriptor data; only the file moved.
  const ref = code('frontend-react/src/reference/descriptors.ts', 'js')
  assert.match(ref, /staffField\('lead', 'Opportunity owner'\)/,
    'the Opportunity still labels its owner "Terminus Lead"')
  assert.ok(!/'Terminus Lead'/.test(ref), 'a Terminus Lead label survives on the Opportunity')
  // ── AND NOT ON THE OTHERS. RE-POINTED, Round 2 Step C ─────────────────
  //
  // A Test Bed's lead is not an opportunity owner and the rename would make
  // those labels false. That claim is unchanged; WHERE it is measured is not.
  //
  // 1. OFF THE DEAD FILE. frontend/account-detail.js was unloaded in Round 2
  //    and deleted at the Round 4 close; the surface is served by the React
  //    bundle. Left as it was, this assertion would have gone on PASSING by
  //    reading a file the browser never fetches. Second instance of the Round 1
  //    ds-row shape, and the template is now three parts rather than one.
  //
  // 2. THE PREMISE, MEASURED WHILE HERE. The sentence says "the others", and
  //    Phase 0 measured what those are: Test Bed still labels its lead in
  //    vanilla, and the Account surface now labels it in the React descriptors.
  //    Two files, two languages, one claim.
  //
  // 3. BOTH SIDES ASSERTED INDIVIDUALLY, never "some file still says it". When
  //    the last vanilla consumer goes, the first assertion FAILS, and that
  //    failure is the instruction to delete it rather than a defect.
  // RE-POINTED, Round 8 Phase 2. The Test Bed's label lived in the vanilla,
  // which is deleted; the React descriptors carry it now. The property is the
  // rename's own: "Terminus Lead" is the Opportunity's word and the Test Bed
  // keeps it, so a global rename would be wrong in one of the two places.
  assert.match(code('frontend-react/src/testbed/descriptors.ts', 'js'),
    /label: 'Terminus Lead'/,
    'the Test Bed no longer labels its lead "Terminus Lead"')

  // The Account surface, now React. Same claim, measured where the label lives.
  assert.match(code('frontend-react/src/account/descriptors.ts', 'js'), /label: 'Terminus Lead'/,
    'the migrated Account surface lost its Terminus Lead label, which is not an opportunity owner')

  // THE UNLOADED-FILE ASSERTION IS RETIRED WITH ITS FILE. Round 4 close.
  // frontend/account-detail.js is deleted, so "it must not be loaded" is a
  // claim about nothing: a script tag naming it would 404 rather than make a
  // dead file live. The two assertions above carry the meaning now, and the
  // second of them is the one that names where the Account label really lives.
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
  // P4, 2026-09-11: the parameter is `viewIdOrRoot` now - the Leads list stacks
  // many cards with different owners, so the door had to be askable per card
  // and accepts an ELEMENT as well as an id.
  //
  // ANCHORED ON THE FUNCTION, NOT ITS PARAMETER NAME. What this test is about
  // is the three assertions below - that the keyboard path is closed and
  // restored - and the signature was only ever how it found the function.
  // Verification 37: a check that names a mechanism polices the mechanism
  // rather than the effect, and a rename should not read as the guard being
  // removed.
  assert.match(app, /function applyReadOnlyControls\(/)
  assert.match(app, /c\.disabled = notMine/, 'form controls are not disabled, so the keyboard still reaches them')
  assert.match(app, /el\.setAttribute\('tabindex', notMine \? '-1' : '0'\)/,
    'edit-opening elements stay in the tab order, so Enter still opens them')
  // BOTH DIRECTIONS. Restoring is what makes it a toggle rather than a one-way
  // trip: W1's other half is that your own record stays fully typeable.
  assert.ok(!/c\.disabled = true\b/.test(app), 'the sweep disables unconditionally and never restores')

  // ── AND BUTTONS ARE THE OTHER WAY ROUND. U11, 2026-09-04 ───────────────
  //
  // Two correct rulings meeting. W1 ruled the sweep RESTORES, because your own
  // record must stay fully typeable - measured, a fresh visit shows 98 of 98
  // inputs enabled and after visiting somebody else's only 35 of 96, so the
  // sweep genuinely owns form fields.
  //
  // A BUTTON's disabled state is set by a render from the record's situation:
  // no draft to issue, criteria unmet, a draft newer than the issued major.
  // This sweep runs inside that render and AFTER it, so writing `false` here
  // undid all of it - measured, the pricing-approval request disabled itself
  // for a real reason, printed the sentence, and was re-enabled by this line.
  assert.match(app, /if \(notMine\) el\.disabled = true/,
    'the sweep must not re-enable buttons a render deliberately disabled')
  assert.ok(!/\bel\.disabled = notMine\b/.test(app),
    'a button is disabled by its render, and this sweep may only add to that')
})

test('the one door every click-to-edit field opens through is guarded', () => {
  // ── RE-POINTED, Round 6 Phase R, AND IT WAS FALSELY LIVE ─────────────
  //
  // This asserted openRefField's guard in the VANILLA reference file, which
  // Round 5 unloaded. It has been passing ever since by reading a door the
  // browser never opens - green, unchanged, and measuring nothing.
  //
  // The claim is unchanged and is the one the contract's behaviour 2 states:
  // ONE door, consulted at the moment somebody tries, with no timing
  // dependency - unlike the CSS and the ownership sweep, which both run at
  // render. It now has two halves, because the door is a seam:
  const app = code('frontend/app.js', 'js')
  // ── SUPERSEDED BY THE RECORD READ. Round 8 Phase 1 ────────────────────
  //
  // This asserted the registry entry as `'opportunity-detail': () => {` with a
  // body reading `!!v && !v.classList.contains('is-not-mine')`. The reasoning
  // was right for the class model and is kept rather than deleted: a missing
  // view element yields undefined, which fails OPEN, so the entry read the
  // class explicitly.
  //
  // Ruled 2026-09-07: the door reads the RECORD. Round 7's swap retired the
  // path that wrote the class while the door still read it, and the door
  // stayed open on somebody else's record - a silent, security-shaped failure.
  // There is no class in the entry to assert now, and the equivalent property
  // lives in ownership.test.mjs where the register can be exercised.
  assert.match(app, /'opportunity-detail':\s*\(\)\s*=>\s*ownedByMe/,
    'the shell answers no ownership question for this view, so every row refuses')
  const rows = code('frontend-react/src/field-row/useFieldRows.ts', 'js')
  assert.match(rows, /canEditFields\(\)/,
    'the row controller does not consult the guard at all')
})

test('W1\'s probe enumerates by behaviour, so it cannot share the rule\'s blind spot', () => {
  // ── THE ASSERTION NAMED THE MECHANISM AND THE MECHANISM WAS REPLACED ────
  //
  // This asserted the probe contained
  //   `const editOpeners = [...view.querySelectorAll(`
  // and a pointer-events-plus-tabindex expression. Both were the RIGHT guard
  // for the enumeration that existed: they stopped the probe regressing to
  // form controls only.
  //
  // P2.4 replaced that enumeration outright. The probe now imports the shared
  // census instrument, and the old assertion failed on a change that made the
  // probe STRICTLY BROADER - 296 controls to 617, and a div[role=button] the
  // allowlist could not see is now caught. Architecture 9's second variant: a
  // rule built for a state that then changed, still running, still passing,
  // until the state moved under it.
  //
  // The intent is unchanged and is what is asserted now: the probe must not
  // decide for itself what a control is.
  const probe = code('scripts/probe-readonly-view.mjs', 'js')
  assert.match(probe, /from '\.\/lib\/enumerate-controls\.mjs'/,
    'the probe no longer imports the shared enumerator, so it is deciding for itself again')
  assert.match(probe, /window\.__enum\(/,
    'the probe does not call the shared enumerator in the page')
  assert.doesNotMatch(probe, /querySelectorAll\('input, textarea, select'\)[\s\S]{0,120}editOpeners/,
    'the allowlist enumeration is back')

  // AND THE ENUMERATOR ITSELF CARRIES THE PROPERTY THE OLD ASSERTION GUARDED:
  // reachability is a hit test plus tab-order membership, never a style read.
  const enumerator = code('scripts/lib/enumerate-controls.mjs', 'js')
  assert.match(enumerator, /elementFromPoint/,
    'reachability is not measured by hit test, so pointer-events is being read as truth')
  assert.match(enumerator, /keyboardReachable/,
    'the enumerator does not measure keyboard reachability, which is the larger half')
})

// ── T4: THE CORRECTNESS IS AT THE READER, NOT THE N WRITERS ───────────────
test('every route that appends a record revision reports it, and nothing else does', () => {
  // THE AUDIT, BOTH DIRECTIONS, as a test rather than as a one-off pass. A
  // route added later that appends a revision and forgets the key would leave
  // the screen one revision behind and refuse its next save, which is the
  // defect this closed.
  const files = ['src/routes/opportunities.js', 'src/routes/deals.js', 'src/lib/score-entry.js',
    'src/routes/deal-sheet-versions.js', 'src/routes/contacts.js', 'src/routes/accounts.js',
    'src/routes/test-beds.js']
  const gaps = []
  for (const f of files) {
    const src = code(f, 'js')
    const appends = (src.match(/appendRecordRevision\(/g) || []).length
    const emits = (src.match(/record_revision_number/g) || []).length
    if (emits < appends) gaps.push(`${f}: appends ${appends}, reports ${emits}`)
  }
  assert.deepEqual(gaps, [], 'these files advance a record without reporting the new revision:\n  ' + gaps.join('\n  '))
})

test('the hook refuses the ambiguous key a version row also carries', () => {
  const app = code('frontend/app.js', 'js')
  assert.match(app, /const advanced = data\?\.record_revision_number/)
  assert.ok(!/const rev = data\?\.revision_number/.test(app),
    'a bare revision_number is trusted again, and a deal_sheet_versions row carries one')
})

test('the stale-write message is one sentence, on both surfaces, with a control', () => {
  const app = code('frontend/app.js', 'js')
  // RE-POINTED. Both surfaces are React now, and the claim is the one that
  // matters more after the move, not less: two implementations wording one
  // event is Verification 20 in a string.
  const deal = code('frontend-react/src/deal/useDealForm.ts', 'js')
  const ref = code('frontend-react/src/reference/ReferenceHost.tsx', 'js')
  // ── SUPERSEDED WORDING, and the reason is recorded rather than replaced ─
  //
  // It read "This record changed since you loaded it. Reload to see the change,
  // then re-enter yours." That was ruled on the premise that the refusal is NOT
  // transient - "try again" is advice for a transient failure, which this is
  // not.
  //
  // THE PREMISE CHANGED, measured: the poll re-reads within a poll interval, so
  // the condition clears on its own within seconds, and oppPatch now re-reads
  // and retries once itself. A person who sees this sentence has already had a
  // retry refused, so it IS worth trying again - and demanding a manual reload
  // for something already recovering is what produced the walk's "had to go
  // back, restore, then come back - not sure why". Verification 29: the
  // decision is re-taken because its premise failed, not re-weighed.
  assert.match(app, /This record was just changed in another session\. The screen is catching up - try again in a moment\./)
  assert.ok(!/Reload to see the change, then re-enter yours/.test(app),
    'the superseded wording must not survive beside its replacement')

  // AND THE RECOVERY IS AUTOMATIC, which is what makes the new sentence honest.
  assert.match(app, /if \(result\.ok\) \{ showOppWriteRefusal\(null\); return result \}/,
    'a successful write must clear any standing refusal')
  assert.match(app, /if \(result\.status !== 409\) \{/,
    'a stale write must re-read and retry rather than stopping at the refusal')

  // ── FIX 3: A REFUSED WRITE SAYS SO, AS A CLASS ─────────────────────────
  //
  // Recorded on the watch list at the previous walk's close and it bit within a
  // day: a reject on an already-decided request was correctly refused 403, the
  // screen said nothing, and a correct refusal read as corrupted state on three
  // surfaces. Per-handler feedback is the opt-in pattern that left the criteria
  // panel silent - the same shape as a numeric guard covering two fields of 31.
  assert.match(app, /function showOppWriteRefusal\(message\)/)
  assert.match(app, /showOppWriteRefusal\(result\.data\?\.error/,
    'a non-recoverable refusal must surface the server\'s own sentence')
  assert.match(app, /showOppWriteRefusal\(retried\.ok \? null/,
    'a refused RETRY must surface too, or the recovery hides the failure')
  assert.match(app, /const retried = await send\(\)/, 'exactly one retry, never a loop')
  assert.match(app, /window\.reloadAfterStaleWrite = async function/, 'there is no one-click reload')
  // ONE RENDERER. Both surfaces had their own wording, which is Verification 20
  // in a string: two descriptions of one event, only one ever updated.
  // The Commercials surface reaches the shell's renderer through oppPatch,
  // which owns the refusal and the retry; the Reference surface calls it
  // directly. Neither may word the sentence itself.
  for (const [name, src] of [['Commercials', deal], ['Reference', ref]]) {
    assert.ok(!/changed since the screen loaded|catching up - try again/.test(src),
      `${name} carries its own copy of the stale-write wording`)
  }
  assert.match(ref, /window\.staleWriteHtml\?\.\(/,
    'the Reference surface does not use the one renderer, so it must have invented a sentence')
})
