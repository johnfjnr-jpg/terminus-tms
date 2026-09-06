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

test('and the version machinery is live under BOTH forms', () => {
  // It is handed its seam by whichever panel mounts, so it is never commented.
  assert.ok(LIVE.includes('opportunity-deal-versions.js'),
    'the version machinery is not loaded at all')
})

test('the mount container and the hidden vanilla markup both survive', () => {
  // The revert restores the tag and nothing else, which only works while the
  // markup it drives is still in the document.
  assert.match(LIVE, /id="deal-form-root"/, 'React has no container to mount into')
  assert.match(LIVE, /id="deal-form-vanilla"/, 'the revert target markup is gone')
})
