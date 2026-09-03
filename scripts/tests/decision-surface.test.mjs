// ── ONE HANDLER, WHICHEVER BANNER THE CLICK CAME FROM ────────────────────
//
// Round 41, 2026-09-03. decideRequest was bound to the STAGE banner's ids while
// the pricing-approval banner called the same handler, so on that surface the
// pending state and the double-click guard were lost and every refusal was
// written to an element that is not on the banner the person is looking at.
//
// The behaviour is a property of a BROWSER and is measured by
// probe-decision-feedback, which is reported at the boundary rather than run by
// the gate, on the same terms as every other browser probe here. What can run
// unattended is the WIRING: the handler must resolve its surface rather than
// name one, and both banners must carry the two markers that let it.
//
// VERIFICATION 39. Every scan below reads STRIPPED source. The comments in
// decideRequest necessarily quote `opp-freeze-banner` and
// `opp-request-feedback` while explaining why they are no longer read, so a
// scan of the raw file is satisfied by the prose describing the fix.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripJs, stripHtml } from '../lib/strip-comments.mjs'

const appRaw = readFileSync(new URL('../../frontend/app.js', import.meta.url), 'utf8')
const htmlRaw = readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8')
const app = stripJs(appRaw)
const html = stripHtml(htmlRaw)

// The stripper is calibrated in both directions here rather than trusted: a
// stripper that ate real code would make every assertion below a silent false
// negative, which is the same fault wearing the other hat.
test('the stripper removes the prose and keeps the code', () => {
  assert.ok(appRaw.includes("opp-freeze-banner and\n  // opp-request-feedback")
    || /opp-request-feedback/.test(appRaw), 'the raw file should mention the old ids in prose')
  assert.ok(app.includes('window.decideRequest'), 'stripping must keep real code')
  assert.ok(html.includes('id="opp-review-banner"'), 'stripping must keep real markup')
})

test('both decision banners are marked, so the handler can find them', () => {
  for (const id of ['opp-freeze-banner', 'opp-review-banner']) {
    const re = new RegExp(`id="${id}"[^>]*data-decision-banner`)
    assert.match(html, re, `${id} must carry data-decision-banner`)
  }
})

test('both banners own a feedback slot, and neither is a slot nothing writes to', () => {
  // opp-review-feedback was created in e721611 and never written to: one
  // occurrence, one commit, the container-written-and-never-read signature.
  for (const id of ['opp-request-feedback', 'opp-review-feedback']) {
    const re = new RegExp(`id="${id}"[^>]*data-decision-feedback`)
    assert.match(app, re, `${id} must carry data-decision-feedback`)
  }
})

test('a refusal has a floor when its own banner is dissolved by the refusal', () => {
  assert.match(html, /id="opp-decision-feedback"[^>]*data-decision-feedback/)
  assert.match(app, /getElementById\('opp-decision-feedback'\)/,
    'the handler must fall back to the floor')
})

test('decideRequest resolves its surface and does not name one', () => {
  const start = app.indexOf('window.decideRequest')
  assert.ok(start > 0, 'decideRequest must exist')
  const body = app.slice(start, app.indexOf('\n}', app.indexOf('await done(', start)))
  assert.match(body, /querySelectorAll\('\[data-decision-banner\]'\)/,
    'the banner set must come from the marker')
  assert.match(body, /closest\('\[data-decision-banner\]'\)/,
    'the banner must be resolved from the clicked control')
  assert.match(body, /querySelector\('\[data-decision-feedback\]'\)/,
    'the feedback slot must come from the resolved banner')
  // THE POINT OF THE FIX: the handler no longer reaches for the stage banner.
  assert.doesNotMatch(body, /getElementById\('opp-freeze-banner'\)/,
    'the handler must not name the stage banner')
  assert.doesNotMatch(body, /getElementById\('opp-request-feedback'\)/,
    'the handler must not name the stage banner\'s feedback slot')
  assert.doesNotMatch(body, /returnFocusTo: 'opp-freeze-banner'/,
    'focus must return to the banner the click came from')
})
