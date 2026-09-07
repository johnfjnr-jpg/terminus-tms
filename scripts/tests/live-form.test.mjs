import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

// ── WHICH FORM IS LIVE, ASSERTED ─────────────────────────────────────────
//
// FOUND BY THE PHASE 3 REVERT REHEARSAL: the full 21-stage gate passed on the
// REVERTED tree exactly as it passes on the swapped one. Nothing anywhere
// asserted which Commercials form the browser actually loads, so an accidental
// un-swap - or a revert nobody meant to keep - was invisible to every stage.
//
// A revert is a deliberate act and must stay one line. What this adds is that
// the act has to be VISIBLE: flipping the tag now fails the gate, which is the
// difference between reverting on purpose and drifting.
//
// It reads the file BOTH ways on purpose. The stripped copy answers "is the tag
// live?", because a commented tag is not a tag. The raw copy answers "is the
// tag still there to restore?", because the revert procedure depends on it.
const ROOT = new URL('../../', import.meta.url)
const RAW = readFileSync(new URL('frontend/index.html', ROOT), 'utf8')
const LIVE = readCode(new URL('frontend/index.html', ROOT))
const TAG = '<script type="module" src="/opportunity-deal.js"></script>'

// ── REWRITTEN BY THE RETIREMENT, Round 6 Phase R ────────────────────────
//
// These two read: the vanilla tag is present but COMMENTED, so the swap holds
// and a one-line revert exists. Both halves were right for as long as the file
// did, and the calibration - `RAW.includes(TAG)`, "the vanilla tag is GONE, so
// the one-line revert has nothing to restore" - is what FIRED when the file
// was deleted. That failure is the instruction to rewrite, not a defect: the
// guard correctly refused to keep asserting a revert that no longer exists.
//
// THE CLAIM IS NOW STRONGER AND SIMPLER. The file is deleted, so the question
// is no longer whether its tag is live but whether anything reintroduces it.
test('the scan can tell a live tag from a commented one', () => {
  // Verification 13: the assertions below are absences, and an absence is only
  // evidence once the instrument has been shown reaching a presence. The
  // vanilla tag can no longer serve as that presence, so the version card's
  // revert target does - it is still a real commented tag in this markup.
  assert.ok(LIVE.includes('src="/terminus-react.js"') || LIVE.includes('terminus-react'),
    'the stripper ate the script tags, so neither assertion below measures anything')
  assert.ok(RAW.includes('opportunity-deal-versions.js'),
    'no commented tag survives anywhere, so the stripper cannot be shown to hide one')
  assert.ok(!readCode(new URL('frontend/index.html', ROOT)).includes('opportunity-deal-versions.js'),
    'the stripper is not hiding commented tags at all, so the absences below prove nothing')
})

test('THE REACT PANEL IS THE LIVE COMMERCIALS FORM, and the vanilla is GONE', () => {
  // Not "commented out" any more. The file is deleted, so a tag naming it
  // would 404 rather than revert, and the markup must not carry one in any
  // form - live OR commented, which is why this reads RAW.
  assert.ok(!RAW.includes(TAG),
    'a script tag for the retired opportunity-deal.js is back in the markup')
  assert.ok(!existsSync(new URL('frontend/opportunity-deal.js', ROOT)),
    'frontend/opportunity-deal.js exists again: the retirement has been reverted')
})

// ── INVERTED BY THE SWAP, Round 4 Phase 2. Claim changed by instruction ──
//
// It read: THE VANILLA VERSION CARD IS THE LIVE ONE, until Round 4 swaps it -
// asserting the tag was still loaded while Phase 1 built the React card behind
// the line. That was correct for Phase 1 and is the guard that kept it true.
//
// Phase 2 is the moment it stops being the claim, and the reasoning is kept
// rather than deleted because the replacement has to say what it now protects:
// the React card is live, and restoring the tag is a deliberate revert rather
// than a drift.
test('and the card has its own mount and its own revert target', () => {
  // The two reverts are INDEPENDENT: each surface has its own container and its
  // own hidden markup, so reverting one does not revert the other.
  assert.match(LIVE, /id="deal-version-root"/, 'the React card has no container to mount into')
  assert.match(LIVE, /id="deal-version-vanilla"/, 'the card\'s revert target markup is gone')
})

// ── SUPERSEDED BY THE SAME SWAP ─────────────────────────────────────────
//
// It read: the version machinery is live under BOTH forms, and asserted the
// vanilla card's tag was loaded, because that file was handed its seam by
// whichever panel mounted.
//
// THE CLAIM SURVIVES AND ITS EVIDENCE MOVED. The version machinery is now the
// React card, and "works under both forms" is no longer a fact about a script
// tag: it is a fact about the seam, proven on a branch by reverting the FORM
// and taking a version against the vanilla adapter. That proof lives in the
// Phase 2 report and in scripts/rehearse-card-two-forms.mjs, because it needs a
// browser and this file reads text.
test('the card consumes a seam rather than reaching for a form', () => {
  const host = readCode(new URL('frontend-react/src/versions/VersionCardHost.tsx', ROOT))
  // It must never name the React form's internals: the form's revert hands it a
  // vanilla adapter, and a card that reached around the interface would break.
  assert.ok(!/DealPanel|useDealForm|readDealPayload/.test(host),
    'the card reaches around the seam into the React form')
  assert.match(host, /seam\.(freezeCurrentState|hasUnsavedChanges|populateForm|recompute)/,
    'the card does not talk to the seam at all')
})

test('the mount container and the hidden vanilla markup both survive', () => {
  // The revert restores the tag and nothing else, which only works while the
  // markup it drives is still in the document.
  assert.match(LIVE, /id="deal-form-root"/, 'React has no container to mount into')
  assert.match(LIVE, /id="deal-form-vanilla"/, 'the revert target markup is gone')
})

