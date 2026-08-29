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
import { gstPresentation, whtPresentation, ratePresentation, durationPresentation, ZERO_IS_NOT_A_VALUE } from '../../src/lib/deal-inputs.js'

// The eleven lines that carry a per-line margin. Named here so the markup and
// the screen's own MARGIN_KEYS are checked against one list rather than each
// other, and a line added to one and not the other fails.
const MARGIN_KEYS_EXPECTED = ['hwSs', 'hwAqm', 'hwHemir', 'hwWarranty',
  'inSsEx', 'inSsNew', 'inAqm', 'inHemir', 'hoSs', 'hoAqm', 'hoHemir']
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
  // EVERY option the picklist offers, read from index.html rather than listed
  // here, so a fifth option added to the markup fails this test instead of
  // shipping without a note.
  const html = readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8')
  const sel = html.slice(html.indexOf('id="deal-installResp"'))
  const options = [...sel.slice(0, sel.indexOf('</select>')).matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])
  assert.equal(options.length, 4, `the picklist offers ${options.length} options`)
  for (const opt of options) {
    assert.ok(block.includes(`'${opt}':`), `${opt} is offered by the picklist and has no note`)
  }
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

  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const matrix = src.slice(src.indexOf('const rows = ['), src.indexOf('const headRow'))
  assert.match(matrix, /label: gst\.rowLabel/,
    'the summary must carry the row its bottom line depends on')
  assert.match(matrix, /label: gst\.priceLabel/)
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
  const html = readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8')
  const inputs = [...html.matchAll(/id="deal-margin-([A-Za-z]+)"/g)].map((m) => m[1]).sort()
  assert.equal(inputs.length, 11, `expected 11 margin inputs, found ${inputs.length}: ${inputs.join(', ')}`)
  assert.deepEqual(inputs, [...MARGIN_KEYS_EXPECTED].sort(),
    'the inputs and MARGIN_KEYS must name the same eleven lines')

  // The old read-only display cells are gone with the change, not left beside
  // the inputs as a second reader of the same value.
  assert.equal((html.match(/class="pg-margin"/g) ?? []).length, 0)
})

test('a margin box is read from the screen, and a blank one is not a zero', () => {
  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
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
  const inputs = readFileSync(new URL('../../src/lib/deal-inputs.js', import.meta.url), 'utf8')
  const appr = readFileSync(new URL('../../src/lib/approval-page.js', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../../src/routes/opportunities.js', import.meta.url), 'utf8')

  assert.match(inputs, /const overrides = payload\.marginOverrides \?\? \{\}/)
  assert.match(inputs, /overrides\[key\] \?\? targetMargin/)
  assert.match(appr, /payload\?\.marginOverrides \?\? \{\}/)
  assert.match(route, /payload\.marginOverrides && typeof payload\.marginOverrides === 'object'/)
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
  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const appr = readFileSync(new URL('../../src/lib/approval-page.js', import.meta.url), 'utf8')

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
  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
  const matrix = src.slice(src.indexOf('const rows = ['), src.indexOf('const headRow'))
  assert.match(matrix, /of which withholding tax absorbed by Terminus/)
  assert.match(matrix, /label: wht\.deductedLabel/)
  assert.ok(!/label: 'WHT'/.test(matrix), 'the bare "WHT" label is what made them look like one number twice')

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
  const src = readFileSync(new URL('../../frontend/opportunity-deal.js', import.meta.url), 'utf8')
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
