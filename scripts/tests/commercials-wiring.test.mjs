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
import { gstPresentation, whtPresentation, ratePresentation, durationPresentation, ZERO_IS_NOT_A_VALUE, marginPresentation, closingCashPresentation, buildDealInputs, perMonthFigure } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

// The eleven lines that carry a per-line margin. Named here so the markup and
// the screen's own MARGIN_KEYS are checked against one list rather than each
// other, and a line added to one and not the other fails.
const MARGIN_KEYS_EXPECTED = ['hwSs', 'hwAqm', 'hwHemir', 'hwWarranty',
  'inSsEx', 'inSsNew', 'inAqm', 'inHemir', 'hoSs', 'hoAqm', 'hoHemir']
import { readFileSync } from 'node:fs'
import { readCode, stripHtml } from '../lib/strip-comments.mjs'
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
// The installation option LABELS
// ─────────────────────────────────────────────────────────────
//
// Round 41 removed the four per-option notes and three static paragraphs from
// the Installation section, on the business's ruling. The predecessor of this
// test asserted that every option the picklist offers carries a note. That test
// was correct and is gone with the thing it guarded.
//
// IT IS REPLACED RATHER THAN DELETED, and the reason is the ruling itself: the
// four labels now carry the meaning ALONE. That promotes them from identifiers
// to the only prose on the control, and prose with no test is prose somebody
// rewords in a later round without noticing what it was carrying.
//
// VERBATIM, not a count. CLAUDE.md Verification 33's companion, learned in
// Round 40's calibration: renaming one option leaves the count at four and a
// count-based test passes. These are the four sentences the screen now relies
// on, so the test names them.

const INSTALL_RESP_LABELS = [
  'Client Own Installation Team',
  'Terminus Contractor - Per Unit',
  'Terminus Contractor - Lump Sum',
  'Terminus - Reseller Installation',
]

test('the four installResp labels are exactly as shipped, because they now carry the meaning alone', () => {
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const sel = html.slice(html.indexOf('id="deal-installResp"'))
  const block = sel.slice(0, sel.indexOf('</select>'))
  const options = [...block.matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)]
  assert.deepEqual(options.map(m => m[1]), INSTALL_RESP_LABELS,
    'the installResp picklist values are the four labels the Round 41 removal left carrying the meaning')
  // The VALUE and the TEXT are the same string on this control, which is what
  // lets a label be both the stored value and the explanation. Asserted so a
  // round that reworded the visible text while keeping the value - which would
  // preserve every payload and silently change what the screen says - fails.
  for (const m of options) {
    assert.equal(m[2], m[1], `option value "${m[1]}" and its visible text have diverged`)
  }
})

test('no per-option note mechanism survives the removal', () => {
  // The other half of the ruling. A removal that leaves the renderer behind
  // ships a container written by nothing, which is CLAUDE.md Architecture 9's
  // fourth-variant signature read in reverse.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  assert.ok(!src.includes('INSTALL_RESP_NOTES'), 'INSTALL_RESP_NOTES is still defined')
  assert.ok(!src.includes('deal-installResp-note'), 'the per-option note element is still read')
  assert.ok(!html.includes('deal-installResp-note'), 'the per-option note element is still in the markup')
  assert.ok(!src.includes('deal-install-basis'), 'the catalog rates line is still rendered')
  assert.ok(!html.includes('deal-install-basis'), 'the catalog rates line is still in the markup')
})

// ─────────────────────────────────────────────────────────────
// The accent means AT OR ABOVE TARGET
// ─────────────────────────────────────────────────────────────
//
// A deal 17.5 points below its target rendered in the same large green as one on
// target. In a single-accent palette the accent is the only colour that means
// anything, so spending it on every value made the most important signal on the
// screen say nothing.

function classesFor(achieved, target) {
  // The shipped rule, in the shape renderResults applies it.
  return { onTarget: achieved >= target, underTarget: achieved < target }
}

test('AT OR ABOVE target takes the accent', () => {
  assert.deepEqual(classesFor(35, 35), { onTarget: true, underTarget: false }, 'exactly on target is on target')
  assert.deepEqual(classesFor(41.2, 35), { onTarget: true, underTarget: false })
})

test('BELOW target does not', () => {
  // The case that prompted it: 17.5 against a target of 35.
  assert.deepEqual(classesFor(17.5, 35), { onTarget: false, underTarget: true })
  assert.deepEqual(classesFor(34.99, 35), { onTarget: false, underTarget: true })
})

test('the two states are mutually exclusive and one always applies', () => {
  // A figure with neither class would fall back to whatever the cascade gives
  // it, which is the silent version of the original fault.
  for (const [a, t] of [[0, 0], [0, 35], [35, 0], [17.5, 35], [50, 35]]) {
    const c = classesFor(a, t)
    assert.notEqual(c.onTarget, c.underTarget, `neither or both for achieved ${a} against target ${t}`)
  }
})

// ─────────────────────────────────────────────────────────────
// The Deal Summary bottom line derives from its own rows
// ─────────────────────────────────────────────────────────────

test('price to customer is contract net plus GST, and GST has a row', () => {
  // The business could not reconcile the summary and was right: the whole
  // difference was GST and there was no GST row. Numbers from the capture that
  // prompted it.
  const contractNet = 1818111
  const gstPct = 7
  const gstAmount = Math.round(contractNet * gstPct / 100)
  assert.equal(gstAmount, 127268)
  assert.equal(contractNet + gstAmount, 1945379, 'the figure on screen')

  // The slice is the MERGED panel's rows now. `const rows = [` appears in more
  // than one function in this file, so the slice is anchored on
  // renderDealPanel rather than on the first occurrence, which after the merge
  // was the milestone builder and matched nothing.
  const panel = panelRows()
  assert.match(panel, /gst\.rowLabel/, 'the panel must carry the row its bottom line depends on')
  assert.match(panel, /gst\.priceLabel/)
})

// The one place the merged panel's row array is read, so a test cannot drift
// onto a different function's rows.
function panelRows() {
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const fn = src.slice(src.indexOf('function renderDealPanel('))
  return fn.slice(fn.indexOf('const rows = ['), fn.indexOf('const headRow'))
}

// ─────────────────────────────────────────────────────────────
// The per-line margin model is superseded, and removing a control
// must not delete the data it edited
// ─────────────────────────────────────────────────────────────

test('all eleven per-line margin inputs exist, and exactly eleven', () => {
  // ── THE COUNT IS THE GUARD. Round 40 Phase 3 ────────────────────────
  //
  // Phase 1 removed these and asserted they were gone. Phase 3 returns them ON
  // REQUEST, in the detail panel beside the summary and beside the installation
  // lines, which is the layout's "viewable and editable on request".
  //
  // The assertion inverts and its PURPOSE does not. marginOverrides is in
  // COMMERCIALS_OWNED_KEYS and is sent on every save, and readPayload builds it
  // by reading these boxes: an input lost in a future rearrangement means its
  // key is dropped from the payload, which the record reads as DELETION. So the
  // count is asserted, not merely their presence.
  //
  // Eleven, not seven. Seven is the number that was visible on one sub-tab,
  // which is why both parties said seven twice without counting.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const inputs = [...html.matchAll(/id="deal-margin-([A-Za-z]+)"/g)].map((m) => m[1]).sort()
  assert.equal(inputs.length, 11, `expected 11 margin inputs, found ${inputs.length}: ${inputs.join(', ')}`)
  assert.deepEqual(inputs, [...MARGIN_KEYS_EXPECTED].sort(),
    'the inputs and MARGIN_KEYS must name the same eleven lines')

  // The old read-only display cells are gone with the change, not left beside
  // the inputs as a second reader of the same value.
  assert.equal((html.match(/class="pg-margin"/g) ?? []).length, 0)
})

