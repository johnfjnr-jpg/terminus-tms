// The latches. Round 41 item 7. PURE, plus source scans.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'
import { LATCH_PANELS, NEVER_LATCHABLE, NO_SIGNAL_POSSIBLE, panelSignal, signalSentence, unclaimedMissingKeys } from '../../src/lib/latches.js'
import { ZERO_IS_NOT_A_VALUE } from '../../src/lib/deal-inputs.js'

const HTML = new URL('../../frontend/index.html', import.meta.url)
const JS = new URL('../../frontend/opportunity-deal.js', import.meta.url)
const CSS = new URL('../../frontend/style.css', import.meta.url)

test('every key that can be missing is claimed by exactly one panel', () => {
  // CLAUDE.md Verification 19: the panel list is a category name, so the
  // property is measured. A key nobody claims can never raise a signal, and the
  // button that should have carried it stays silent for a reason no reader can
  // see.
  assert.deepEqual(unclaimedMissingKeys(), [],
    'these keys can be missing and no latch panel claims them')

  const seen = new Map()
  for (const p of LATCH_PANELS) for (const k of p.keys) {
    assert.ok(!seen.has(k), `${k} is claimed by both ${seen.get(k)} and ${p.id}`)
    seen.set(k, p.id)
  }
  assert.equal(seen.size, ZERO_IS_NOT_A_VALUE.length, 'the partition is exact in both directions')
})

test('the strip and the P&L summary are never latchable', () => {
  // Ruled by the business. The strip is the always-visible read; the P&L IS the
  // position the latches exist to help reach, and a screen showing four
  // conclusions with the working hidden is abdication rather than subtraction.
  assert.ok('deal-section-4' in NEVER_LATCHABLE)
  assert.ok(!LATCH_PANELS.some((p) => p.id === 'deal-section-4'))
  // FIVE BECAME FOUR: Units Required and Installation are one group with one
  // button, ruled by the business. They are side by side and latching one
  // without the other would leave half a row.
  assert.equal(LATCH_PANELS.length, 4)
  assert.ok(!LATCH_PANELS.some((p) => p.id === 'deal-section-1'),
    'Units Required has no button of its own')
  assert.ok(!LATCH_PANELS.some((p) => p.id === 'deal-section-2'))
  assert.ok(LATCH_PANELS.some((p) => p.id === 'deal-sections-1-2'))

  const html = readCode(HTML)
  const buttons = [...html.matchAll(/data-latch="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(buttons.sort(), LATCH_PANELS.map((p) => p.id).sort(),
    'the markup and the module must name the same panels')

  // NOT A DISABLED BUTTON. A disabled control is a thing you might enable.
  const s4 = html.slice(html.indexOf('id="deal-section-4"'), html.indexOf('id="deal-section-5"'))
  assert.ok(!/data-latch/.test(s4), 'the summary must have no latch at all')
  const strip = html.slice(html.indexOf('stats-grid stats-grid--deal'), html.indexOf('id="deal-sections-1-2"'))
  assert.ok(!/data-latch/.test(strip))
})

test('RULE 3 FIRES: a missing key, and only where it applies', () => {
  const terms = LATCH_PANELS.find((p) => p.id === 'deal-section-3')
  const full = { targetMargin: 30, warrantyPct: 2, duration: 36, whtPct: 15, gstPct: 8, fxContingency: 0 }
  assert.equal(panelSignal(terms, full).signalled, false, 'nothing missing, nothing to say')

  const { gstPct, ...noGst } = full
  const sig = panelSignal(terms, noGst)
  assert.deepEqual(sig.missing, ['gstPct'])
  assert.equal(sig.signalled, true)
  assert.match(signalSentence(sig, terms), /Structural Terms is hidden and holds 1 value not recorded/)

  // APPLICABILITY, both halves. recoveryMonths applies only to two-phase, so an
  // unset one on a single-phase deal is not a gap. Without this the signal
  // would fire on almost every deal in the system and stop meaning anything.
  const pay = LATCH_PANELS.find((p) => p.id === 'deal-section-5')
  const single = { structure: 'single', factoring: { enabled: false } }
  assert.equal(panelSignal(pay, single).missing.includes('recoveryMonths'), false)
  const twoPhase = { structure: 'twoPhase', factoring: { enabled: false } }
  assert.equal(panelSignal(pay, twoPhase).missing.includes('recoveryMonths'), true)
  // And factoring's two keys only when the facility is on.
  assert.deepEqual(panelSignal(pay, single).missing, [])
  assert.deepEqual(panelSignal(pay, { structure: 'single', factoring: { enabled: true } }).missing.sort(),
    ['factoringRatePct', 'factoringTermMonths'])
})

test('RULE 3 FIRES: an override, on the panel that holds the control', () => {
  const install = LATCH_PANELS.find((p) => p.id === 'deal-sections-1-2')
  const p = { installResp: 'Terminus Contractor - Per Unit' }
  assert.equal(panelSignal(install, p).signalled, false)
  assert.equal(panelSignal(install, p, { marginOverrides: { inSsEx: '' } }).signalled, false,
    'a blank box is the default, not an override')
  assert.equal(panelSignal(install, p, { marginOverrides: { inSsEx: '22' } }).signalled, true)
  assert.equal(panelSignal(install, p, { rateValues: { inAqm: '750' } }).signalled, true)
  // A margin belonging to another panel does not light this one.
  assert.equal(panelSignal(install, p, { marginOverrides: { hwSs: '22' } }).signalled, false)
  assert.match(signalSentence(panelSignal(install, p, { marginOverrides: { inSsEx: '22' } }), install),
    /Installation is hidden and holds 1 override/)
})

test('TWO PANELS ARE SILENT BY CONSTRUCTION, and that is measured', () => {
  // A latch button that cannot carry a signal is not a defect, but it IS a
  // claim: a reader infers a silent button means nothing is missing. Asserted
  // so the list cannot quietly stop being true.
  for (const id of NO_SIGNAL_POSSIBLE) {
    const p = LATCH_PANELS.find((x) => x.id === id)
    assert.ok(p, `${id} is named as silent and is not a latch panel`)
    assert.deepEqual([...p.keys, ...p.marginKeys, ...p.rateKeys], [],
      `${id} is named as silent by construction and holds something that can signal`)
  }
  // THE LIST IS ONE NOW, and that is a consequence of the merge rather than of
  // Units Required gaining anything: its own contribution is still nothing, and
  // what changed is that it no longer has a button of its own to be silently
  // clean on.
  assert.deepEqual([...NO_SIGNAL_POSSIBLE], ['deal-section-6'])

  // And every OTHER panel can signal, or the list is naming the wrong ones.
  for (const p of LATCH_PANELS.filter((x) => !NO_SIGNAL_POSSIBLE.includes(x.id))) {
    assert.ok([...p.keys, ...p.marginKeys, ...p.rateKeys].length > 0,
      `${p.id} is not named as silent and holds nothing that can signal`)
  }
})

test('the latches are session only, in memory, and gone on reload', () => {
  const src = readCode(JS)
  assert.match(src, /const latched = new Set\(\)/)
  // NOT storage. A preference that survives a reload is a state somebody
  // INHERITS, and rule 1 says latching is a subtraction the user makes.
  const block = src.slice(src.indexOf('const latched = new Set()'), src.indexOf('function markDetailCatalogFlag'))
  assert.ok(!/localStorage|sessionStorage|indexedDB/i.test(block))
  assert.ok(!/latch/i.test(src.match(/localStorage\.[a-zA-Z]+\([^)]*\)/g)?.join(' ') ?? ''))
})

