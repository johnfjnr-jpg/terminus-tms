// THE INTERACTION PROOF. UI hygiene v2, R2a, Phase 0. READ-ONLY against
// product code.
//
// The census establishes REACHABILITY by hit test. The brief asks for
// interaction, and those are different claims: a control can be hit-testable
// and still do nothing when activated. This activates a stratified sample and
// measures whether the page RESPONDS.
//
// RELOAD BETWEEN EVERY CONTROL. Without it, control 3 is measured on a page
// control 2 already changed, and a response gets attributed to the wrong
// element. It costs about five seconds each and it is the only way the
// readings are independent.
//
// The response measure is a MutationObserver count plus the activeElement,
// installed with evaluateOnNewDocument so it predates the document
// (Verification 45).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-door-interaction.mjs')
import { readFileSync } from 'fs'
// A long browser run outlived the session twice in one round, each time
// mid-measurement. This checks liveness periodically and refreshes only when
// the session file agrees the token is near expiry; a refused read on a
// healthy-looking file is a REVOKED token and stops the run loudly rather than
// being retried into silence.
import { startKeepAlive } from '../lib/keep-alive.mjs'
const keepAlive = startKeepAlive({ everyMs: 60000 })

const ROOT = '/Users/johnfryatt/terminus-tms'
const session = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'

// The sample, chosen to span every way a control was found and every tab that
// carries reachable ones. Named individually so the report can say what was
// exercised rather than "a sample".
const SAMPLE = [
  { tab: 'Commercials', sel: '.ring-radio:not(.active)', note: 'structure picker, the V1 brief\'s named finding' },
  { tab: 'Commercials', sel: '#deal-lumpCost', note: 'a numeric deal input' },
  { tab: 'Assessment', sel: 'input[id^="opp-assess-lv-"]', note: 'a score level radio' },
  { tab: 'Assessment', sel: 'textarea[id^="opp-assess-reason-"]', note: 'a score reason box' },
  { tab: 'Reference', sel: '.field-row-display', note: 'an edit opener' },
  // THE FOUR CENSUS SURVIVORS, named individually. All four are buttons that
  // are pointer-events:none, NOT disabled, and keyboard reachable, so the
  // mouse cannot reach them and the tab key can.
  { tab: 'Commercials', sel: '#btn-toggle-detail', note: 'SURVIVOR: Show detail (disclosure)' },
  { tab: 'Commercials', sel: 'button.btn-text:not(#btn-toggle-detail)', note: 'SURVIVOR: version Restore (a WRITE)' },
  { tab: 'Solution Alignment', sel: '#opp-next-stage-btn', note: 'SURVIVOR: Request next stage (a WRITE)' },
]

const OBS = `
window.__m = 0;
addEventListener('DOMContentLoaded', () => {
  new MutationObserver((ms) => { window.__m += ms.length })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
});`

const browser = await puppeteer.launch({ headless: 'new' })
const rows = []

