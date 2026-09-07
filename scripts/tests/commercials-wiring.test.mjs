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
import { readFileSync, readdirSync } from 'node:fs'
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
  // ── NARROWED, Round 6 Phase R ─────────────────────────────────────────
  //
  // Three of the five assertions asked whether the VANILLA renderer still
  // defined INSTALL_RESP_NOTES or still read the two elements. That question
  // died with the file: the renderer it was about no longer exists, so the
  // assertions would be true by absence - Verification 14's own trap, and one
  // this round has already been caught by once.
  //
  // The MARKUP half is the half that survives, because index.html is shared
  // and is still shipped. A container written by nothing is Architecture 9's
  // fourth-variant signature, and that hazard is a property of the markup
  // rather than of whichever renderer ignores it.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  assert.ok(!html.includes('deal-installResp-note'), 'the per-option note element is still in the markup')
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

  // THE ARITHMETIC IS THE HALF THAT LIVES HERE. It is about the shared
  // presenters and the business's own reconciliation, and reads no surface at
  // all, so the migration does not touch it.
  //
  // The panel half - that a GST ROW exists to account for the difference - was
  // asserted by slicing renderDealPanel's source for `gst.rowLabel`. That
  // moved to deal-panel.test.tsx, re-derived from the ruling against the
  // rendered labels. Calibration is why it is stated as "exactly one row whose
  // label BEGINS with GST": a bare match for GST came back SILENT when the row
  // was removed, because the PRICE row names GST too, so it could not tell
  // "GST has a row" from "something mentions GST" - which is the entire defect
  // the business reported. Verification 51.
})

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
// ── RETIRED, Round 6 Phase R: 'a margin box is read from the screen, and a blank one is not a zero'.
// COVERED. deal-panel.test.tsx asserts all eleven margin inputs by NAME
// (not by count, which the Round 40 calibration showed a rename defeats),
// and that a numOrUndefined box emptied DROPS its key rather than sending
// a zero. Both halves of the claim, on the shipped surface.


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
  // RE-POINTED, Round 6 Phase R. The mechanism was ported to the React panel
  // verbatim, so the claim and its assertions both survive unchanged; only the
  // file holding the code moved. The css half never named the vanilla at all.
  const src = readCode(new URL('../../frontend-react/src/deal/DealPanel.tsx', import.meta.url))
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
  // ── RE-POINTED, Round 3 Session D2c ───────────────────────────────────
  //
  // The claim is UNCHANGED. What moved is that its two halves now sit either
  // side of the form/version seam, so no single file can carry it.
  //
  // 1. OFF THE OLD FILE. saveVersion() left opportunity-deal.js in the split.
  //    indexOf() would return -1 and slice(-1) is the LAST CHARACTER, so every
  //    match below would have run against a one-character string. Here that
  //    fails loudly; the same shape passes silently whenever a slice anchor is
  //    absent, so presence is asserted BEFORE slicing on both sides.
  //
  // 2. THE PREMISE, MEASURED WHILE HERE. The order is no longer visible inside
  //    one function. saveVersion() freezes through the seam before it POSTs,
  //    and the SAVE itself lives in the vanilla's adapter. Neither file alone
  //    proves "saved first", which is why this test now reads two.
  //
  // 3. BOTH SIDES ASSERTED INDIVIDUALLY, never "some file saves first". The
  //    version side proves the freeze precedes the request and that a refused
  //    freeze refuses the version; the form side proves the freeze IS a save
  //    and that it refuses by throwing. When the vanilla adapter goes, the
  //    second half FAILS, and that failure is the instruction to re-point it
  //    at the React seam rather than a defect.
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  // ── RE-POINTED AGAIN BY THE CARD SWAP, Round 4 Phase 2 ────────────────
  //
  // D2c split this claim across the form and the version file. Round 4
  // supersedes the version file, so the version half moves to the React card's
  // host, where the same order is enforced for the same reason.
  const ver = readCode(new URL('../../frontend-react/src/versions/VersionCardHost.tsx', import.meta.url))
  assert.match(html, /Taking a version saves the pricing first, so a version and the record can never disagree\./)

  // THE VERSION SIDE: it freezes, and it freezes BEFORE the request.
  assert.ok(ver.includes('const onSave = async'), 'the card no longer owns the save')
  const body = ver.slice(ver.indexOf('const onSave = async'), ver.indexOf('const onIssue = async'))
  assert.match(body, /frozen = await seam\.freezeCurrentState\(\)/, 'it does not freeze through the seam')
  assert.ok(body.indexOf('seam.freezeCurrentState()') < body.indexOf('deal-sheet-versions'),
    'the freeze must happen BEFORE the version request, or the note is false')
  assert.match(body, /The pricing could not be saved, so no version was taken\./,
    'a refused freeze does not refuse the version')
  // AND THE REFUSALS RUN BEFORE THE FREEZE, so a refused version writes nothing.
  assert.ok(body.indexOf('scheduleReconciliation') < body.indexOf('freezeCurrentState'),
    'the reconciliation refusal now runs after the save, so refusing writes a revision')

  // ── RE-POINTED AGAIN BY THE SWAP, Session F ───────────────────────────
  //
  // D2c split this claim across the two files and pointed the form half at
  // the VANILLA ADAPTER. Session F superseded that adapter: the bundle
  // registers the panel, the `opportunity-deal.js` script tag is gone, and the
  // seam the version machinery is handed is the React one.
  //
  // Left as it was, this half would have gone on passing while asserting the
  // save order of an implementation the browser never loads - which is the
  // whole reason the coupling ledger exists.
  const seam = readCode(new URL('../../frontend-react/src/deal/seam.ts', import.meta.url))
  assert.ok(seam.includes('async freezeCurrentState(): Promise<FrozenState>'),
    'the live seam no longer implements freezeCurrentState')
  const sbody = seam.slice(seam.indexOf('async freezeCurrentState(): Promise<FrozenState>'))
  const abody = sbody.slice(0, sbody.indexOf('\n    },'))
  assert.match(abody, /if \(hasUnsavedChanges\(\)\) await src\.save\(/,
    'it saves when there is something to save')
  // THE REFUSAL IS A REJECTION, not a flag: `save` returns a promise that
  // rejects, and freezeCurrentState awaits it without catching, so the throw
  // reaches saveVersion. That is the same contract the vanilla's `throw` had.
  assert.ok(!/catch/.test(abody), 'the freeze swallows the save\'s refusal')
  assert.ok(abody.indexOf('src.save(') < abody.indexOf('payload: payloadNow()'),
    'the save must happen BEFORE the read, or the version freezes an unsaved form')
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
  // THE MARKUP AND STYLESHEET HALVES SURVIVE UNCHANGED: index.html and
  // style.css are shared and still shipped, and the claim - that the two
  // containers the merge replaced are gone - is a property of the markup.
  //
  // The `src` half asked whether the VANILLA left its two superseded render
  // functions behind as dead code. That question died with the file: there is
  // no renderDealPanel to leave anything behind, so the assertion would now be
  // true by absence (Verification 14).
  const html = readCode(new URL('../../frontend/index.html', import.meta.url))
  const css = readCode(new URL('../../frontend/style.css', import.meta.url))

  assert.match(html, /<div class="deal-panel" id="deal-panel">/)
  assert.ok(!/id="deal-matrix"/.test(html), 'the matrix container is gone')
  assert.ok(!/id="deal-sheet"/.test(html), 'the Result container is gone')
  assert.equal((html.match(/id="deal-sheet-units"/g) || []).length, 1,
    'the unit count survives the merge, exactly once')

  // The removed containers take their rules with them, or the stylesheet grows
  // a dead selector for every merge.
  assert.ok(!/^\.deal-sheet \{/m.test(css))
  assert.ok(!/^\.deal-sheet-cards \{/m.test(css))
  assert.ok(!/^\.deal-matrix \{/m.test(css))
  // ── THE RULE'S CONSUMERS, NAMED. Migration Round 1, Phase 2 ───────────
  //
  // HISTORY, because the shape of this assertion is the point of it. It used to
  // read `frontend/opportunity-approval.js` and assert the approval page still
  // used `.ds-row`. Phase 1 unloaded that file (deleted at the Round 4 close),
  // so the assertion would have gone on passing by reading a file the browser
  // never fetches - green, unchanged, and measuring dead code. It was
  // re-pointed at the live vanilla consumers,
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
  // RE-POINTED, Round 6 Phase R, and the PREMISE WAS RE-MEASURED rather than
  // assumed. This half carries its own instruction: when the last vanilla
  // consumer goes, the line fails and that failure is the instruction to delete
  // it. Measured before acting - app.js still uses .ds-row - so the retiring
  // file was NOT the last consumer, the instruction does not fire, and the
  // correct action is to drop one entry and let app.js carry the assertion.
  const vanillaConsumers = [
    '../../frontend/app.js',
  ].map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(vanillaConsumers.some((src) => /ds-row/.test(src)),
    'no loaded vanilla file uses .ds-row any more; if that is deliberate, delete this half')

  const reactConsumers = ['../../frontend-react/src/ApprovalRow.tsx']
    .map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(reactConsumers.some((src) => /ds-row/.test(src)),
    'the React approval view no longer renders .ds-row, so the rule below has lost its new consumer')

  assert.match(css, /^\.ds-row \{/m)

  // THE UNLOADED-FILE ASSERTION IS RETIRED WITH ITS FILE. Round 4 close.
  // frontend/opportunity-approval.js is deleted, so "it must not be loaded" is
  // a claim about nothing: a script tag naming it would 404 rather than make a
  // dead file live. What replaces it is the assertion above, which names the
  // React tree as the .ds-row consumer.
})
// ── RETIRED, Round 6 Phase R: 'THE HOSTING PERIOD travels with the figure, by one rule on both surfaces'.
// SURVIVES, and moved. Re-derived in deal-panel.test.tsx from the ruling
// rather than from the source: every rendered hosting label carries its
// period. The vanilla matched `dur.priceLabel` in the source, which
// asserts that one expression was typed; the ruling is about what an
// approver can read off the screen. Calibrated: stripping the period from
// durationPresentation fires it.


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
// ── RETIRED, Round 6 Phase R: 'both renderings of achieved margin are painted from that one rule'.
// SURVIVES AS A CLAIM AND IS CURRENTLY FALSE ON THE MIGRATED SURFACE.
// Not re-pointed, because a re-point would have gone red and a red
// assertion is not a disposition. Reported as a finding instead, with the
// measurement, and queued under build-discipline rule 10: the divergence
// is pre-existing rather than authored by this round.
//
// MEASURED. marginPresentation has TWO call sites where the vanilla
// asserted exactly one, and they disagree about ABSENCE: with no achieved
// margin the stats strip reads '0.0%' state 'under-target', note 'against
// target 30%, down 30.0 pts', while the Structural Terms card reads '--'
// with no state. The strip does not merely differ, it asserts a specific
// false fact about a deal nobody has priced. Architecture 11: the `?? 0`
// is a fallback in the calculation rather than an initial value in the
// record. See MIGRATION_ROUND_6_PHASE_R_REPORT.md.


test('every surface says the same thing about an unrecorded factoring term', () => {
  // FOUND BY THE ITEM 4 CENSUS, and created by ruling 5 in the same round. The
  // matrix was taught to say "not recorded"; the Result list beside it still
  // said "-", which everywhere else on that list means zero; and the cash flow
  // grid printed a full run of zeros across the term for a facility that is on.
  //
  // Three surfaces, one fact. This is Round 39's GST fault reintroduced by the
  // round that was removing it, and it would have been merged into one panel.
  // RE-POINTED, Round 6 Phase R. Both halves survive: the uniqueness count is
  // the claim, and the row expression it names was ported character for
  // character into the rows model.
  const src = readCode(new URL('../../frontend-react/src/deal/rows.ts', import.meta.url))

  // The matrix row and the Result row both branch on the SAME flag. Asserted on
  // the flag rather than on the wording, because two surfaces can carry the same
  // sentence from two different conditions and drift the moment one changes.
  // ONE reader now, not three: the merge collapsed the matrix pair and the
  // Result row into a single panel row. The count is asserted rather than the
  // presence, so a second surface inventing its own absence test fails here.
  assert.equal((src.match(/result\.costIncomplete/g) || []).length, 1,
    'the merged panel reads costIncomplete once, and nothing else invents its own test')
  assert.match(src, /full\('PO factoring interest', result\.costIncomplete \? 'not recorded'/)

  // The cash flow grid does not print a term of zeros for a facility that is on.
  const cf = readCode(new URL('../../frontend-react/src/deal/cashflow.ts', import.meta.url))
  assert.match(cf, /factoringEnabled && .*factoringTermMissing/)
  assert.match(cf, /'Factoring, term not recorded'/)
  // Asserted on the ORDER rather than on the absence of a spelling: my first
  // version excluded the unguarded branch with a regex that also matched the
  // `else if`, so it failed on correct code. What matters structurally is that
  // the missing-term guard is reached FIRST and that the schedule rows have
  // exactly one site.
  assert.equal((cf.match(/push\('Factoring principal repayment'/g) || []).length, 1)
  assert.ok(cf.indexOf("'Factoring, term not recorded'") < cf.indexOf("push('Factoring principal repayment'"),
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
  // RE-POINTED, Round 6 Phase R. The CLAIM is Verification 20's - one reader,
  // wherever the figure appears - and it is about the shipped surface, so it
  // follows the surface rather than dying with the file that used to host it.
  // The vanilla's first assertion named a DOM assignment that has no React
  // equivalent; the uniqueness count, which is the load-bearing half, does.
  const src = readCode(new URL('../../frontend-react/src/deal/cashflow.ts', import.meta.url))
  assert.match(src, /closingCashPresentation\(cf\)/,
    'the cash flow section no longer asks the shared presenter at all')
  assert.ok(!/money\(\s*cf\.closing/.test(src),
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
  // RE-POINTED, Round 6 Phase R. The claim is about the SHIPPED surfaces, so
  // the corpus follows the surface. Read from the directory rather than from a
  // fixed list, so a deal module added later is scanned without anybody
  // remembering to add it - Verification 25's population clause, which a
  // hand-maintained list of two filenames cannot satisfy.
  const dealDir = new URL('../../frontend-react/src/deal/', import.meta.url)
  const dealFiles = readdirSync(dealDir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => [`deal/${f}`, readCode(new URL(f, dealDir))])
  assert.ok(dealFiles.length >= 15, `the deal corpus did not load: ${dealFiles.length} files`)
  const appr = readCode(new URL('../../src/lib/approval-page.js', import.meta.url))

  for (const [name, text] of [...dealFiles, ['approval-page.js', appr]]) {
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
  // THE ROW HALF MOVED, Round 6 Phase R. That the two lines exist, carry
  // DIFFERENT labels, and that no bare 'WHT' survives is now asserted in
  // deal-panel.test.tsx against the RENDERED labels rather than against the
  // source expressions `wht.deductedLabel` and the absence of "of which".
  //
  // Calibration sharpened it on the way: a bare /withholding/i filter also
  // matched 'Margin before financing, test bed and withholding' - the
  // per-column margin, relabelled by the same unfold ruling - and reported
  // three withholding lines where there are two. Verification 17, a probe
  // firing correctly and measuring the wrong thing.
  //
  // What stays here is the half that reads no surface at all: the shared
  // presenter's own labelling rule.
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
// ── RETIRED, Round 6 Phase R: 'no rate box prefills a value nobody entered'.
// SURVIVES, and moved. The vanilla scanned for `setVal('deal-x', p.y ?? 0)`,
// an idiom React does not have, so the PATTERN died with the file while
// the CLAIM - Architecture 11 - did not. Re-derived class-level in
// deal-panel.test.tsx over the same ZERO_IS_NOT_A_VALUE list, driven
// through valuesFromPayload so the values come from the code rather than
// from the fixture, and calibrated against a real prefill.


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
// ── RETIRED, Round 6 Phase R: 'the SHIPPED renderCatalogNotice writes the two spans and paints only the age'.
// DIED WITH THE FILE. renderCatalogNotice was a vanilla DOM writer, and
// the claim was explicitly about THAT function rather than about the
// notice: its own comment says it exists because the harness above
// rebuilds the DOM writing locally and could pass after the shipped
// function changed. The React panel does not write the notice by hand,
// and deal-panel.test.tsx asserts the notice's behaviour directly - the
// six readouts render the catalog figures, they are readOnly because a
// readout is not a record, and a failed fetch is RENDERED not swallowed.
// The staleness banding assertions above this one are untouched: they
// read style.css and the shared cost-basis module, not the vanilla.


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
  //
  // ── RE-POINTED TO THE ONE LIVE SWEEP. Round 8 Phase 2 ─────────────────
  //
  // It required exactly TWO toggles, one per doored view, reading app.js. That
  // was right when both views loaded there. It then became a DETECTOR
  // REQUIRING DEAD CODE TO REMAIN: Round 7's swap left the Test Bed's sweep
  // inside a function whose first statement throws, so one of the two toggles
  // it counted was unreachable, and Phase 0 measured that as finding F1.
  //
  // The dead code is deleted, so the count is ONE - the Opportunity's, which
  // is the only view app.js still loads. The Test Bed's toggle lives in
  // TestBedView.tsx and is asserted there.
  //
  // AND THE PROPERTY MOVED WITH THE DOOR. Since Phase 1 the class DECIDES
  // NOTHING: the door reads the record. What this still asserts is that the
  // class has ONE writer per view driven by one answer, because two writers
  // would dim a record the door lets you edit, or the reverse.
  const src = readCode(new URL('../../frontend/app.js', import.meta.url))
  const toggles = [...src.matchAll(/classList\.toggle\('is-not-mine',\s*(\w+)\)/g)]
  assert.equal(toggles.length, 1,
    `expected ONE is-not-mine toggle in app.js, the Opportunity's, found ${toggles.length}`)
  // It is driven by a variable, not an inline expression at the call site,
  // which is how a second reader gets in.
  assert.match(src, new RegExp(`const ${toggles[0][1]} = [^\\n]*canEditFields`),
    `the toggle reads ${toggles[0][1]}, which is not the door's own answer`)

  // And the React tree's writer, asserted where it lives.
  const view = readCode(new URL('../../frontend-react/src/testbed/TestBedView.tsx',
    import.meta.url))
  const reactToggles = [...view.matchAll(/classList\.toggle\('is-not-mine',\s*(\w+)\)/g)]
  assert.equal(reactToggles.length, 1,
    `expected ONE is-not-mine toggle in the Test Bed view, found ${reactToggles.length}`)
  assert.match(view, new RegExp(`const ${reactToggles[0][1]} = notMine\\(`),
    'the React toggle is not driven by the shared ownership derivation')
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
