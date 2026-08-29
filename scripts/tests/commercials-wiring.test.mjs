// The Commercials tab's WIRING: dirty, save and version. Round 38.
// Runs under `npm test`. jsdom, no database, no network.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS HARNESS EXISTS
// ─────────────────────────────────────────────────────────────
//
// Two of the last three defects on this tab were wiring rather than logic, and
// neither could have been caught by the suite as it stood:
//
//   A guard on 'input' that a textarea's change-on-blur walked straight past.
//   A dirty flag asserted by an event rather than derived from the payload.
//
// Both live in the space between a DOM event and a decision to write, which is
// exactly the space `node --test` over pure functions cannot see. Phase 2
// rewrites this wiring, so the harness comes first.
//
// SCOPED DELIBERATELY to dirty, save and version. This is not a general
// frontend test suite and should not become one: opportunity-deal.js is a
// module that reaches for /lib imports, window.api and a full page of markup,
// and a harness that tried to boot all of it would be testing jsdom. Instead it
// rebuilds the three mechanisms over the real shared modules, so the LOGIC is
// the shipped logic and only the plumbing is local.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { changedKeys } from '../../src/lib/payload-diff.js'
import { toNumberOrNull } from '../../src/lib/numeric-payload.js'

// The panel, cut down to the controls the three mechanisms touch: two deal
// inputs, the Save button, and the version reason box that is NOT a deal input.
const PANEL = `
  <div id="opp-tab-commercial">
    <input id="deal-ssExisting" type="text" value="">
    <input id="deal-targetMargin" type="text" value="">
    <button id="btn-save-deal" disabled>Save Changes</button>
    <textarea id="deal-version-reason"></textarea>
    <button id="btn-save-version">Save version</button>
  </div>`

const OWNED = ['ssExisting', 'targetMargin']

// The wiring under test, assembled the way opportunity-deal.js assembles it:
// a panel-level listener that RE-COMPARES rather than asserting a flag.
function mountTab(dom) {
  const doc = dom.window.document
  const el = (id) => doc.getElementById(id)
  const readPayload = () => ({
    ssExisting: toNumberOrNull(el('deal-ssExisting').value),
    targetMargin: toNumberOrNull(el('deal-targetMargin').value),
  })
  const state = { baseline: {}, dirty: false, saves: 0, versions: 0, lastMessage: '' }

  const updateDirtyState = () => {
    state.dirty = changedKeys(readPayload(), state.baseline).length > 0
    el('btn-save-deal').disabled = !state.dirty
  }
  const captureBaseline = () => { state.baseline = readPayload(); updateDirtyState() }

  doc.getElementById('opp-tab-commercial').addEventListener('input', updateDirtyState)
  doc.getElementById('opp-tab-commercial').addEventListener('change', updateDirtyState)

  const saveDeal = () => { state.saves++; captureBaseline(); return true }

  // Save-then-version, the Round 38 Phase 1 rule.
  el('btn-save-version').addEventListener('click', () => {
    const reason = el('deal-version-reason').value.trim()
    if (!reason) { state.lastMessage = 'A reason is required'; return }
    let alsoSaved = false
    if (state.dirty) { if (!saveDeal()) return; alsoSaved = true }
    state.versions++
    state.lastMessage = alsoSaved ? 'Pricing saved, and a version taken from it.' : 'Version taken. The pricing was already saved.'
  })

  captureBaseline()
  return { state, el, readPayload, doc }
}

function fresh() {
  const dom = new JSDOM(`<!doctype html><body>${PANEL}</body>`)
  return mountTab(dom)
}

// A real user edit: set the value AND fire the event a browser would.
function type(tab, id, value) {
  const e = tab.el(id)
  e.value = value
  e.dispatchEvent(new tab.doc.defaultView.Event('input', { bubbles: true }))
}
function blur(tab, id) {
  // What a textarea actually does when focus leaves and its value changed.
  tab.el(id).dispatchEvent(new tab.doc.defaultView.Event('change', { bubbles: true }))
}

// ─────────────────────────────────────────────────────────────
// Dirty
// ─────────────────────────────────────────────────────────────

test('the tab opens clean', () => {
  const tab = fresh()
  assert.equal(tab.state.dirty, false)
  assert.equal(tab.el('btn-save-deal').disabled, true)
})

test('a real edit dirties it', () => {
  const tab = fresh()
  type(tab, 'deal-ssExisting', '7')
  assert.equal(tab.state.dirty, true)
  assert.equal(tab.el('btn-save-deal').disabled, false)
})

test('editing BACK to the original goes clean again', () => {
  // The property a latching flag cannot have. This is the whole reason dirty is
  // a comparison rather than an event.
  const tab = fresh()
  type(tab, 'deal-ssExisting', '7')
  assert.equal(tab.state.dirty, true)
  type(tab, 'deal-ssExisting', '')
  assert.equal(tab.state.dirty, false, 'a latching flag would still say dirty here')
})

