// ── V9 PHASE 0: MEASURE BEFORE BUILD ─────────────────────────────────────
//
// Step 2 of the scoring-selector brief. Four measurements, and the two that
// need a real browser are here: the SPARE WIDTH R2 must size its reserved
// anchor region into, and the CURRENT keyboard and tab behaviour of the select
// the buttons replace, which the R3 guards are written against.
//
// NOTHING IS BUILT IN THIS PHASE. It reads.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates a Test Bed.
// Run: PUPPETEER_PATH=... node scripts/scoring/probe-p0.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-p0.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'v9p0'
const out = { widths: {}, keyboard: null }

// The longest anchor at its current version, measured from the database in the
// static half of Phase 0: 302 characters, score 5, scoreDataRights. Quoted here
// so the width cost is measured against the real worst case rather than a
// representative one.
const LONGEST = 'The client has confirmed Terminus may retain and use the data for product development, and the person confirming has authority to grant it. Any restrictions on use, retention or publication are stated and acceptable. Where personal data is involved, the client\'s own basis for sharing it is identified.'

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const w of [1240, 1440]) {
    await p.setViewport({ width: w, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-test-bed-detail')
      return !!v?.querySelector('[data-testid="tb-card-summary"]')
    }, { timeout: 30000 })
    // ── THE STAGE TAB HAS TO BE CLICKED. The record OPENS on Reference, not
    // on its stage, so the first version of this probe waited for a score
    // select on a tab that has none and read `rows: 0` at both widths - which
    // reads exactly like "the scoring card is gone" rather than "I am looking
    // at the wrong tab".
    //
    // All five test_bed criteria are gated from Qualification (measured from
    // stage_gate_rules), so that is the tab.
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('[data-testid^="tb-tab-btn-"]')]
        .find((b) => /qualification/i.test(b.textContent ?? ''))
      btn?.click()
    })
    // ── WAIT ON LAYOUT, NOT ON EXISTENCE ────────────────────────────────
    //
    // Waiting for the select to EXIST returned five rows whose every width read
    // ZERO - card, head, name, value, select and spare - which reads like a
    // collapsed panel rather than like a measurement taken one tick early. The
    // element is in the DOM before the pane has been laid out, and
    // getBoundingClientRect on a just-inserted node answers 0.
    //
    // The counterfactual is the point (Verification 7): "the select exists" is
    // satisfied by the state this probe must not measure, and "the row has a
    // real width" is not.
    await p.waitForFunction(() => {
      const r = document.querySelector('.tb-score-row')
      return !!r && r.getBoundingClientRect().width > 100
    }, { timeout: 30000 }).catch(() => false)

    const m = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.tb-score-row')]
      if (!rows.length) return { rows: 0 }
      const r0 = rows[0]
      const head = r0.querySelector('.tb-score-head')
      const name = r0.querySelector('.tb-score-name')
      const val = r0.querySelector('.tb-score-value')
      const sel = r0.querySelector('.tb-score-select')
      const hr = head?.getBoundingClientRect()
      const px = (e) => { const b = e?.getBoundingClientRect(); return b ? Math.round(b.width) : null }
      // THE SPARE WIDTH is what the head has left once the parts that must stay
      // (R5: the name and the current score) and the control itself are placed.
      const used = (px(name) ?? 0) + (px(val) ?? 0) + (px(sel) ?? 0)
      return {
        rows: rows.length,
        card: Math.round(r0.closest('.pg-card, [data-testid^="tb-"]')?.getBoundingClientRect().width ?? 0),
        head: hr ? Math.round(hr.width) : null,
        name: px(name), value: px(val), select: px(sel),
        used, spare: (hr ? Math.round(hr.width) : 0) - used,
        headHeight: hr ? Math.round(hr.height) : null,
      }
    })
    // ── WHAT R2'S RESERVED REGION WOULD COST, MEASURED NOT ESTIMATED ─────
    //
    // R2 sizes one stable region for the LONGEST anchor. The longest anchor in
    // the database is 302 characters, so this renders exactly that text at
    // exactly the spare width the row has, in the row's own typography, and
    // reads the height back. Arithmetic on characters-per-line would be a
    // second reader of the font.
    const cost = await p.evaluate((spare, text) => {
      const row = document.querySelector('.tb-score-row')
      const probe = document.createElement('div')
      probe.textContent = text
      probe.style.cssText = `width:${spare}px; position:absolute; visibility:hidden`
      row.appendChild(probe)
      const cs = getComputedStyle(probe)
      const h = Math.round(probe.getBoundingClientRect().height)
      const lh = Math.round(parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)
      probe.remove()
      return { height: h, lineHeight: lh, lines: lh ? Math.round(h / lh) : null, font: cs.fontSize }
    }, m.spare, LONGEST)
    m.reservedCost = cost
    out.widths[w] = m
    console.log(`  ${w}px  ${JSON.stringify(m)}`)
    if (!m.rows || !m.head) { console.log(`  STOPPING: ${w}px produced no laid-out row, so its numbers are not a measurement`) }
  }

  // ── CURRENT KEYBOARD AND TAB BEHAVIOUR OF THE SELECT, for the R3 guards ──
  await p.setViewport({ width: 1440, height: 1200 })
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => !!document.querySelector('[data-testid^="tb-tab-btn-"]'), { timeout: 30000 })
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-testid^="tb-tab-btn-"]')]
      .find((b) => /qualification/i.test(b.textContent ?? ''))
    btn?.click()
  })
  await p.waitForFunction(() => !!document.querySelector('[data-testid^="tb-score-select-"]'), { timeout: 30000 })

  const kb = await p.evaluate(() => {
    const sels = [...document.querySelectorAll('[data-testid^="tb-score-select-"]')]
    const first = sels[0]
    return {
      selects: sels.length,
      testids: sels.map((s) => s.getAttribute('data-testid')),
      tabIndex: first?.tabIndex,
      optionCount: first?.options?.length,
      options: [...(first?.options ?? [])].map((o) => `${o.value}:${o.textContent}`),
      // What is focusable inside ONE row today, in document order: this is the
      // tab order R3 must leave unbroken.
      rowFocusables: (() => {
        const row = first?.closest('.tb-score-row')
        return [...(row?.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? [])]
          .map((e) => e.getAttribute('data-testid') ?? `${e.tagName.toLowerCase()}.${e.className}`)
      })(),
    }
  })
  out.keyboard = kb
  console.log(`\n  keyboard/tab today: ${JSON.stringify(kb, null, 1)}`)

  // Does an arrow key on the closed select change the value TODAY? That is the
  // native behaviour R3 replaces, and the R3 guard must be able to tell them
  // apart rather than pass on the browser's own arrow handling.
  const key = kb.testids[0]
  await p.focus(`[data-testid="${key}"]`)
  const before = await p.$eval(`[data-testid="${key}"]`, (e) => e.value)
  await p.keyboard.press('ArrowDown')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const after = await p.$eval(`[data-testid="${key}"]`, (e) => e.value)
  out.keyboard.arrowChangesValueToday = { before, after, changed: before !== after }
  console.log(`  ArrowDown on the select today: "${before}" -> "${after}" (changed: ${before !== after})`)

  // ── THE CAPTURE MUST CONTAIN THE THING. The first version of this probe
  // photographed the pane mid-load and produced a picture of "Loading
  // Qualification..." - a perfectly clean image of nothing, delivered under a
  // report about the scoring card (Verification 4's own clause).
  //
  // The measurements above were never affected: they wait on a laid-out row.
  // Only the capture was early, which is the shape that looks like diligence.
  const shotReady = await p.waitForFunction(() => {
    const r = document.querySelector('.tb-score-row')
    return !!r && r.getBoundingClientRect().width > 100
  }, { timeout: 30000 }).then(() => true).catch(() => false)
  console.log(`  the scoring card is laid out before the capture: ${shotReady}`)
  await p.screenshot({ path: `${OUT}p0-scoring-1440-${tb.bedId.slice(0, 8)}.png`, fullPage: true })
  console.log(`\n  screenshot: ${OUT}p0-scoring-1440-${tb.bedId.slice(0, 8)}.png`)
} finally {
  await b.close()
  console.log(`  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}
writeFileSync(`${OUT}p0-measurements.json`, JSON.stringify(out, null, 2))
console.log(`\n  measurements: ${OUT}p0-measurements.json`)