test('RULE 4: Show all clears, it does not restore a remembered set', () => {
  const src = readCode(JS)
  const handler = src.slice(src.indexOf("e.target.closest('#latch-all')"))
  const body = handler.slice(0, handler.indexOf('applyLatches'))
  assert.match(body, /latched\.clear\(\)/,
    'clearing rather than restoring is what makes rule 4 structural: there is no remembered set to return to')
  assert.ok(!/remembered|previous|restore/i.test(body))
})

test('RULE 3 is only about a LATCHED-OFF panel', () => {
  // An open panel shows its own gaps, so a marker on its button would be noise
  // competing with the thing it points at.
  const src = readCode(JS)
  assert.match(src, /const signal = off \? panelSignal\(/)
})

test('the latch classes have rules, and the marker introduces no red', () => {
  const css = readCode(CSS)
  for (const cls of ['.latch-row', '.latch-all-row', '.latch ', '.is-latched', '.latch.is-signalled']) {
    assert.ok(css.includes(cls), `${cls} has no rule`)
  }
  // The palette carries ONE accent and does not grow a second.
  const marker = css.slice(css.indexOf('.latch.is-signalled'), css.indexOf('.latch.is-signalled') + 400)
  assert.match(marker, /background: var\(--green\)/)
  assert.ok(!/red|#e0|#f0[0-9a-f]{2}[0-9a-f]{0,2}/i.test(marker))
})