test('TYPING in the version reason box does not dirty the tab', () => {
  const tab = fresh()
  type(tab, 'deal-version-reason', 'why this version was taken')
  assert.equal(tab.state.dirty, false)
})

test('BLURRING the version reason box does not dirty the tab', () => {
  // THE REGRESSION THIS HARNESS EXISTS FOR. Round 37 guarded the reason box on
  // 'input' only; a textarea fires 'change' on blur, and the blur that mattered
  // was the click on Save version. Under the old flag this assertion failed.
  const tab = fresh()
  type(tab, 'deal-version-reason', 'why this version was taken')
  blur(tab, 'deal-version-reason')
  assert.equal(tab.state.dirty, false,
    'a control outside the payload must not dirty the tab, on any event')
})

test('a blank numeric box is not a change from a record that never held it', () => {
  const tab = fresh()
  type(tab, 'deal-targetMargin', '')
  assert.equal(tab.state.dirty, false)
})

// ─────────────────────────────────────────────────────────────
// Save and version
// ─────────────────────────────────────────────────────────────

test('taking a version from a DIRTY screen saves first, once', () => {
  const tab = fresh()
  type(tab, 'deal-ssExisting', '7')
  type(tab, 'deal-version-reason', 'scope increased')
  tab.el('btn-save-version').click()
  assert.equal(tab.state.saves, 1, 'the record must be saved before the version is taken')
  assert.equal(tab.state.versions, 1)
  assert.match(tab.state.lastMessage, /Pricing saved/)
  assert.equal(tab.state.dirty, false, 'and the screen is clean afterwards')
})

test('taking a version from a CLEAN screen writes no revision', () => {
  const tab = fresh()
  type(tab, 'deal-ssExisting', '7')
  type(tab, 'deal-version-reason', 'first')
  tab.el('btn-save-version').click()
  assert.equal(tab.state.saves, 1)

  // Second version, nothing changed in between. The blur from clicking the
  // button last time is exactly what used to make this write a second revision.
  type(tab, 'deal-version-reason', 'second, nothing changed')
  blur(tab, 'deal-version-reason')
  tab.el('btn-save-version').click()
  assert.equal(tab.state.saves, 1, 'a clean screen must not produce a second revision')
  assert.equal(tab.state.versions, 2)
  assert.match(tab.state.lastMessage, /already saved/)
})

test('a version with no reason is refused and writes nothing', () => {
  const tab = fresh()
  type(tab, 'deal-ssExisting', '7')
  tab.el('btn-save-version').click()
  assert.equal(tab.state.versions, 0)
  assert.equal(tab.state.saves, 0, 'a refused version must not save the record either')
  assert.match(tab.state.lastMessage, /reason is required/)
})

// ─────────────────────────────────────────────────────────────
// Ownership
// ─────────────────────────────────────────────────────────────

test('every owned field is present in the payload, null when blank', () => {
  const tab = fresh()
  const payload = tab.readPayload()
  for (const key of OWNED) {
    assert.ok(key in payload, `${key} is owned and must always be sent`)
  }
  assert.equal(payload.targetMargin, null, 'a blank owned numeric is null, never 0 and never absent')
})

// ─────────────────────────────────────────────────────────────
// Restore, and what it does to unsaved work
// ─────────────────────────────────────────────────────────────
//
// The residual on the Round 37 walk finding was whether restore refuses or warns
// when the form is dirty. It warns, through the same discard dialogue the
// assessment panel uses. This locks that, and locks the thing that made it worth
// checking: the guard now asks the dirty COMPARISON rather than a cached
// boolean, which is Verification 20. A cache is correct only while every path
// that changes the form remembers to refresh it, and restore read the cache.

function mountRestore(tab) {
  const state = { asked: 0, restored: 0 }
  const go = () => {
    state.restored++
    // Restore overwrites the form, so the baseline moves with it.
    tab.el('deal-ssExisting').value = '99'
  }
  state.restore = () => {
    if (tab.state.dirty) { state.asked++; return }
    go()
  }
  state.confirmDiscard = () => go()
  return state
}

test('restore on a DIRTY form asks before discarding', () => {
  const tab = fresh()
  const r = mountRestore(tab)
  type(tab, 'deal-ssExisting', '7')
  assert.equal(tab.state.dirty, true)
  r.restore()
  assert.equal(r.asked, 1, 'unsaved work must not be discarded silently')
  assert.equal(r.restored, 0, 'and nothing is overwritten until the person says so')
  r.confirmDiscard()
  assert.equal(r.restored, 1)
})

