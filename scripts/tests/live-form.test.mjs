import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('the scan can tell a live tag from a commented one', () => {
  // Verification 13: the assertions below are absences, and an absence is only
  // evidence once the instrument has been shown reaching a presence.
  assert.ok(LIVE.includes('src="/terminus-react.js"') || LIVE.includes('terminus-react'),
    'the stripper ate the script tags, so neither assertion below measures anything')
  assert.ok(RAW.includes(TAG), 'the vanilla tag is GONE, so the one-line revert has nothing to restore')
})

test('THE REACT PANEL IS THE LIVE COMMERCIALS FORM', () => {
  assert.ok(!LIVE.includes(TAG),
    'frontend/opportunity-deal.js is loaded again: the swap has been reverted, deliberately or not')
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
test('THE REACT VERSION CARD IS THE LIVE ONE', () => {
  const TAG = '<script type="module" src="/opportunity-deal-versions.js"></script>'
  assert.ok(RAW.includes(TAG),
    'the version card tag is GONE, so the card has no one-line revert')
  assert.ok(!LIVE.includes(TAG),
    'the vanilla version card is loaded again: the card swap has been reverted, deliberately or not')
})

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