// ── WHAT THESE FIVE ASSERTIONS DO AND DO NOT PROVE ────────────────────────
//
// They are SOURCE SCANS. They prove the file says the right thing. They do not
// prove the round trip works, and the two directions of error are not
// symmetric.
//
// THE CHEAP DIRECTION: a refactor preserves the behaviour and changes the
// wording, and these fail on a working system. Noisy, obvious, fixed in
// minutes.
//
// THE EXPENSIVE DIRECTION, AND IT IS THE ONE THAT MATTERS: behaviour breaks
// somewhere else while these five lines stay exactly as written, and the scan
// PASSES OVER A BROKEN ROUND TRIP. A source scan cannot see that, by
// construction. Every one of these leaves the scanned lines byte-identical:
//
//   numOrUndefined itself changed to return null for a blank box
//   setVal changed, so populateForm writes nothing
//   MARGIN_KEYS changed, so the loops cover a different set of keys
//   loadedMarginOverrides populated from the wrong source on load
//   an early return added above the populateForm loop
//
// Each of those silently drops or invents overrides, and all five assertions
// below still pass. The behavioural measure that would catch them is a jsdom
// round trip - populate from a record, read back, assert equality - which this
// file already has the harness for and which is queued rather than built.
//
// Calibrated 2026-08-30, five injections, each fired and reverted. The
// calibration proved the detector; it did not widen it.
test('a margin box is read from the screen, and a blank one is not a zero', () => {
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const fn = src.slice(src.indexOf('function readPayload()'), src.indexOf('function readMilestones'))

  // numOrUndefined, not numOrNull: an untouched box must DROP its key rather
  // than write a null, or every deal acquires eleven explicit nulls.
  assert.match(fn, /numOrUndefined\(`deal-margin-\$\{key\}`\)/)
  assert.match(fn, /if \(v !== undefined\) marginOverrides\[key\] = v/)

  // populateForm fills them from the record, so the round trip closes.
  assert.match(src, /setVal\(`deal-margin-\$\{key\}`, loadedMarginOverrides\[key\] \?\? ''\)/)

  // The TARGET is the placeholder, never the value: a blank box prices at
  // target, and a box carrying the target would record an override nobody set.
  assert.match(src, /el\.placeholder = String\(target\)/)
  assert.ok(!/setVal\(`deal-margin-\$\{key\}`, .*target/.test(src),
    'the target must not be written into a margin box as a value')

  // It is still SENT, or the server would see the key disappear entirely.
  assert.match(src, /'targetMargin', 'marginOverrides',/)
})

test('the three payload consumers are untouched', () => {
  // The controls go, the key stays, and everything that reads the PAYLOAD keeps
  // working. Named individually because "nothing else uses it" is the kind of
  // claim this project has been wrong about before.
  const inputs = readCode(new URL('../../src/lib/deal-inputs.js', import.meta.url))
  const appr = readCode(new URL('../../src/lib/approval-page.js', import.meta.url))
  const route = readCode(new URL('../../src/routes/opportunities.js', import.meta.url))

  assert.match(inputs, /const overrides = payload\.marginOverrides \?\? \{\}/)
  assert.match(inputs, /overrides\[key\] \?\? targetMargin/)
  assert.match(appr, /payload\?\.marginOverrides \?\? \{\}/)
  assert.match(route, /payload\.marginOverrides && typeof payload\.marginOverrides === 'object'/)
})

// ─────────────────────────────────────────────────────────────
// Layout and the screen-read findings. Round 41 items 5 and 6
// ─────────────────────────────────────────────────────────────

test('Units Required is one box of four rows with four-figure inputs', () => {
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  assert.match(css, /\.unit-cards \{[^}]*grid-template-columns: minmax\(0, 320px\)/,
    'one column, so the four counts read as a set rather than as four cards')
  assert.match(css, /\.unit-cards \.unit-card input \{[^}]*width: 72px/,
    'four figures, not a full-width box for a two-digit number')
  const box = html.slice(html.indexOf('<div class="unit-cards">'), html.indexOf('</div>', html.indexOf('id="deal-hemir"')))
  assert.equal((box.match(/class="unit-card"/g) || []).length, 4, 'four rows')
})

test('the ruled layout: two side-by-sides, and cash flow is its own section', () => {
  // Round 41 item 5, on the business's ruling superseding the Phase 0 brief.
  // Asserted on the STRUCTURE rather than on the presence of classes, because
  // "the sections exist" was true before the change and after it.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))

  assert.match(html, /<div class="deal-section deal-section--intake" id="deal-sections-1-2">/)
  assert.match(html, /<section class="deal-intake-col" id="deal-section-1">/)
  assert.match(html, /<section class="deal-intake-col" id="deal-section-2">/)
  assert.match(html, /<section class="deal-section" id="deal-section-6">/)
  // Section 5 is no longer a pair, and cash flow is not inside it.
  assert.match(html, /<section class="deal-section" id="deal-section-5">/)
  assert.ok(html.indexOf('id="deal-cashflow-grid"') > html.indexOf('id="deal-section-6"'),
    'the grid must be inside section 6, not left behind in the payment terms pair')

  // ASYMMETRIC ON PURPOSE, which is the brief's own warning made into a rule:
  // the installation text is three paragraphs and two narrow columns crowd it.
  assert.match(css, /\.deal-section--intake \{[^}]*grid-template-columns: minmax\(0, 340px\) minmax\(0, 1fr\)/,
    'equal halves would give the prose ~420px at 1240 to save nothing')
  // ── W-F REVERSED THIS. Round 41, seventh walk ──────────────────────────
  //
  // The 940px cap was written when Cash Flow sat beside something, and the
  // reasoning recorded here was that extra width buys nothing because the grid
  // scrolls. Round 40's reshape put Cash Flow on its own row across the screen
  // and the cap survived the layout it was measured against - Verification 15
  // at the stylesheet, a number that stopped describing the thing it was
  // written for.
  //
  // The superseded reasoning is left in the comment above rather than deleted,
  // so a later reader can tell a premise failed rather than a preference
  // changing.
  assert.match(css, /\.deal-cashflow-col \{ max-width: none; \}/,
    'W-F: Cash Flow renders full width now that it is its own row')

  // The supersession is recorded where the superseded decision lives, or a
  // later reader finds the old one and relives the conflict.
  const phase0 = readFileSync(new URL('../../COMMERCIALS_RESHAPE_PHASE_0_BRIEF.md', import.meta.url), 'utf8')
  assert.match(phase0, /~~\*\*Payment Terms and Cash Flow, side by side\*\*~~/)
  assert.match(phase0, /SUPERSEDED 2026-08-30 BY THE BUSINESS, Round 41/)
})

test('FINDING 3: a year cell may not be given less room than its own glyphs', () => {
  // Measured at 1240 before the fix: `flex: 1 1 0` gave four nowrap numeric
  // columns 216px between them, the three year figures overlapped by 27px each
  // and the head row read "YEAR 1YEAR 2YEAR 3".
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.match(css, /\.ys-cell, \.ys-total \{ flex-shrink: 0; \}/)
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  // And the row it sits on must be able to wrap it away, which needs a real
  // min-width rather than the min-width:0 that let it shrink to nothing.
  assert.match(html, /flex:1 1 340px;min-width:340px" id="deal-year-schedule"/)
  assert.match(html, /id="deal-top-schedule-row"[^>]*flex-wrap:wrap/)
})

test('FINDING 4: the scroll boundary announces itself, and only when there is one', () => {
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  assert.match(css, /\.cashflow-scroll\.is-scrollable \{/,
    'the fade is on a class, so a grid that fits is not dimmed for nothing')
  assert.match(css, /mask-image: linear-gradient\(to right/)
  // A RESIZE OBSERVER, not a check at render time. recompute() runs while the
  // panel is hidden, where clientWidth and scrollWidth are both 0, so the
  // render-time check never fired on the one path a person takes.
  assert.match(src, /new ResizeObserver\(mark\)/)
  assert.match(src, /el\.classList\.toggle\('is-scrollable', el\.scrollWidth > el\.clientWidth \+ 1\)/)
  assert.equal((src.match(/is-scrollable/g) || []).length, 1, 'one site decides it')
})

test('FINDING 5: the note says what the code does, and the code does it', () => {
  // The finding was that Save version sits above Save changes, against the
  // decided save-then-version order. Measured, the order is already enforced:
  // saveVersion() saves first and refuses the version if that save fails.
  //
  // BOTH HALVES, because a note nobody checked is exactly the claim this
  // project keeps removing. The sentence is asserted AND so is the behaviour it
  // describes, so the note cannot outlive the code it reports.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  assert.match(html, /Taking a version saves the pricing first, so a version and the record can never disagree\./)

  const fn = src.slice(src.indexOf('async function saveVersion()'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(body, /if \(isDealFormDirty\(\)\) \{/, 'it saves when there is something to save')
  assert.match(body, /const saved = await saveDeal\(\)/)
  assert.match(body, /if \(!saved\) \{/, 'and refuses the version when that save fails')
  assert.ok(body.indexOf('await saveDeal()') < body.indexOf('deal-sheet-versions'),
    'the save must happen BEFORE the version request, or the note is false')
})

test('the factoring selection is on the Payment Terms line', () => {
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  // ── SUPERSEDED BY L3/L7, 2026-09-04, and the reasoning is kept ─────────
  //
  // Round 41 item 5 put the SELECTION on the Payment Terms line and left the
  // fields below, because "three paragraphs of explanation are not a choice and
  // do not belong on a line of selectors". That was right while the fields
  // carried three paragraphs.
  //
  // L1 moved the paragraphs into hover affordances, which removed the premise:
  // what is left is a switch, two short numbers and a two-option choice, and
  // those ARE one decision. So factoring is one panel with all of it, beside
  // Payment Terms rather than threaded through it. Verification 29 - the
  // decision is re-taken because its premise changed, not re-weighed.
  const panel = html.slice(html.indexOf('id="deal-po-factoring"'), html.indexOf('/deal-payment-region'))
  assert.match(panel, /id="deal-factoring-toggle"/,
    'the switch belongs in the factoring panel with the terms it governs')
  assert.match(panel, /id="deal-factoring-ratePct"/)
  assert.match(panel, /id="deal-factoring-termMonths"/)
  assert.match(panel, /id="deal-factoring-method-toggle"/,
    'all of one decision in one panel, or it is threaded through the screen again')
  assert.equal((html.match(/id="deal-factoring-toggle"/g) || []).length, 1)
  // AND THE GUIDANCE IS KEPT, not dropped: the same words, one hover away.
  assert.match(panel, /reduces margin and brings cash in earlier/)
  assert.match(panel, /Rate multiplied by term is the total financing cost/)
})

// ─────────────────────────────────────────────────────────────
// The merged Deal Sheet panel. Round 41 item 4
// ─────────────────────────────────────────────────────────────

test('TOTAL COST IS THE VISIBLE SUM of the six rows above it', () => {
  // The whole point of the unfold, and the one claim a reader of the panel will
  // actually test by adding a column up. Asserted on the arithmetic rather than
  // on the markup, because a panel that LOOKS additive and is not is worse than
  // the fold it replaced.
  const CAT = { ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
    hoSafesight: 200, hoAqm: 100, hoHemir: 500,
    inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000 }
  const p = { ssExisting: 10, ssNew: 10, aqm: 4, hemir: 2, duration: 36, targetMargin: 30,
    warrantyPct: 2, whtPct: 15, gstPct: 8, grossUp: false, structure: 'single', invoicing: 'annual',
    installResp: 'Terminus Contractor - Per Unit',
    factoring: { enabled: true, ratePct: 1.5, termMonths: 12, method: 'straight' } }
  const r = calculateDeal(buildDealInputs(p, { rates: CAT, testBedCost: 25000 }))
  const g = r.groups
  const months = 36

  // Every cost figure the panel renders, in the order it renders them.
  const sixRows = [
    g.hardwareGroup.rawTotalCost,
    g.installGroup.rawTotalCost,
    g.hostingGroup.rawTotalCost * months,
    r.financeCost ?? 0,
    r.testBedCost,
    r.tax.whtBorne,
  ]
  assert.ok(sixRows.every((v) => v > 0), 'every one of the six must carry a figure, or this proves nothing')
  assert.equal(Math.round(sixRows.reduce((a, b) => a + b, 0)), Math.round(r.totalDealCostAll),
    'Total cost must be the sum of the rows shown above it')

  // And Revenue is the sum of its own three group columns.
  const rev = g.hardwareGroup.rawTotalPrice + g.installGroup.rawTotalPrice + g.hostingGroup.rawTotalPrice * months
  assert.equal(Math.round(rev), Math.round(r.totals.contractNet))

  // Gross margin closes the walk.
  assert.equal(Math.round(r.totals.contractNet - r.totalDealCostAll),
    Math.round(r.totals.contractNet - sixRows.reduce((a, b) => a + b, 0)))
})

test('the panel is ONE panel: the Result block and the matrix are gone', () => {
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))

  assert.match(html, /<div class="deal-panel" id="deal-panel">/)
  assert.ok(!/id="deal-matrix"/.test(html), 'the matrix container is gone')
  assert.ok(!/id="deal-sheet"/.test(html), 'the Result container is gone')
  assert.equal((html.match(/id="deal-sheet-units"/g) || []).length, 1,
    'the unit count survives the merge, exactly once')

  // ONE render function, and the two it replaced are not left behind as dead
  // code that a later reader would take for a live surface.
  assert.equal((src.match(/function renderDealPanel\(/g) || []).length, 1)
  assert.ok(!/function renderDealMatrix\(/.test(src))
  assert.ok(!/function renderDealSheet\(/.test(src))
  assert.ok(!/function computeDealMatrixCols\(/.test(src),
    'the folding helper goes with the fold it existed to perform')

  // The removed containers take their rules with them, or the stylesheet grows
  // a dead selector for every merge.
  assert.ok(!/^\.deal-sheet \{/m.test(css))
  assert.ok(!/^\.deal-sheet-cards \{/m.test(css))
  assert.ok(!/^\.deal-matrix \{/m.test(css))
  // ── THE RULE'S CONSUMERS, NAMED. Migration Round 1, Phase 2 ───────────
  //
  // HISTORY, because the shape of this assertion is the point of it. It used to
  // read `frontend/opportunity-approval.js` and assert the approval page still
  // used `.ds-row`. Phase 1 unloaded that file, so the assertion would have gone
  // on passing by reading a file the browser never fetches - green, unchanged,
  // and measuring dead code. It was re-pointed at the live vanilla consumers,
  // with a comment promising to name the React tree once the React tree rendered
  // ds-row.
  //
  // IT DOES NOW. Phase 2's ApprovalRow.tsx is the migrated `row()`, so the
  // React tree is named here and the promise is closed rather than left
  // describing a tightening that has already happened.
  //
  // BOTH SIDES ARE ASSERTED INDIVIDUALLY, not as "some consumer exists".
  // Verification 14: a check satisfied by either side alone cannot tell you
  // which one went away, and the whole migration is the vanilla side going away
  // one file at a time. When the last vanilla consumer goes, THIS LINE FAILS,
  // and that failure is the instruction to delete it rather than a defect.
  const vanillaConsumers = [
    '../../frontend/app.js',
    '../../frontend/opportunity-deal.js',
  ].map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(vanillaConsumers.some((src) => /ds-row/.test(src)),
    'no loaded vanilla file uses .ds-row any more; if that is deliberate, delete this half')

  const reactConsumers = ['../../frontend-react/src/ApprovalRow.tsx']
    .map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(reactConsumers.some((src) => /ds-row/.test(src)),
    'the React approval view no longer renders .ds-row, so the rule below has lost its new consumer')

  assert.match(css, /^\.ds-row \{/m)

  // AND THE DEAD FILE IS NOT LOADED, so nobody re-points at it by habit.
  const indexLive = stripHtml(readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8'))
  assert.ok(!/opportunity-approval\.js/.test(indexLive),
    'the vanilla approval view is unloaded; a live script tag would make the dead file live again')
})

test('a full-width row carries no group cells, and the dead cells are gone', () => {
  const panel = panelRows()
  // The three deal-level cost rows and the totals are full(), which emits one
  // spanning cell. The old shape hardcoded '-' into two columns under every
  // condition, which the business ruled are not facts: a dash because a value
  // is zero is a fact about the deal, a dash because the code has no expression
  // for it is a hole in a grid.
  for (const label of ['PO factoring interest', 'Test Bed cost, carried from conversion', 'Total cost']) {
    assert.ok(panel.includes(`full('${label}'`), `${label} must be a full-width row`)
  }
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.match(css, /\.dm-row--full \.dm-cell--span \{\s*grid-column: 2 \/ -1;/,
    'the spanning cell needs its rule, or a full-width row renders in one narrow column')
})

test('the merged panel renders every fact the census listed', () => {
  // The census's BOTH-LISTS discipline, applied to the shipped panel: each fact
  // the merged-panel list named must be reachable in the row array. Labels that
  // come from a presentation helper are matched by the helper name, because the
  // wording is that helper's decision and is asserted where it lives.
  const panel = panelRows()
  const MUST = [
    'One-off price, hardware, warranty and installation',
    'dur.priceLabel',
    'Revenue, contract value net',
    'Hardware and warranty cost',
    'Installation cost',
    'dur.costLabel',
    'PO factoring interest',
    'Test Bed cost, carried from conversion',
    'Withholding tax absorbed by Terminus',
    'Withholding tax, grossed up and recovered from the customer',
    'Total cost',
    'Gross margin',
    'Margin before financing, test bed and withholding',
    'Invoice reconciliation, from revenue',
    'wht.grossUpLabel',
    'No gross up, WHT absorbed',
    'gst.rowLabel',
    'gst.priceLabel',
    'wht.deductedLabel',
    'Net receipt after WHT',
  ]
  for (const fact of MUST) assert.ok(panel.includes(fact), `the census listed ${fact} and the panel does not render it`)
  // The four column names.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  for (const c of ['Hardware (USD)', 'Hosting (USD)', 'Installation (USD)', 'Total (USD)']) {
    assert.ok(src.includes(c), `the ${c} column name must survive`)
  }
})

test('the per-column margin is RELABELLED, not left naming a different number', () => {
  // Architecture 9's fourth variant. Before the unfold the row was price minus
  // a cost that already contained financing, test bed and absorbed withholding.
  // After it, a row still called "Margin" would name a different figure with the
  // same word.
  const panel = panelRows()
  assert.match(panel, /Margin before financing, test bed and withholding/)
  assert.ok(!/split\('Margin'/.test(panel) && !/label: 'Margin'/.test(panel),
    'the bare label is what would silently change meaning')
})

test('THE SIGNPOST: it appears exactly when the rows it points at do', () => {
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  assert.match(html, /id="deal-detail-signpost"/)
  assert.match(html, /The four installation lines are priced in the Installation section above\./)
  // A NOTE, NOT A CONTROL: no button, no anchor, no click handler.
  // The whole LINE, not a slice starting at the id: the class attribute is
  // written before the id, so slicing forward from the id could never see it
  // and the first version of this assertion failed on correct markup.
  const line = html.split('\n').find((l) => l.includes('id="deal-detail-signpost"'))
  assert.match(line, /class="field-note hidden"/, 'a note, and hidden until its rows are shown')
  assert.ok(!/<button|<a /.test(line), 'a note, not a control')
  assert.ok(!/deal-detail-signpost[^>]*onclick/.test(html))
  assert.ok(!/getElementById\('deal-detail-signpost'\)[^\n]*addEventListener/.test(src))
  // ONE condition, read where isPerUnit is already read, not a second test.
  assert.match(src, /deal-detail-signpost'\)\?\.classList\.toggle\('hidden', !isPerUnit\)/)
  assert.equal((src.match(/deal-detail-signpost/g) || []).length, 1,
    'a second read of the same condition is a second condition waiting to drift')
})

test('THE HOSTING PERIOD travels with the figure, by one rule on both surfaces', () => {
  // Ruled: a per-month figure says per month ON THE FIGURE OR ITS LABEL, not
  // only on a card title. $5,400 and $194,400 are the same hosting cost one
  // scroll apart, and nothing on either said which period it was in.
  assert.equal(perMonthFigure('$5,400'), '$5,400 / mo')
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))

  // All five per-month figures: three lines and two card totals.
  assert.equal((src.match(/perMonthFigure/g) || []).length, 6,
    'three hosting lines, two card totals, and the import')
  assert.match(src, /pg-total-cost-ho'\)\.textContent = perMonthFigure/)
  assert.match(src, /pg-total-price-ho'\)\.textContent = perMonthFigure/)
  // The hardware card must NOT take it: those are one-off figures.
  assert.ok(!/setRow\(hardwareGroup, '[a-zA-Z]+', [^\n]*perMonthFigure/.test(src))

  // The other surface states the term in the label, and it is the same module's
  // decision rather than a second convention invented at the call site.
  assert.equal(durationPresentation({ duration: 36 }).priceLabel, 'Hosting price over 36 months')
  assert.equal(durationPresentation({}).priceLabel, 'Hosting price, contract duration not recorded')
  assert.match(panelRows(), /dur\.priceLabel/)
  assert.match(panelRows(), /dur\.costLabel/)
})

// ─────────────────────────────────────────────────────────────
// The top strip: one value, one rule, two instances
// ─────────────────────────────────────────────────────────────

test('the accent means at or above target, and it is ONE rule', () => {
  // Round 39 gave the accent a meaning. Round 41 makes it a rule both
  // renderings read, because Round 39 wrote it inline at one of the two call
  // sites and scoped it in the stylesheet to that card.
  assert.equal(marginPresentation(30, { targetMargin: 30 }).state, 'on-target', 'equal is at target')
  assert.equal(marginPresentation(30.1, { targetMargin: 30 }).state, 'on-target')
  assert.equal(marginPresentation(29.9, { targetMargin: 30 }).state, 'under-target')
  assert.equal(marginPresentation(8.1, {}).state, 'under-target', 'against the default target when none is set')
  assert.equal(marginPresentation(8.1, {}).target, 30)

  // The note names both figures and the direction, so the state is legible
  // without the colour. A colour nobody can distinguish is not a signal.
  assert.equal(marginPresentation(8.1, { targetMargin: 30 }).note, 'against target 30%, down 21.9 pts')
  assert.equal(marginPresentation(34.5, { targetMargin: 30 }).note, 'against target 30%, up 4.5 pts')
  assert.equal(marginPresentation(8.14, { targetMargin: 30 }).text, '8.1%')
})

test('THE BOUNDARY: a deal that DISPLAYS at target is at target', () => {
  // Found by the calibration that proved the accent, which is the reason to run
  // one. Switching factoring off on the live deal takes the achieved margin to
  // 29.9963%, and comparing the raw figures put the screen in three-way
  // disagreement with itself: "30.0%", "down 0.0 pts", and no green.
  //
  // One decimal place is the precision the decision is taken at. A rule reading
  // more precision than the screen shows produces a state nobody can account
  // for.
  const boundary = marginPresentation(29.9963, { targetMargin: 30 })
  assert.equal(boundary.text, '30.0%')
  assert.equal(boundary.state, 'on-target', 'a displayed 30.0% against a 30% target is at target')
  assert.equal(boundary.note, 'at target 30%', 'and "up 0.0 pts" is the same non-sentence as "down 0.0 pts"')

  // The rule still bites one displayed step below, or rounding would have
  // become a licence rather than a precision.
  const under = marginPresentation(29.94, { targetMargin: 30 })
  assert.equal(under.text, '29.9%')
  assert.equal(under.state, 'under-target')
  assert.equal(under.note, 'against target 30%, down 0.1 pts')

  // NO DELTA MAY EVER READ 0.0 WITH A DIRECTION. That is the defect stated as
  // the property rather than as the one case that produced it, swept across
  // every hundredth of a point around the boundary.
  for (let i = -200; i <= 200; i++) {
    const p = marginPresentation(30 + i / 100, { targetMargin: 30 })
    assert.ok(!/(up|down) 0\.0 pts/.test(p.note), `${30 + i / 100}: ${p.note}`)
    assert.equal(p.state === 'on-target', Number(p.text.replace('%', '')) >= 30,
      `${30 + i / 100}: the accent must agree with the number on screen`)
  }
})

test('both renderings of achieved margin are painted from that one rule', () => {
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  // One call, one painter, both ids through it.
  assert.equal((src.match(/marginPresentation\(/g) || []).length, 1,
    'a second call would be a second reading of the same value')
  assert.match(src, /paint\(document\.getElementById\('deal-achieved-margin'\)\)/)
  assert.match(src, /paint\(document\.getElementById\('deal-terms-achieved-margin'\)\)/)
  // AND THE OLD INLINE RULE IS GONE, which is the claim that can be false: a
  // moved rule that leaves its original behind is two rules again.
  //
  // ASSERTED ON THE EFFECT, NOT ON THE OLD SPELLING. The first version of this
  // matched the literal `achievedMargin >= target`, and a calibration injecting
  // the same comparison written any other way sailed past it. CLAUDE.md
  // Verification 37: a rule that names a mechanism polices the mechanism. What
  // matters is that ONE place decides the class.
  assert.equal((src.match(/classList\.toggle\('on-target'/g) || []).length, 1,
    'exactly one site may decide the accent, or the rule has been copied again')
  assert.equal((src.match(/classList\.toggle\('under-target'/g) || []).length, 1)
  assert.ok(!/achievedMargin >= /.test(src),
    'the comparison must live in marginPresentation, not at a call site')

  // The stylesheet rule is de-scoped, or the strip would carry the class and
  // no colour. Read through the stripper, so a comment about the selector
  // cannot satisfy this.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.match(css, /^\.stat-value\.on-target \{ color: var\(--green\); \}$/m)
  assert.match(css, /^\.stat-value\.under-target \{ color: var\(--white\); \}$/m)
  assert.ok(!/\.terms-achieved \.stat-value\.on-target/.test(css),
    'the scoped rule must be gone, not shadowed by the de-scoped one')
})

test('every surface says the same thing about an unrecorded factoring term', () => {
  // FOUND BY THE ITEM 4 CENSUS, and created by ruling 5 in the same round. The
  // matrix was taught to say "not recorded"; the Result list beside it still
  // said "-", which everywhere else on that list means zero; and the cash flow
  // grid printed a full run of zeros across the term for a facility that is on.
  //
  // Three surfaces, one fact. This is Round 39's GST fault reintroduced by the
  // round that was removing it, and it would have been merged into one panel.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))

  // The matrix row and the Result row both branch on the SAME flag. Asserted on
  // the flag rather than on the wording, because two surfaces can carry the same
  // sentence from two different conditions and drift the moment one changes.
  // ONE reader now, not three: the merge collapsed the matrix pair and the
  // Result row into a single panel row. The count is asserted rather than the
  // presence, so a second surface inventing its own absence test fails here.
  assert.equal((src.match(/result\.costIncomplete/g) || []).length, 1,
    'the merged panel reads costIncomplete once, and nothing else invents its own test')
  assert.match(panelRows(), /full\('PO factoring interest', result\.costIncomplete \? 'not recorded'/)

  // The cash flow grid does not print a term of zeros for a facility that is on.
  assert.match(src, /cf\.factoringEnabled && cf\.factoringTermMissing/)
  assert.match(src, /'Factoring, term not recorded'/)
  // Asserted on the ORDER rather than on the absence of a spelling: my first
  // version excluded the unguarded branch with a regex that also matched the
  // `else if`, so it failed on correct code. What matters structurally is that
  // the missing-term guard is reached FIRST and that the schedule rows have
  // exactly one site.
  assert.equal((src.match(/push\('Factoring principal repayment'/g) || []).length, 1)
  assert.ok(src.indexOf("'Factoring, term not recorded'") < src.indexOf("push('Factoring principal repayment'"),
    'the missing-term guard must come first, or the zero rows are printed anyway')

  // AND THE FLAG IS REACHABLE, or all four assertions above guard a state that
  // never happens. Verification 9.
  const p = { ssExisting: 10, duration: 36, targetMargin: 30, structure: 'single',
    installResp: 'Client Own Installation Team',
    factoring: { enabled: true, ratePct: 1.5, method: 'straight' } }
  const r = calculateDeal(buildDealInputs(p, { rates: { ssUnitCost: 8000, hoSafesight: 200 } }))
  assert.equal(r.costIncomplete, true)
  assert.equal(r.cashFlow.factoringTermMissing, true)
  const q = { ...p, factoring: { ...p.factoring, termMonths: 12 } }
  assert.equal(calculateDeal(buildDealInputs(q, { rates: { ssUnitCost: 8000, hoSafesight: 200 } })).costIncomplete, false)
})

test('the closing cash position says a negative plainly, and no red', () => {
  // Ruled by the business: no treatment for a negative. The palette introduces
  // no red, and the absence of green already carries below target.
  assert.equal(closingCashPresentation({ rows: [{ cum: 117341 }] }).text, '$117,341')
  assert.equal(closingCashPresentation({ rows: [{ cum: -275556 }] }).text, '-$275,556')
  assert.equal(closingCashPresentation({ rows: [{ cum: 0 }] }).text, '$0')
  // The LAST month, not the first or the worst. Peak exposure is a different
  // figure and it is on the page elsewhere.
  assert.equal(closingCashPresentation({ rows: [{ cum: -900 }, { cum: 500 }] }).value, 500)
  // No months is not a deal that ends at zero.
  assert.equal(closingCashPresentation({ rows: [] }).text, 'not recorded')
  assert.equal(closingCashPresentation(null).value, null)

  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.ok(!/#deal-closing-cash[^{]*\{[^}]*(--red|#[a-f0-9]*[89a-f][0-9a-f]{2}[0-3][0-9a-f]{2})/i.test(css),
    'no accent is introduced for a negative closing cash')

  // ── ROUND 41 W5: AND THE SURVIVING RENDERING CARRIES NO ACCENT EITHER ──
  //
  // The strip cell is gone, so #deal-cashflow-closing is now the ONLY place
  // closing cash appears. It carried `style="color:var(--green)"` inline, which
  // said "good" for every value including -$275,556, and green on this screen
  // means at or above target. An unconditional accent is a treatment, and the
  // ruling was NO treatment.
  //
  // Read from the markup, because the colour was inline rather than in a rule
  // and a stylesheet scan could not have seen it.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const el = html.match(/<span[^>]*id="deal-cashflow-closing"[^>]*>/)
  assert.ok(el, 'the cash flow section no longer renders a closing position')
  assert.ok(!/--green|color:/.test(el[0]),
    `the surviving closing-cash rendering carries a colour: ${el[0]}`)
})

test('closing cash is rendered through ONE reader, wherever it appears', () => {
  // Verification 20, and it was live: renderCashFlow computed its own with
  // money(), which produces no currency symbol at all. Measured before the fix -
  // "117,341" against "$117,341", "-275,556" against "-$275,556", and "--"
  // against "not recorded". Both were invisible while a correctly formatted copy
  // sat in the strip twelve hundred pixels above, and W5 removed that copy.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  assert.match(src, /closingEl\.textContent = closingCashPresentation\(cf\)\.text/,
    'the cash flow section computes its own closing figure')
  // And nothing else formats it by hand.
  assert.ok(!/closingEl\.textContent = money\(/.test(src),
    'a second formatting of closing cash survives')
  assert.equal((src.match(/closingCashPresentation\(/g) || []).length, 1,
    'closing cash is presented in more than one place')
})

test('the strip is FOUR figures, achieved margin promoted alone', () => {
  // Round 41 W5, a REVERSAL of the item 3 ruling that put closing cash here.
  // The business's reason: cash position is a payment-terms question and the
  // strip answers profitability. The superseded assertion is left in the git
  // history rather than in a second test nobody deletes.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const strip = html.slice(html.indexOf('stats-grid stats-grid--deal'))
    .slice(0, html.slice(html.indexOf('stats-grid stats-grid--deal')).indexOf('</div>\n\n'))
  const labels = [...strip.matchAll(/<span class="label">([^<]+)<\/span>/g)].map((m) => m[1])
  assert.deepEqual(labels, ['Achieved margin', 'Contract net', 'Total deal cost', 'Finance cost'],
    'the strip answers profitability, and closing cash is not one of its questions')
  // Promoted ALONE. Asserted on the markup rather than the rendered size,
  // because the class is what the stylesheet reads.
  assert.match(strip, /stat-value stat-value--lead" id="deal-achieved-margin"/)
  assert.equal((strip.match(/stat-value--lead/g) || []).length, 1,
    'exactly one figure carries the lead treatment')
  assert.ok(!/deal-closing-cash/.test(strip), 'the closing cash cell is still in the strip')
  assert.ok(!/stat-value--lead" id="deal-finance-cost"/.test(strip))

  // A MODIFIER, not an edit to .stats-grid, which the Test Bed detail also
  // uses. Architecture: extend, never fork.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  assert.match(css, /\.stats-grid--deal \{/)
  assert.match(css, /grid-template-columns: repeat\(4, 1fr\)/, '.stats-grid itself is unchanged')
  assert.equal((html.match(/class="stats-grid"/g) || []).length, 1,
    'the other stats-grid must not have picked up the deal modifier')
})

// ─────────────────────────────────────────────────────────────
// An absent GST rate is an absence, not a zero
// ─────────────────────────────────────────────────────────────

test('gstPresentation separates a missing rate from a recorded zero', () => {
  // 406 of 467 opportunities carry no gstPct. Priced at 0 the page showed a
  // complete GST-free price to read to a customer, with nothing saying a rate
  // had never been recorded.
  const absent = gstPresentation({})
  assert.equal(absent.recorded, false)
  assert.equal(absent.pct, null)
  assert.match(absent.rowLabel, /not recorded/)
  assert.match(absent.priceLabel, /excludes GST/)
  assert.match(absent.basis, /Not recorded/)

  // A stored null is the same absence. This is what a blank box now saves.
  assert.deepEqual(gstPresentation({ gstPct: null }), absent)

  // AND AN EXPLICIT ZERO IS A DECISION, NOT A GAP: a zero-rated supply is
  // something somebody chose, and it must not read as "not recorded".
  const zero = gstPresentation({ gstPct: 0 })
  assert.equal(zero.recorded, true)
  assert.equal(zero.rowLabel, 'GST at 0%, added to the invoice')
  assert.match(zero.priceLabel, /plus GST/)
  assert.ok(!/not recorded/i.test(zero.rowLabel + zero.priceLabel + zero.basis))

  // Calibration in both directions: the probe must move on a real rate too,
  // otherwise "not recorded" could be every answer it ever gives.
  const nine = gstPresentation({ gstPct: 9 })
  assert.equal(nine.rowLabel, 'GST at 9%, added to the invoice')
  assert.equal(nine.basis, '9% of the invoice base')
  assert.notEqual(nine.rowLabel, zero.rowLabel)
  assert.notEqual(zero.rowLabel, absent.rowLabel)
})

test('the price to customer label always says which side of GST it sits on', () => {
  // Prices are quoted GST-exclusive. "Price to customer" reads as the whole
  // number to anyone who has not been told that, so the label says it.
  for (const p of [{}, { gstPct: null }, { gstPct: 0 }, { gstPct: 9 }]) {
    assert.match(gstPresentation(p).priceLabel, /GST/,
      `silent about GST for ${JSON.stringify(p)}`)
  }
})

test('nothing renders GST from a second read of the payload', () => {
  // Verification 20. Two readers of one value drift, and the drift here is
  // invisible: both are correct in isolation and only one is ever exercised.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const appr = readCode(new URL('../../src/lib/approval-page.js', import.meta.url))

  for (const [name, text] of [['opportunity-deal.js', src], ['approval-page.js', appr]]) {
    const stray = text.split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /payload\.gstPct|p\.gstPct/.test(line))
      .filter(([, line]) => !line.trim().startsWith('//'))
      .filter(([, line]) => !/toNumberOrNull\(p\.gstPct\)/.test(line))
    assert.deepEqual(stray, [], `${name} reads gstPct directly instead of through gstPresentation`)
  }

  // And the calibration: the scan must be able to see one. Verification 17.
  const planted = ['const x = payload.gstPct ?? 0'].filter(l => /payload\.gstPct/.test(l))
  assert.equal(planted.length, 1, 'the scan cannot detect the thing it is scanning for')
})

test('the two withholding lines are labelled as different money', () => {
  // They are equal when gross up is off, which read as deducted twice. With
  // gross up ON they genuinely differ, so they are two rows and the labels have
  // to say which is which.
  const panel = panelRows()
  // "of which" IS GONE, and deliberately: ruling 1 unfolded the memo lines, so
  // absorbed withholding is a full-width row of its own rather than a line
  // living inside the Cost total. The two rows still exist and are still
  // labelled by what they are.
  assert.ok(!/of which/.test(panel), 'the unfold removes the memo lines, not the rows')
  assert.match(panel, /Withholding tax absorbed by Terminus/)
  assert.match(panel, /wht\.deductedLabel/)
  assert.ok(!/'WHT'/.test(panel), 'the bare "WHT" label is what made them look like one number twice')

  // The label still names the rate when there IS one, which the indirection
  // above could otherwise have quietly dropped.
  assert.equal(whtPresentation({ whtPct: 15 }).deductedLabel,
    'Withholding tax at 15%, deducted by the customer')
})

// ─────────────────────────────────────────────────────────────
// Every rate, not just the one the capture happened to show
// ─────────────────────────────────────────────────────────────

test('withholding tax gets the same absence treatment as GST', () => {
  // WHT reaches MARGIN through whtBorne rather than only the price line, so an
  // absent rate understates a cost, not only an invoice.
  const absent = whtPresentation({})
  assert.equal(absent.recorded, false)
  assert.equal(absent.deductedLabel, 'Withholding tax, not recorded')
  assert.equal(absent.value, 'not recorded')
  assert.match(absent.grossUpLabel, /rate not recorded/)

  const zero = whtPresentation({ whtPct: 0 })
  assert.equal(zero.recorded, true, 'an explicit zero is a decision, not a gap')
  assert.equal(zero.deductedLabel, 'Withholding tax at 0%, deducted by the customer')
  assert.ok(!/not recorded/i.test(zero.deductedLabel + zero.grossUpLabel + zero.basis))

  assert.notEqual(whtPresentation({ whtPct: 15 }).deductedLabel, zero.deductedLabel)
})

test('zero contract months is an unset field, not a zero-month contract', () => {
  // The business's correction to my scoping. duration is a COUNT and belongs
  // with the rates, because nobody enters zero months on purpose, and hosting
  // revenue over a zero term is zero - so a prefilled 0 prices the deal.
  const absent = durationPresentation({})
  assert.equal(absent.recorded, false)
  assert.equal(absent.months, null)
  assert.match(absent.priceLabel, /contract duration not recorded/)
  assert.match(absent.costLabel, /contract duration not recorded/)
  assert.equal(absent.value, 'not recorded')

  const set = durationPresentation({ duration: 36 })
  assert.equal(set.priceLabel, 'Hosting price over 36 months')
  assert.equal(set.costLabel, 'Hosting cost over 36 months')
  assert.notEqual(set.priceLabel, absent.priceLabel)

  // And the unit counts are deliberately NOT here.
  for (const k of ['ssExisting', 'ssNew', 'aqm', 'hemir']) {
    assert.ok(!ZERO_IS_NOT_A_VALUE.includes(k), `${k} must stay prefillable: a deal with none of them is a real deal`)
  }
  assert.ok(ZERO_IS_NOT_A_VALUE.includes('duration'))
})

test('one reader decides for every rate, and it is the same one', () => {
  // Verification 20 at the level of the mechanism rather than one value: gst
  // and wht must not be two implementations of "is this recorded".
  for (const key of ['gstPct', 'whtPct', 'fxContingency', 'targetMargin', 'warrantyPct']) {
    assert.equal(ratePresentation({}, key).recorded, false, `${key} absent`)
    assert.equal(ratePresentation({ [key]: 0 }, key).recorded, true, `${key} explicit zero`)
    assert.equal(ratePresentation({ [key]: 7 }, key).pct, 7, `${key} value`)
    assert.match(ratePresentation({}, key).basis, /Not recorded/)
  }
})

test('no rate box prefills a value nobody entered', () => {
  // THE WRITER HALF. A display that says "not recorded" beside a form that
  // fills in 0 is a display that is right until somebody uses the screen, and
  // the writer wins on the first click.
  //
  // Class-level, not three instance checks: the next RATE key added to this
  // screen is the one nobody would think to check.
  //
  // SCOPED BY THE BUSINESS'S TEST, not by type: whether zero is a value a
  // person would deliberately enter. That question is answered once, in
  // ZERO_IS_NOT_A_VALUE, and read from there rather than restated here
  // (Verification 20). My own first split was rates versus counts, which put
  // duration on the wrong side: it is a count, and zero contract months is not
  // a deal.
  //
  // ssExisting, ssNew, aqm and hemir still prefill 0 and are deliberately NOT
  // in the list: a deal with no AQ sensors is a real deal and its zero is not
  // a lie.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  assert.ok(ZERO_IS_NOT_A_VALUE.length >= 7, 'the list did not import, so this test is measuring nothing')
  const guarded = new Set(ZERO_IS_NOT_A_VALUE.map((k) => `deal-${k}`))

  const bad = [...src.matchAll(/setVal\('(deal-[A-Za-z]+)',\s*p\.[A-Za-z.]+\s*\?\?\s*0\)/g)]
    .map((m) => m[1]).filter((id) => guarded.has(id))
  assert.deepEqual(bad, [], `these boxes prefill a zero nobody would have entered: ${bad.join(', ')}`)

  // Calibration: the scan must be able to see one. Verification 17.
  const planted = [...("setVal('deal-duration', p.duration ?? 0)")
    .matchAll(/setVal\('(deal-[A-Za-z]+)',\s*p\.[A-Za-z.]+\s*\?\?\s*0\)/g)]
    .map((m) => m[1]).filter((id) => guarded.has(id))
  assert.deepEqual(planted, ['deal-duration'], 'the scan cannot detect the thing it is scanning for')
})

// ─────────────────────────────────────────────────────────────
// THE COST BASIS DATA LINE. Round 41, decision 3
// ─────────────────────────────────────────────────────────────
//
// The line naming the batch and its effective date has been on this screen
// since Round 36 and HAD NO DETECTOR OF ANY KIND. Round 41 reshaped it into a
// data line, moved the staleness bands onto their own span and corrected one of
// the band colours, and none of that could have failed a test.
//
// CLAUDE.md Verification 9, broadened at the Round 40 close: a detector that has
// never fired is an assertion, not a control. This one is written to fire, and
// the calibration is in the round report.
//
// THE BANDS ARE EXERCISED WITH FOUR DIFFERENT AGES, which is Verification 24
// stated for a band rather than a parameter: every batch in the live catalog is
// four days old, so `current` is the only band any run has ever produced. A
// display tested only at its default is a display nobody has seen.
//
// The logic under test is the shipped logic: stalenessBand and ageInDays are
// imported from src/lib/cost-basis.js, and only the DOM writing is rebuilt here,
// in the same shape renderCatalogNotice applies it.

import { stalenessBand, ageInDays } from '../../src/lib/cost-basis.js'

function basisLine(batches, asOf) {
  const dom = new JSDOM(`<!doctype html><p class="deal-basis" id="n">
    <span class="deal-basis-label">Cost basis</span>
    <span class="deal-basis-value" id="v"></span>
    <span class="deal-basis-age" id="a"></span></p>`)
  const d = dom.window.document
  const value = d.getElementById('v'), age = d.getElementById('a')
  const list = Object.values(batches)
  if (!list.length) {
    value.textContent = 'not recorded'
    value.classList.add('deal-basis-absent')
    age.textContent = ''
    age.className = 'deal-basis-age'
    return { value, age }
  }
  value.classList.remove('deal-basis-absent')
  const dates = [...new Set(list.map(b => b.effective_from))]
  const names = [...new Set(list.map(b => b.batch_label))]
  value.textContent = dates.length === 1 && names.length === 1
    ? `${names[0]} · effective ${dates[0]}`
    : `${list.length} current batches · effective ${dates.slice().sort()[0]} to ${dates.slice().sort()[dates.length - 1]}`
  const ages = list.map(b => ageInDays(b.effective_from, asOf)).filter(n => Number.isFinite(n))
  const band = stalenessBand(ages.length ? Math.max(...ages) : null)
  age.textContent = band.band === 'current' ? '' : band.statement
  age.className = 'deal-basis-age'
  if (band.band !== 'current') age.classList.add(`deal-catalog-${band.band}`)
  return { value, age, band: band.band }
}

const ONE = { safesight: { batch_label: 'Initial catalog', effective_from: '2026-08-27' } }

test('the cost basis names the batch and its effective date as one value', () => {
  const { value } = basisLine(ONE, '2026-08-31')
  assert.equal(value.textContent, 'Initial catalog · effective 2026-08-27')
  assert.ok(!value.classList.contains('deal-basis-absent'))
})

test('a current basis says nothing about its age, and the value still reads', () => {
  // A line that reassures on every normal deal is a line people stop reading.
  const { value, age, band } = basisLine(ONE, '2026-08-31')
  assert.equal(band, 'current')
  assert.equal(age.textContent, '')
  assert.equal(age.className, 'deal-basis-age', 'no band class on a current basis')
  assert.match(value.textContent, /Initial catalog/, 'the basis is stated whatever the band')
})

test('each staleness band paints its OWN span, never the batch name', () => {
  // The defect this replaces: one string carried both facts, so the band's
  // colour was applied to the batch name too. Verification 20 at display level.
  // Ages derived, not guessed. 2026-08-27 + 217 days is ageing, + 492 is stale.
  // The first draft used 2027-01-01 for ageing, which is 127 days and lands in
  // `current`: the test failed loudly rather than passing on the wrong band,
  // which is the only reason it is worth naming here.
  for (const [asOf, expected] of [['2027-04-01', 'ageing'], ['2028-01-01', 'stale']]) {
    const { value, age, band } = basisLine(ONE, asOf)
    assert.equal(band, expected)
    assert.ok(age.classList.contains(`deal-catalog-${expected}`), `${expected} band class is on the age span`)
    assert.equal(value.className, 'deal-basis-value', `the ${expected} band did not touch the value`)
    assert.match(age.textContent, /cost basis/i, `the ${expected} band states itself in words`)
  }
})

test('an undated batch is not treated as current', () => {
  // cost-basis.js: "an unknown age is not a current one". It had no colour rule
  // at all before this round, so it rendered quieter than an ageing basis.
  const { age, band } = basisLine({ safesight: { batch_label: 'Unlabelled', effective_from: null } }, '2026-08-31')
  assert.equal(band, 'undated')
  assert.ok(age.classList.contains('deal-catalog-undated'))
  assert.match(age.textContent, /age is unknown/)
})

test('no batch at all SAYS so, rather than rendering an empty line', () => {
  // Verification 20's addendum. An empty line reads as one that has not loaded.
  const { value, age } = basisLine({}, '2026-08-31')
  assert.equal(value.textContent, 'not recorded')
  assert.ok(value.classList.contains('deal-basis-absent'))
  assert.equal(age.textContent, '')
})

test('the shipped stylesheet gives every band a rule, and none of them is the accent', () => {
  // Read through the comment stripper, CLAUDE.md Verification 39: the block
  // above these rules discusses --green at length, and a raw scan for it would
  // be satisfied by the prose explaining why it is gone.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  for (const band of ['ageing', 'stale', 'undated']) {
    assert.match(css, new RegExp(`\\.deal-basis-age\\.deal-catalog-${band}\\s*\\{[^}]*color:`),
      `the ${band} band has no colour rule`)
  }
  const stale = css.match(/\.deal-basis-age\.deal-catalog-stale\s*\{([^}]*)\}/)[1]
  assert.ok(!/--green/.test(stale),
    'stale is painted in the accent, which on this screen means at or above target')
  assert.ok(!/\.deal-catalog-stale\s*\{[^}]*--green/.test(css),
    'a rule somewhere still paints a stale basis green')
})

test('the SHIPPED renderCatalogNotice writes the two spans and paints only the age', () => {
  // THE GAP THIS CLOSES, stated because it is Verification 20 inside a test
  // file. Every assertion above runs against a local rebuild of the DOM writing,
  // so the harness and renderCatalogNotice are two readers of one design and
  // the harness could go on passing after the shipped function changed.
  //
  // This one reads the shipped function. It is a source scan and therefore
  // weaker than executing it, which this harness cannot do; what it can do is
  // refuse the specific drifts that would make the tests above meaningless.
  const src = readCode(new URL('../../frontend/opportunity-deal.js', import.meta.url))
  const fn = src.slice(src.indexOf('function renderCatalogNotice'), src.indexOf('function escapeSheet'))
  assert.ok(fn.length > 200, 'renderCatalogNotice was not located in the source')
  assert.ok(fn.includes("getElementById('deal-catalog-basis')"), 'the value span is not read')
  assert.ok(fn.includes("getElementById('deal-catalog-age')"), 'the age span is not read')
  assert.match(fn, /age\.classList\.add\(`deal-catalog-\$\{band\.band\}`\)/,
    'the band class is not added to the age span')
  assert.ok(!/notice\.classList\.toggle\('deal-catalog/.test(fn),
    'a band class is still painted onto the whole notice, which would colour the batch name')
  assert.match(fn, /age\.textContent = band\.band === 'current' \? '' :/,
    'a current basis no longer renders an empty age')
  assert.ok(fn.includes("value.textContent = 'not recorded'"), 'the no-batch path no longer says so')
})

// ─────────────────────────────────────────────────────────────
// ANOTHER USER'S RECORD IS READ ONLY AT LOAD. Round 41 W1
// ─────────────────────────────────────────────────────────────
//
// A non-owner selected seven assessment scores, typed seven reasons, and was
// refused per row at Record with "This record belongs to another user."
// Ownership was known at load the whole time and nothing on the screen used it.

test('the read-only banner quotes the server refusal WORD FOR WORD', () => {
  // Two copies of one sentence, and the client cannot import from src/. So the
  // duplication is proven equal rather than asserted equal by a comment, which
  // is what CLAUDE.md Verification 20 says the phrase "kept identical to" marks.
  const server = readCode(new URL('../../src/lib/write-errors.js', import.meta.url))
  const client = readCode(new URL('../../frontend/app.js', import.meta.url))
  const m = server.match(/OWNERSHIP_REFUSAL\s*=\s*\n?\s*'([^']+)'/)
  assert.ok(m, 'OWNERSHIP_REFUSAL was not found in write-errors.js')
  assert.ok(client.includes(`'${m[1]}'`),
    `the client banner does not carry the server's exact refusal:\n  server: ${m[1]}`)
})

test('the read-only class is applied from ONE value, the way the freeze is', () => {
  // The shape is the claim. Eleven controls each testing for themselves is the
  // second-reader shape, and the control that forgot to ask is the editable
  // field on a record you do not own.
  const src = readCode(new URL('../../frontend/app.js', import.meta.url))
  assert.match(src, /classList\.toggle\('is-not-mine',\s*notMine\)/,
    'the view does not carry a single is-not-mine toggle')
  assert.match(src, /const notMine = [^\n]*owner_id[^\n]*\n?[^\n]*currentSession/,
    'notMine is not derived from the record owner and the current session')
  // Read through the stripper, Verification 39: the comment above that line
  // discusses owner_id and currentSession at length.
  // ONE PLACE PER VIEW, which is what "one value" means here and is what the
  // first version of this assertion got wrong. It required exactly one
  // occurrence in the file; ruling G then applied the same mechanism to Test
  // Bed and it failed - correctly reporting a change, incorrectly describing
  // the rule. The property is that a VIEW's read-only state is decided once,
  // not that only one view can have one.
  const toggles = [...src.matchAll(/classList\.toggle\('is-not-mine',\s*(\w+)\)/g)]
  assert.equal(toggles.length, 2,
    `expected one is-not-mine toggle for the Opportunity and one for the Test Bed, found ${toggles.length}`)
  // And each is driven by a variable, not by an inline expression repeated at
  // the call site, which is how a second reader gets in.
  for (const m of toggles) {
    assert.match(src, new RegExp(`const ${m[1]} = [^\\n]*owner_id`),
      `the is-not-mine toggle reads ${m[1]}, which is not derived from a record owner`)
  }
})

test('the stylesheet makes an unowned record non-interactive, not merely dim', () => {
  // Dimming alone is what the walk already had: everything looked slightly grey
  // and every control still accepted input. pointer-events is the part that
  // stops the work being done.
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))
  const rule = css.match(/\.is-not-mine input[^{]*\{([^}]*)\}/)
  assert.ok(rule, 'no .is-not-mine rule covers inputs')
  assert.match(rule[1], /pointer-events:\s*none/,
    'inputs on an unowned record are dimmed but still accept input')
  for (const el of ['input', 'textarea', 'select']) {
    assert.match(css, new RegExp(`\\.is-not-mine ${el}[ ,]`), `${el} is not covered by the read-only rule`)
  }
})
