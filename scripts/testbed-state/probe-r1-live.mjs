// ── R1 LIVE: the lift and the card move, in a real browser ───────────────
//
// jsdom proved the store and the move. This proves the SCREEN: that the cards
// are visible on Commercials with real geometry, absent from Reference, and
// that a draft typed on one tab survives a trip to the other in the actual
// application rather than in a harness.
//
// EVERY MEASUREMENT PRECEDES EVERY CAPTURE, and the captures are of the PAGE,
// never of the element whose geometry is the claim: Puppeteer suppresses the
// scrollbar to take an element capture and does not put it back, so a probe
// that photographs its subject and then measures it is reading an instrument
// it has already perturbed (Verification 4's capture clause).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r1-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/testbed-state/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'tbst1'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1400 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)

  // WAIT ON RENDERED STATE THE OLD SURFACE COULD NOT SATISFY. The counterfactual
  // for "the summary card exists" is that it exists either way, so this waits
  // on the card carrying TEXT, which only a settled render produces.
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-summary"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })

  // ── Reference: the cards must be GONE ──────────────────────────────────
  const onRef = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return {
      panel: !!v.querySelector('[data-testid="testbed-panel"]'),
      sensors: v.querySelectorAll('[data-testid="tb-card-sensors"]').length,
      // RE-POINTED 2026-09-15, L3: the one flat Commercials card is three
      // titled rate cards now, so every reading below takes the first of them.
      costs: v.querySelectorAll('[data-testid="tb-card-rates-hardware"]').length,
    }
  })
  check(onRef.panel, 'the Reference panel rendered, so its emptiness is a measurement')
  check(onRef.sensors === 0, `Sensor Counts is gone from Reference (found ${onRef.sensors})`)
  check(onRef.costs === 0, `the Commercials card is gone from Reference (found ${onRef.costs})`)
  await p.screenshot({ path: `${OUT}r1-reference.png`, fullPage: true })

  // ── Commercials: present, visible, and INSIDE the tab ──────────────────
  await p.click('[data-testid="tb-tab-btn-commercials"]')
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-rates-hardware"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })

  const onComm = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const one = (t) => v.querySelector(`[data-testid="${t}"]`)
    const n = (t) => v.querySelectorAll(`[data-testid="${t}"]`).length
    const tab = one('tb-tab-commercials')
    const sensors = one('tb-card-sensors'), costs = one('tb-card-rates-hardware')
    const rs = sensors?.getBoundingClientRect(), rc = costs?.getBoundingClientRect()
    const input = one('display-ssUnitCost')?.getBoundingClientRect()
    return {
      sensors: n('tb-card-sensors'), costs: n('tb-card-rates-hardware'),
      breakdown: n('tb-cost-breakdown'), rowCount: n('display-ssUnitCost'),
      // A RELATIONSHIP, not a CSS property: the cards hang off the tab pane.
      sensorsInTab: !!(tab && sensors && tab.contains(sensors)),
      costsInTab: !!(tab && costs && tab.contains(costs)),
      sensorsBox: rs ? [Math.round(rs.width), Math.round(rs.height)] : null,
      costsBox: rc ? [Math.round(rc.width), Math.round(rc.height)] : null,
      rowBox: input ? [Math.round(input.width), Math.round(input.height)] : null,
      rowTop: input ? Math.round(input.top) : null,
      // THE CLAIM IS A RELATIONSHIP BETWEEN TWO ELEMENTS, not a CSS property.
      // `.pg-card` has a border and no margin, so two in a bare container
      // merge into one box - and `display: grid` or a gap value being correct
      // says nothing about whether these two particular cards are separated.
      cardGap: (rs && rc)
        ? Math.round(Math.max(rc.top - rs.bottom, rs.top - rc.bottom,
                              rc.left - rs.right, rs.left - rc.right))
        : null,
      viewportH: window.innerHeight,
    }
  })
  console.log(`  ${JSON.stringify(onComm)}`)
  check(onComm.sensors === 1, `exactly one Sensor Counts card on Commercials (${onComm.sensors})`)
  check(onComm.costs === 1, `exactly one Commercials card on Commercials (${onComm.costs})`)
  check(onComm.breakdown === 1, `the cost breakdown travelled with it (${onComm.breakdown})`)
  check(onComm.sensorsInTab && onComm.costsInTab, 'both cards are INSIDE the Commercials pane, not merely in the document')
  // PRESENCE IS NOT LEGIBILITY. A card present at zero width is the defect
  // every presence assertion passes on.
  check((onComm.sensorsBox?.[0] ?? 0) > 200 && (onComm.sensorsBox?.[1] ?? 0) > 20,
    `Sensor Counts has real size ${JSON.stringify(onComm.sensorsBox)}`)
  check((onComm.costsBox?.[0] ?? 0) > 200 && (onComm.costsBox?.[1] ?? 0) > 20,
    `the Commercials card has real size ${JSON.stringify(onComm.costsBox)}`)
  check((onComm.rowBox?.[0] ?? 0) > 100, `the cost rows render at usable width ${JSON.stringify(onComm.rowBox)}`)
  // CONFIRM THE ELEMENT IS IN THE CAPTURE before the image counts as evidence.
  check((onComm.cardGap ?? -1) >= 8,
    `the two cards are separated, not merged into one box (gap ${onComm.cardGap}px)`)
  check(onComm.rowTop !== null && onComm.rowTop < 4000,
    `the cost rows are within the captured page (top ${onComm.rowTop})`)
  await p.screenshot({ path: `${OUT}r1-commercials.png`, fullPage: true })

  // ── The payoff: a draft typed here survives the round trip ─────────────
  await p.click('[data-testid="display-ssUnitCost"]')
  await p.waitForSelector('[data-testid="input-ssUnitCost"]', { timeout: 10000 })
  // A REAL KEYBOARD, because React's value tracker dedupes a synthetic write
  // and the DOM then shows text the component never received.
  await p.click('[data-testid="input-ssUnitCost"]', { clickCount: 3 })
  await p.type('[data-testid="input-ssUnitCost"]', '4321')
  const typed = await p.$eval('[data-testid="input-ssUnitCost"]', (e) => e.value)
  check(typed === '4321', `the edit landed before the trip (read "${typed}")`)

  await p.click('[data-testid="tb-tab-btn-reference"]')
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return !!v?.querySelector('[data-testid="testbed-panel"]')
      && !v.querySelector('[data-testid="input-ssUnitCost"]')
  }, { timeout: 30000 })
  check(true, 'the Commercials pane unmounted, so the round trip is destructive')

  await p.click('[data-testid="tb-tab-btn-commercials"]')
  await p.waitForSelector('[data-testid="input-ssUnitCost"]', { timeout: 30000 })
  const after = await p.$eval('[data-testid="input-ssUnitCost"]', (e) => e.value)
  check(after === '4321', `the unsaved cost SURVIVED the tab switch (read "${after}")`)

  const bar = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return (v.querySelector('[data-testid="edit-bar"]')?.textContent ?? '').trim()
  })
  check(/1 change/i.test(bar), `one store, not two: the edit bar still counts it ("${bar}")`)
  await p.screenshot({ path: `${OUT}r1-commercials-dirty.png`, fullPage: true })
} finally {
  await b.close()
  const gone = await tearDown(TAG)
  console.log(`\nteardown ${TAG}: ${JSON.stringify(gone)}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
if (bad.length) { for (const c of bad) console.log(`  FAILED: ${c.w}`); process.exit(1) }