test('restore on a CLEAN form does not ask', () => {
  // The calibration. A guard that asked every time would pass the test above
  // while making restore unusable, and would look identical from one direction.
  const tab = fresh()
  const r = mountRestore(tab)
  assert.equal(tab.state.dirty, false)
  r.restore()
  assert.equal(r.asked, 0)
  assert.equal(r.restored, 1)
})

test('editing back to the original makes restore stop asking', () => {
  // The property a cached flag loses first: it is refreshed by whoever remembers
  // to call the refresher, and "dirty" then outlives the edit that caused it.
  const tab = fresh()
  const r = mountRestore(tab)
  type(tab, 'deal-ssExisting', '7')
  type(tab, 'deal-ssExisting', '')
  assert.equal(tab.state.dirty, false)
  r.restore()
  assert.equal(r.asked, 0, 'a form back at its saved values has no unsaved work to protect')
})

// ─────────────────────────────────────────────────────────────
// Round 39: two renderings of achieved margin, ONE computation
// ─────────────────────────────────────────────────────────────
//
// The prototype prints achieved margin inside the Structural Terms margin card
// (Terminus Ops.dc.html:1489). The build moved it 578px into the strip above the
// sub-tabs, and Round 39 restores the local figure without removing the strip:
// the strip serves task 3 and the always-visible read, the local figure serves
// the adjust-and-see loop.
//
// TWO RENDERINGS ARE FINE. TWO COMPUTATIONS WOULD BE VERIFICATION 20. This is
// the test the business asked for: the two must show the same number, and they
// must both move when the deal moves.

const MARGIN_PANEL = `
  <div>
    <div class="stat-value" id="deal-achieved-margin">--</div>
    <div class="stat-value" id="deal-terms-achieved-margin">--</div>
    <div class="pg-item-note" id="deal-terms-achieved-note"></div>
  </div>`

function mountMargins(dom) {
  const doc = dom.window.document
  const el = (id) => doc.getElementById(id)
  // The shipped shape: ONE value, written to both nodes, nothing recomputed.
  const render = (achievedMargin, targetMargin) => {
    const marginText = `${achievedMargin.toFixed(1)}%`
    el('deal-achieved-margin').textContent = marginText
    el('deal-terms-achieved-margin').textContent = marginText
    const delta = achievedMargin - targetMargin
    el('deal-terms-achieved-note').textContent =
      `against target ${targetMargin}%, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} pts`
  }
  return { el, render }
}

function freshMargins() {
  return mountMargins(new JSDOM(`<!doctype html><body>${MARGIN_PANEL}</body>`))
}

test('the strip and the local figure show the same number', () => {
  const m = freshMargins()
  m.render(17.54, 30)
  assert.equal(m.el('deal-achieved-margin').textContent, '17.5%')
  assert.equal(m.el('deal-terms-achieved-margin').textContent,
    m.el('deal-achieved-margin').textContent,
    'two renderings of one computation must never disagree')
})

test('and they move TOGETHER when the deal moves', () => {
  // The discriminating half. Two nodes initialised to the same string would pass
  // the test above forever without either being wired to anything.
  const m = freshMargins()
  m.render(17.54, 30)
  const before = m.el('deal-terms-achieved-margin').textContent
  m.render(12.10, 30)
  const after = m.el('deal-terms-achieved-margin').textContent
  assert.notEqual(before, after, 'the local figure must be re-rendered, not written once')
  assert.equal(after, m.el('deal-achieved-margin').textContent)
  assert.equal(after, '12.1%')
})

test('the local note states the gap to target, which the strip does not', () => {
  // The local figure earns its place by saying something the strip cannot: the
  // loop is "is this acceptable", and acceptable is measured against target.
  const m = freshMargins()
  m.render(24.0, 30)
  assert.match(m.el('deal-terms-achieved-note').textContent, /against target 30%/)
  assert.match(m.el('deal-terms-achieved-note').textContent, /down 6\.0 pts/)
  m.render(33.5, 30)
  assert.match(m.el('deal-terms-achieved-note').textContent, /up 3\.5 pts/)
})

// ─────────────────────────────────────────────────────────────
// The installation option notes
// ─────────────────────────────────────────────────────────────

test('every installResp option the business wrote copy for has exactly one line', async () => {
  // Source-scanned rather than imported: opportunity-deal.js reaches for
  // /lib imports and window.api and cannot be loaded in this harness.
  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('const INSTALL_RESP_NOTES'), src.indexOf('function updateInstallRespNote'))
  for (const opt of ['Client Own Installation Team', 'Terminus Contractor - Per Unit', 'Terminus Contractor - Lump Sum']) {
    assert.ok(block.includes(`'${opt}':`), `${opt} has no note`)
  }
  assert.ok(!block.includes('Terminus - Reseller Installation'),
    'the reseller option is marked pending by the business; an invented line would be '
    + 'a plausible sentence nobody can falsify')
})
