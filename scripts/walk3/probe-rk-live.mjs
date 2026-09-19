// ── R-K LIVE: a full count-entry pass on Commercials, BY KEYBOARD ALONE ──
//
// The unit suite proves the mechanism in jsdom. This proves the SCREEN: that a
// person at 1440 can enter the counts and the rates without touching the
// mouse, that Escape still reverts one of them, that the pass writes NOTHING
// until Save, and that what Save then writes is what was typed - read back
// from the database rather than from the page that typed it.
//
// A REAL KEYBOARD THROUGHOUT. `page.keyboard` and `page.type`, never a
// synthetic value write: React's per-input value tracker dedupes a `.value`
// assignment once the component has persisted, so the DOM would show the text
// while the component's state never received it.
//
// EVERY MEASUREMENT PRECEDES EVERY CAPTURE, and the captures are of the PAGE.
//
// UNWIRED, and deliberately: it needs a browser, a live server and a signed-in
// session, and it CREATES AND SAVES a Test Bed. The gate's own stages cover
// the mechanism through the React suite; this is the screen proof and the
// subject of the two live calibrations in live-specs/.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-rk-live.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-rk-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin()
const TAG = 'w3rk'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// Read the record the way the SERVER holds it, never the way the page does.
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
// THE REVISION IS THE LATEST ROW'S NUMBER. `records` carries no revision
// column - the first draft of this probe assumed `records.current_revision`
// and `must` refused it by name, which is the reason every read here is
// destructured rather than defaulted with `?? []`.
const recordState = async (id) => {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'revision')
  return { revision: rev[0]?.revision_number ?? 0, payload: rev[0]?.payload ?? {} }
}

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  // 127.0.0.1 RATHER THAN `localhost`, and it is not a preference: the server
  // binds 127.0.0.1 only (src/server.js, units ruling R4) and Chrome in this
  // environment answered `localhost` with ERR_ADDRESS_INVALID while curl
  // reached both. The origin is what localStorage is keyed by, and this probe
  // writes the session on the same origin it then reads it from.
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)

  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-summary"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })
  await p.click('[data-testid="tb-tab-btn-commercials"]')
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    const c = v?.querySelector('[data-testid="tb-card-rates-hardware"]')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 30000 })

  // ── SEED THE FIELD THE PASS WILL ESCAPE OUT OF ────────────────────────
  //
  // A fresh bed holds no counts, so "the Escape-reverted field was not
  // written" would compare `undefined` with `undefined` - a check that passes
  // with nothing on either side (CLAUDE.md Verification 14). One saved value
  // gives the revert two sides, and it is entered by keyboard like the rest.
  await p.focus('[data-testid="display-hemirSensors"]')
  await p.keyboard.press('Enter')
  await p.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'input-hemirSensors',
    { timeout: 10000 })
  await p.keyboard.type('2')
  await p.keyboard.press('Enter')
  await p.click('[data-testid="save-all"]')
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return (v.querySelector('[data-testid="dirty-count"]')?.textContent ?? '').startsWith('0')
  }, { timeout: 20000 })

  const before = await recordState(tb.bedId)
  console.log(`  record at revision ${before.revision}, hemirSensors=${JSON.stringify(before.payload.hemirSensors)}, before a key of the pass is pressed\n`)
  check(before.payload.hemirSensors === 2 || before.payload.hemirSensors === '2',
    `the seed landed, so the revert claim below has two sides (${JSON.stringify(before.payload.hemirSensors)})`)

  // ── THE PANEL DECLARES ITSELF, which is what the move is scoped to ─────
  const panel = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const el = v?.querySelector('[data-field-panel]')
    const rows = el ? Array.from(el.querySelectorAll('.field-row[data-field]:not([data-readonly])'))
      .map((r) => r.getAttribute('data-field')) : []
    return { declared: el?.getAttribute('data-field-panel') ?? null, rows }
  })
  check(panel.declared === 'commercials', `the Commercials panel declares itself (${panel.declared})`)
  check(panel.rows.length >= 12, `it holds ${panel.rows.length} openable rows in DOM order`)
  console.log(`  order: ${panel.rows.join(' -> ')}\n`)

  // ── THE PASS. Not one mouse click from here to the Save button ─────────
  //
  // ── A WAIT FOR A CLAIM MUST NOT BE ABLE TO KILL THE CLAIM ─────────────
  //
  // The first live calibration of this probe read SILENT: the injection was
  // real, the bundle was rebuilt, and the probe DIED at the wait one line
  // above the check it was meant to fail, so the named assertion was never
  // reached (CLAUDE.md Verification 9's clause - a check that is only ever
  // REACHED when it passes is decorative, and a red run and a red run look
  // the same).
  //
  // So every wait that precedes a claim about the move SWALLOWS its timeout.
  // The wait is there to avoid asserting mid-render (Verification 6); it is
  // not the evidence. The assertion after it is, and it now runs either way.
  const settle = (fn, arg) => p.waitForFunction(fn, { timeout: 8000 }, arg).catch(() => false)

  const openState = () => p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const open = Array.from(v.querySelectorAll('.field-row[data-field]'))
      .filter((r) => { const e = r.querySelector('[data-testid^="edit-"]'); return e && !e.hasAttribute('hidden') })
      .map((r) => r.getAttribute('data-field'))
    return { open, focus: document.activeElement?.getAttribute('data-testid') ?? null }
  })

  const focused = () => p.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)

  // 1. Focus the first count's tab stop and open it with the keyboard.
  await p.focus('[data-testid="display-safesightCameras"]')
  await p.keyboard.press('Enter')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-safesightCameras')
  check(await focused() === 'input-safesightCameras',
    'Enter on a closed row opened it and put the caret in the editor')

  // 2. Type, then Enter: commits and opens the NEXT field.
  await p.keyboard.press('End')
  await p.keyboard.type('7')
  await p.keyboard.press('Enter')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-airQualitySensors')
  let st = await openState()
  check(!st.open.includes('safesightCameras'), 'Enter CLOSED the field it committed')
  check(st.open.includes('airQualitySensors'), 'and opened the next field on the panel')
  check(st.focus === 'input-airQualitySensors',
    `and left the caret in it, so the next keystroke is typing (focus ${st.focus})`)

  // 3. Type, then ArrowDown: the same, downward.
  await p.keyboard.press('End')
  await p.keyboard.type('5')
  await p.keyboard.press('ArrowDown')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-hemirSensors')
  st = await openState()
  check(st.open.includes('hemirSensors') && !st.open.includes('airQualitySensors'),
    `ArrowDown committed and moved down (open ${JSON.stringify(st.open)})`)

  // 4. Type into the third, then Escape: A3 reverts it and closes.
  await p.keyboard.press('End')
  await p.keyboard.type('9')
  await p.keyboard.press('Escape')
  await settle(() => {
    const v = document.getElementById('view-test-bed-detail')
    const e = v.querySelector('[data-testid="edit-hemirSensors"]')
    return !!e && e.hasAttribute('hidden')
  })
  st = await openState()
  check(!st.open.includes('hemirSensors'), 'Escape closed the third field')
  check(st.open.length === 0, `and nothing else is open (${JSON.stringify(st.open)})`)

  // 5. ArrowUp moves back up, from an open editor.
  await p.focus('[data-testid="display-aqUnitCost"]')
  await p.keyboard.press('Enter')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-aqUnitCost')
  await p.keyboard.press('ArrowUp')
  await settle(() => document.activeElement?.getAttribute('data-testid') === 'input-ssUnitCost')
  st = await openState()
  check(st.open.includes('ssUnitCost') && !st.open.includes('aqUnitCost'),
    `ArrowUp committed and moved UP, so the direction is honoured (open ${JSON.stringify(st.open)})`)
  await p.keyboard.press('Escape')

  // 6. The panel's LAST field: Enter commits and closes, opening nothing.
  const last = panel.rows[panel.rows.length - 1]
  await p.focus(`[data-testid="display-${last}"]`)
  await p.keyboard.press('Enter')
  await settle((n) => document.activeElement?.getAttribute('data-testid') === `input-${n}`, last)
  await p.keyboard.press('End')
  await p.keyboard.type('3')
  await p.keyboard.press('Enter')
  await settle((n) => {
    const v = document.getElementById('view-test-bed-detail')
    const e = v.querySelector(`[data-testid="edit-${n}"]`)
    return !!e && e.hasAttribute('hidden')
  }, last)
  st = await openState()
  check(st.open.length === 0,
    `Enter at the panel's last field (${last}) closed it and opened NOTHING (${JSON.stringify(st.open)})`)

  // ── NOT ONE OF THOSE KEYSTROKES WROTE TO THE RECORD ───────────────────
  const mid = await recordState(tb.bedId)
  check(mid.revision === before.revision,
    `no record-wide save fired: the record is still at revision ${mid.revision} (was ${before.revision})`)
  const bar = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return v.querySelector('[data-testid="dirty-count"]')?.textContent?.trim() ?? null
  })
  console.log(`  the bar reads "${bar}"`)
  check(/3 changes/.test(bar ?? ''), `and the bar holds the three commits as UNSAVED ("${bar}")`)

  // ── NAMED AFTER THE RUN THAT MADE IT, not after what it depicts ───────
  //
  // This probe is run twice more by calibrate-live against DELIBERATELY BROKEN
  // bundles. Under a fixed name those runs overwrite the healthy capture, and
  // for a while `rk-after-pass.png` showed the INJECTED screen under a report
  // describing the healthy one - which is exactly what happened here before
  // this line was changed (CLAUDE.md Verification 44's artefact clause).
  //
  // The bed id differs by construction on every run, so no two runs can
  // collide however the probe is invoked.
  await p.screenshot({ path: `${OUT}rk-after-pass-${tb.bedId.slice(0, 8)}.png`, fullPage: true })
  console.log(`  screenshot: ${OUT}rk-after-pass-${tb.bedId.slice(0, 8)}.png`)

  // ── AND THE BAR CAN SAVE, so the zero above is a measurement ───────────
  await p.click('[data-testid="save-all"]')
  // WAIT ON THE BAR EMPTYING, which only a landed save produces - not a fixed
  // delay, and not the button's own disabled state, which is true before the
  // click as well as after it.
  await settle(() => {
    const v = document.getElementById('view-test-bed-detail')
    return (v.querySelector('[data-testid="dirty-count"]')?.textContent ?? '').startsWith('0')
  })
  const after = await recordState(tb.bedId)
  check(after.revision > before.revision,
    `Save DID write: revision ${before.revision} -> ${after.revision}`)
  const pay = after.payload
  console.log(`  safesightCameras=${pay.safesightCameras} airQualitySensors=${pay.airQualitySensors} hemirSensors=${pay.hemirSensors} ${last}=${pay[last]}`)
  check(String(pay.safesightCameras).endsWith('7'),
    `the first count reached the DATABASE (${pay.safesightCameras})`)
  check(String(pay.airQualitySensors).endsWith('5'),
    `the second count reached the database (${pay.airQualitySensors})`)
  check(String(pay.hemirSensors ?? '') === String(before.payload.hemirSensors ?? '')
    && String(pay.hemirSensors ?? '') !== '',
    `the Escape-reverted field kept its SAVED value and did not take the typed 9 (${JSON.stringify(pay.hemirSensors)})`)
} finally {
  await b.close()
  await tearDown(TAG)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