// ── WHICH REFERENCE SURFACE IS LIVE. Round 5, Phase 2 ───────────────────
//
// The gate could not tell the swapped tree from the reverted one until this
// existed, which is the same gap Round 3 found for the deal form. The scan
// reads index.html with comments STRIPPED, so a commented-out tag - which is
// what the revert restores - does not count as loaded.
const REF_TAG = '<script src="/opportunity-reference.js"></script>'

// ── REWRITTEN BY THE RETIREMENT, Round 6 Phase 0 ────────────────────────
//
// It read: the tag is present but COMMENTED, so the swap holds and a one-line
// revert exists. Both halves were right for as long as the file was. The RAW
// half is the calibration, and it FIRED when the file was deleted - which is
// the instruction to rewrite rather than a defect, the same sequence the deal
// form's equivalent went through in Phase R.
test('THE REACT REFERENCE PANEL IS THE LIVE ONE, and the vanilla is GONE', () => {
  // Not "commented out" any more. A tag naming it would 404 rather than
  // revert, so the markup must not carry one in any form - which is why this
  // reads RAW rather than the stripped copy.
  assert.ok(!RAW.includes(REF_TAG),
    'a script tag for the retired opportunity-reference.js is back in the markup')
  assert.ok(!existsSync(new URL('frontend/opportunity-reference.js', ROOT)),
    'frontend/opportunity-reference.js exists again: the retirement has been reverted')
})

test('and the Reference panel has its own mount and its own revert target', () => {
  assert.match(LIVE, /id="ref-root"/, 'the React Reference panel has no container to mount into')
  assert.match(LIVE, /id="ref-vanilla"/, "the Reference tab's revert target markup is gone")
})

test('the door is OPEN for the Reference tab, in the shell registry', () => {
  // The swap and this line land together: the seam fails closed, so a
  // registered surface without it refuses every row.
  const app = readCode(new URL('../../frontend/app.js', import.meta.url))
  assert.match(app, /'opportunity-detail':\s*\(\)\s*=>/,
    'CAN_EDIT_BY_VIEW has no opportunity-detail line, so every Reference row refuses')
  assert.match(app, /!!v && !v\.classList\.contains\('is-not-mine'\)/,
    'the registry line no longer fails CLOSED on a missing view element')
})

// ── WHICH CONTACT SURFACE IS LIVE. Round 6, Phase 2 ─────────────────────
//
// Same shape as the Reference and deal-form inversions above. The scan reads
// index.html with comments STRIPPED, so the commented-out tag - which is what
// the revert restores - does not count as loaded.
const CD_TAG = '<script src="/contact-detail.js"></script>'

// ── THE CLAIM AS IT STANDS: BUILT, REGISTERED, AND NOT TAKEN ────────────
//
// This read "THE REACT CONTACT VIEW IS THE LIVE ONE" for the length of one
// session. The visual comparison then measured 524 of the vanilla's 1327 lines
// as behaviours nothing had migrated - notes, park, unqualify, delete and the
// account-details modal - so the tag went back and the claim inverted with it.
//
// The bundle STILL REGISTERS the view. That is the whole point of the
// load-order property: the vanilla is loaded after and wins, so the swap is one
// line away in either direction and the React work is not shelved.
test('THE REACT CONTACT VIEW IS THE LIVE ONE', () => {
  assert.ok(RAW.includes(CD_TAG),
    'the vanilla Contact tag is GONE, so the one-line revert has nothing to restore')
  assert.ok(!LIVE.includes(CD_TAG),
    'frontend/contact-detail.js is loaded again: the swap has been reverted, '
    + 'deliberately or otherwise')
})

test('and the shell asks for the return view rather than reading a lexical name', () => {
  // C1. The binding read `cdReturnView`, a `let` no bundle can make exist.
  // A revert restores the vanilla's own `let` and nothing reads it, which is
  // the one behaviour the one-line revert does NOT restore - recorded at the
  // tag and asserted here.
  const app = readCode(new URL('frontend/app.js', ROOT))
  assert.ok(!/navigate\(cdReturnView\)/.test(app),
    'app.js reads cdReturnView lexically again, which a bundle cannot satisfy')
  assert.match(app, /window\.contactReturnView/,
    'the shell no longer asks the seam for the return view')
  assert.match(app, /:\s*'leads'/,
    'the guarded accessor lost its default, so a bundle that has not mounted a '
    + 'Contact leaves the back button dead')
})

test('the door is OPEN for the Contact view, in the shell registry', () => {
  // The Account preserve ruling by precedent: Phase 0 measured no ownership
  // read anywhere on this surface, so there is no door to preserve and
  // inventing one would be the migration adding behaviour.
  const app = readCode(new URL('frontend/app.js', ROOT))
  const registry = app.slice(app.indexOf('const CAN_EDIT_BY_VIEW'))
  assert.match(registry.slice(0, registry.indexOf('\n}')), /'contact-detail':\s*\(\)\s*=>\s*true/,
    'the Contact view has no entry in CAN_EDIT_BY_VIEW, so the seam fails '
    + 'closed and every row refuses')
})

test('the Contact view has a guarded entry, not a bare call', () => {
  const app = readCode(new URL('frontend/app.js', ROOT))
  assert.ok(!/else if \(view === 'contact-detail' && id\) loadContactDetail\(id\)/.test(app),
    'the dispatch calls loadContactDetail bare, so a missing bundle is a '
    + 'ReferenceError and a blank panel rather than a sentence')
  assert.match(app, /loadContactDetailOrSayWhyNot/,
    'the guarded entry is gone')
})