for (const item of SAMPLE) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(OBS)
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((rid) => navigate('opportunity-detail', rid), NOT_MINE)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return v && !v.classList.contains('is-loading')
      && (document.getElementById('detail-company')?.textContent?.trim().length > 0)
  }, { timeout: 30000 })

  const tabId = { Reference: 'opp-detail-tabs-tab-reference',
    Commercials: 'opp-detail-tabs-tab-commercial',
    Assessment: 'opp-detail-tabs-tab-assessment' }[item.tab]
  await page.evaluate((id) => document.getElementById(id)?.click(), tabId)
  await new Promise((r) => setTimeout(r, 900))

  const before = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    el.setAttribute('data-probe-target', '1')
    const r = el.getBoundingClientRect()
    return { m: window.__m, tag: el.tagName.toLowerCase(),
      id: el.id || null, cls: (typeof el.className === 'string' ? el.className.slice(0, 40) : ''),
      x: r.left + r.width / 2, y: r.top + r.height / 2,
      pe: getComputedStyle(el).pointerEvents,
      value: 'value' in el ? String(el.value ?? '') : null,
      checked: 'checked' in el ? el.checked : null }
  }, item.sel)

  if (!before) {
    rows.push({ ...item, found: false })
    await page.close(); continue
  }

  // ── THE NOISE FLOOR, MEASURED, NOT ASSUMED ─────────────────────────────
  //
  // This page carries a LIVE CLOCK, so window.__m rises whether or not
  // anything is touched. The first version of this probe reported "7 of 7
  // responded" on counts of 1, 2 and 3 mutations, which is the clock ticking.
  // A count is only evidence once the instrument's zero is known
  // (Verification 13), so an identical idle window is measured first and every
  // interaction is judged against it.
  //
  // AND THE IDLE WINDOW MUST ACTUALLY BE IDLE. Measured: sampled straight
  // after the tab click this read 1025 mutations, because it was catching the
  // tail of the panel render rather than the page at rest. That inflated the
  // floor 340-fold and made the verdict rule demand 4100 mutations, where a
  // control measured LIVE had scored 1364 - so the mutation half of this
  // instrument was dead and every verdict rested on the state signals alone.
  //
  // The page at rest runs at about 1 mutation per second (a clock). So wait
  // for quiescence first: two consecutive 400ms windows under a small
  // threshold, then measure the floor.
  for (let i = 0; i < 25; i++) {
    const a = await page.evaluate(() => window.__m)
    await new Promise((r) => setTimeout(r, 400))
    const b = await page.evaluate(() => window.__m)
    if (b - a <= 3) break
  }
  const idleStart = await page.evaluate(() => window.__m)
  await new Promise((r) => setTimeout(r, 700))
  const idle = (await page.evaluate(() => window.__m)) - idleStart

  await new Promise((r) => setTimeout(r, 250))
  // ── THE SIGNAL THAT CANNOT BE SWAMPED ────────────────────────────────
  //
  // Three attempts at a mutation-count floor failed: 3, then 391, then 1021,
  // and at 1021 the burst rule demanded 4100 where a control measured LIVE had
  // scored 1364. The count is a proxy for "something happened" and this page
  // is too busy for it.
  //
  // A WRITE CONTROL'S REAL QUESTION IS WHETHER IT STARTS A WRITE. So the
  // decisive signal is a NETWORK REQUEST to the API during the interaction
  // window, which no amount of clock ticking can manufacture.
  const reqs = []
  // MUTATING REQUESTS ONLY. The first version counted any /api/ request and
  // every control came back RESPONDED on the same row:
  //   GET /api/records/<id>/pulse
  // which is a BACKGROUND POLL on a timer, firing whether or not anything is
  // touched. That is the mutation-floor problem again in a new costume, and it
  // is the third time this probe has been fooled by periodic work.
  //
  // A write control's question is whether it starts a WRITE, so a GET cannot
  // answer it either way. Non-GET only.
  const onReq = (r) => {
    const u = r.url()
    if (!/\/api\//.test(u)) return
    if (r.method() === 'GET') return
    reqs.push(`${r.method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`)
  }
  page.on('request', onReq)
  const mBeforeClick = await page.evaluate(() => window.__m)
  try { await page.mouse.click(before.x, before.y) } catch { /* offscreen */ }
  await new Promise((r) => setTimeout(r, 700))
  const afterClick = await page.evaluate(() => {
    const el = document.querySelector('[data-probe-target]')
    return { m: window.__m, active: document.activeElement?.tagName?.toLowerCase() ?? null,
      isTarget: document.activeElement === el,
      value: el && 'value' in el ? String(el.value ?? '') : null,
      checked: el && 'checked' in el ? el.checked : null }
  })

  // KEYBOARD: focus, then Enter and Space, which is how the estate's walks
  // prove a control (the A12 precedent: a row the door refuses drops its tab
  // stop, so focusability is itself the question).
  const mBeforeKey = await page.evaluate(() => {
    const el = document.querySelector('[data-probe-target]')
    if (el && el.focus) el.focus()
    return { m: window.__m, focused: document.activeElement === el }
  })
  await page.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 400))
  await page.keyboard.press('Space')
  await new Promise((r) => setTimeout(r, 500))
  const afterKey = await page.evaluate(() => {
    const el = document.querySelector('[data-probe-target]')
    return { m: window.__m,
      value: el && 'value' in el ? String(el.value ?? '') : null,
      checked: el && 'checked' in el ? el.checked : null }
  })

  page.off('request', onReq)
  rows.push({ ...item, found: true, tag: before.tag, id: before.id, pe: before.pe,
    requests: [...new Set(reqs)],
    idle,
    clickMutations: afterClick.m - mBeforeClick,
    clickFocused: afterClick.isTarget,
    clickChanged: afterClick.value !== before.value || afterClick.checked !== before.checked,
    keyFocusable: mBeforeKey.focused,
    keyMutations: afterKey.m - mBeforeKey.m,
    keyChanged: afterKey.value !== before.value || afterKey.checked !== before.checked })
  await page.close()
}
await browser.close()

console.log(`\n  INTERACTION PROOF on an UNOWNED record. Reload between every control.\n`)
console.log(`  ${'control'.padEnd(39)} ${'pe'.padEnd(5)} focus  changed  reqs  VERDICT`)
// RESPONDED means something only an interaction can produce: the control's own
// value or checked state changed, or it took focus, or the mutation burst is
// clearly above this page's idle rate. Mutations alone, at the idle rate, are
// the clock.
const responded = (r) => r.clickChanged || r.keyChanged || r.clickFocused
  || (r.requests && r.requests.length > 0)
for (const r of rows) {
  if (!r.found) { console.log(`  ${r.note.slice(0, 33).padEnd(34)} NOT FOUND on this record`); continue }
  const chg = r.clickChanged || r.keyChanged
  console.log(`  ${r.note.slice(0, 38).padEnd(39)} ${String(r.pe).padEnd(5)} ` +
    `${(r.clickFocused ? 'yes' : 'no').padEnd(6)} ${(chg ? 'yes' : 'no').padEnd(8)} ` +
    `${String(r.requests.length).padStart(4)}  ${responded(r) ? 'RESPONDED' : 'inert'}` +
    (r.requests.length ? `  ${r.requests.join(' ; ').slice(0, 60)}` : ''))
}
const live = rows.filter((r) => r.found && responded(r))
console.log(`\n  ${live.length} of ${rows.filter((r) => r.found).length} sampled controls RESPONDED to interaction on a record the`)
console.log(`  signed-in user does not own:`)
for (const r of live) console.log(`    ${r.note}`)
console.log(`\n  reqs = MUTATING api requests (non-GET) during the interaction window.`)
console.log(`  A control is RESPONDED on its own state changing, taking focus, or`)
console.log(`  issuing a write. The mutation-count signal was retired: this page polls`)
console.log(`  and ticks, and three separate floors (3, 391, 1021) were all swamped.`)
