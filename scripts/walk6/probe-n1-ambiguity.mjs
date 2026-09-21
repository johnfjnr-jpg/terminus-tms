// N1'S STOP CONDITION, MEASURED.
//
// N1 asks for a TOTAL on the customer milestone USD column, and stops the
// round if the carried two-readers defect makes that total ambiguous.
//
// THE CLAIM UNDER TEST IS WRITTEN AT THE SITE, in `panelParts.tsx`:
//
//   "THE USD IS COMPUTED and shown read-only, so the two readings of this
//    schedule cannot disagree about what it is a percentage of."
//
// Walk 5 reasoned from source that they CAN disagree and recorded it as
// unmeasured. This measures it, because a total placed on top of a
// disagreement is right about one reading and wrong about the other with
// nothing on screen saying which.
//
// THE TWO READINGS:
//   DISPLAYED  `usdFor(i)` = pct x oneOffPrice, recomputed every render
//   STORED     `values['deal-ms-i-usd']`, written ONLY when a pct is typed,
//              and what `readMilestones` sends to the payload
//
// THE METHOD: type a percentage at one price, then CHANGE THE PRICE by
// changing the unit counts, and compare what the screen shows with what the
// record receives. Read back from the database, because the screen is not
// the authority about what was saved.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk6/probe-n1-ambiguity.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk6/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w6n1'
const db = admin()
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }

const opp = await freshOpportunity(TAG)
const rev = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'rev')
const payload = { ...(rev[0]?.payload ?? {}) }
Object.assign(payload, {
  structure: 'hybrid', invoicing: 'annual', duration: 36, targetMargin: 30,
  ssExisting: 40, ssNew: 0, aqm: 0, hemir: 0,
  installResp: 'Client Own Installation Team',
})
must(await db.from('record_revisions').update({ payload })
  .eq('record_id', opp.oppId).eq('revision_number', rev[0].revision_number), 'seed')
console.log(`opportunity ${opp.oppId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
  await p.waitForFunction(() => {
    const c = document.getElementById('detail-company')
    return !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 25000 })
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
      .find((x) => /commercial/i.test(x.textContent ?? ''))
    t?.click()
  })
  // AND WAIT FOR THE VIEW TO SETTLE, not merely for the group to be shown.
  // `.is-loading > *` sets `visibility: hidden` while PRESERVING layout, so
  // every field reports a healthy rect and a real value while being invisible
  // and untypeable. The first run of this probe typed into that state: the
  // percentage never arrived, the units never changed, and the comparison at
  // the end read AGREE - which is an instrument that did not run, reported as
  // a measurement.
  await p.waitForFunction(() => {
    const view = document.getElementById('view-opportunity-detail')
    if (!view || view.classList.contains('is-loading')) return false
    const panel = document.getElementById('opp-tab-commercial')
    const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
      .find((x) => !x.closest('#deal-form-vanilla'))
    if (!g || g.classList.contains('hidden')) return false
    const pct = [...(panel?.querySelectorAll('[data-testid="deal-ms-0-pct"]') ?? [])]
      .find((e) => !e.closest('#deal-form-vanilla'))
    return !!pct && getComputedStyle(pct).visibility === 'visible'
  }, { timeout: 25000 })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const read = () => p.evaluate(() => {
    const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    const panel = document.getElementById('opp-tab-commercial')
    const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
    const val = (id) => (pick(`[data-testid="${id}"]`))?.value ?? null
    return {
      pct0: val('deal-ms-0-pct'),
      usd0Displayed: val('deal-ms-0-usd'),
      units: val('deal-ssExisting'),
      oneOff: (pick('[data-testid="dm-row-0"]')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      // THE OTHER TWO READERS ON THE SAME SCREEN. The grid cell is the
      // DERIVED figure; the schedule warning and the cash flow both read the
      // STORED one, so all three are visible at once and two disagree with
      // the third.
      warning: (pick('[data-testid="milestone-warning"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      // N1: the total row, and the columns it must line up under.
      totalPct: (pick('[data-testid="ms-total-pct"]')?.textContent ?? '').trim(),
      totalUsd: (pick('[data-testid="ms-total-usd"]')?.textContent ?? '').trim(),
      totalUsdRight: (() => {
        const t = pick('[data-testid="ms-total-usd"]')
        const cell = pick('.ms-grid-row input[data-testid$="-usd"]')
        return t && cell
          ? { total: Math.round(t.getBoundingClientRect().right), col: Math.round(cell.getBoundingClientRect().right),
              align: getComputedStyle(t).textAlign }
          : null
      })(),
      cashRow: (() => {
        const rows = [...(panel?.querySelectorAll('[data-testid^="cf-row-"]') ?? [])].filter(LIVE)
        const r = rows.find((x) => /milestone hardware payment/i.test(x.textContent ?? ''))
        return r ? (r.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) : null
      })(),
    }
  })

  // REAL KEYBOARD EVENTS. A synthetic `.value` write is deduped by React's own
  // value tracker, so the DOM shows the text while the component never gets it.
  const type = async (testid, text) => {
    const sel = `#opp-tab-commercial [data-testid="${testid}"]`
    await p.click(sel)
    // CLEARED CHARACTER BY CHARACTER, because neither a triple click nor
    // Meta+A selected inside these inputs: both left "8040" when replacing
    // "40" with "80" - one character removed and the new text appended to
    // what remained. Backspacing from the end cannot half-work, and the
    // length is read from the box rather than guessed.
    await p.keyboard.press('End')
    const existing = await p.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => !e.closest('#deal-form-vanilla'))
      return el ? String(el.value).length : 0
    }, sel)
    for (let i = 0; i < existing + 2; i++) await p.keyboard.press('Backspace')
    await p.type(sel, text, { delay: 20 })
    // THE WRITE IS CONFIRMED BEFORE ANYTHING IS MEASURED. A probe that types
    // into an invisible field and carries on produces a clean-looking result
    // from an instrument that never ran.
    const landed = await p.evaluate((s, want) => {
      const el = [...document.querySelectorAll(s)].find((e) => !e.closest('#deal-form-vanilla'))
      return el ? el.value : null
    }, sel, text)
    if (String(landed) !== String(text)) {
      throw new Error(`typing "${text}" into ${testid} did not land: the box reads ${JSON.stringify(landed)}`)
    }
  }

  console.log('=== 1. type a percentage at the FIRST price ===')
  await type('deal-ms-0-month', '3')
  await type('deal-ms-0-pct', '50')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const atFirst = await read()
  console.log(`   units=${atFirst.units}  pct=${atFirst.pct0}  DISPLAYED usd=${atFirst.usd0Displayed}`)

  // Save, so the STORED reading reaches the record.
  const save1 = await p.evaluate(() => {
    const btn = document.getElementById('btn-save-deal')
    if (!btn || btn.disabled) return { ok: false, why: btn ? 'disabled' : 'absent' }
    btn.click(); return { ok: true }
  })
  await p.waitForFunction(() => document.getElementById('btn-save-deal')?.disabled, { timeout: 20000 }).catch(() => {})
  const r1 = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'r1')
  const stored1 = (r1[0]?.payload?.milestones ?? [])[0] ?? null
  console.log(`   save: ${JSON.stringify(save1)}  STORED milestone: ${JSON.stringify(stored1)}`)

  console.log('\n=== 2. change the UNITS, which changes the one-off price ===')
  await type('deal-ssExisting', '80')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await new Promise((r) => setTimeout(r, 1200))
  const atSecond = await read()
  console.log(`   units=${atSecond.units}  pct=${atSecond.pct0}  DISPLAYED usd=${atSecond.usd0Displayed}`)

  const displayedMoved = atFirst.usd0Displayed !== atSecond.usd0Displayed
  console.log(`\n   the DISPLAYED figure moved with the price: ${displayedMoved}`)
  console.log(`\n   THE SAME SCREEN, AT THE SAME MOMENT:`)
  console.log(`     the grid cell (derived) : ${atSecond.usd0Displayed}`)
  console.log(`     the schedule warning    : ${JSON.stringify(atSecond.warning)}`)
  console.log(`     the cash flow row       : ${JSON.stringify(atSecond.cashRow)}`)

  console.log('\n=== 3. save again, and read what the RECORD received ===')
  const save2 = await p.evaluate(() => {
    const btn = document.getElementById('btn-save-deal')
    if (!btn || btn.disabled) return { ok: false, why: btn ? 'disabled' : 'absent' }
    btn.click(); return { ok: true }
  })
  await p.waitForFunction(() => document.getElementById('btn-save-deal')?.disabled, { timeout: 20000 }).catch(() => {})
  const r2 = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'r2')
  const stored2 = (r2[0]?.payload?.milestones ?? [])[0] ?? null
  console.log(`   save: ${JSON.stringify(save2)}  STORED milestone: ${JSON.stringify(stored2)}`)

  // THE DISAGREEMENT, PHOTOGRAPHED. Scrolled into view and proven visible
  // first: `.is-loading > *` hides children while preserving layout, which is
  // how this probe's first run typed into an invisible form.
  await p.evaluate(() => {
    const g = [...document.querySelectorAll('#deal-hybrid-group')]
      .find((x) => !x.closest('#deal-form-vanilla'))
    g?.scrollIntoView({ block: 'center' })
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const shot = await p.evaluate(() => {
    const g = [...document.querySelectorAll('#deal-hybrid-group')]
      .find((x) => !x.closest('#deal-form-vanilla'))
    if (!g) return { ok: false, why: 'no hybrid group' }
    const r = g.getBoundingClientRect()
    const view = document.getElementById('view-opportunity-detail')
    const vis = getComputedStyle(g).visibility === 'visible' && !view?.classList.contains('is-loading')
    return { ok: vis && r.top < window.innerHeight && r.bottom > 0, why: `visible=${vis} top=${Math.round(r.top)}` }
  })
  console.log(`\n   capture: the grid is in the region and visible: ${shot.ok} (${shot.why})`)
  // RENAMED WITH THE CLAIM IT NOW SHOWS. It was `n1-disagreement.png`, taken
  // when this probe existed to find the defect; the same file would otherwise
  // sit under a report describing agreement while carrying a name asserting
  // the opposite. The old image is not overwritten silently - it is a
  // different file, and both are evidence of different days.
  await p.screenshot({ path: `${OUT}n1-agreement.png` })

  console.log('\n══ THE ANSWER ═══════════════════════════════════════════════')

  // ── R-N1: THIS IS A GUARD NOW, NOT A MEASUREMENT ───────────────────────
  //
  // It was written to answer N1's stop condition and it found the two
  // readings 100% apart. The ruling made the percentage authoritative, so the
  // same drive now asserts AGREEMENT - and the comparison had to be
  // re-pointed, because the old one compared the screen against a stored
  // dollar figure that no longer exists and would have read "disagree by the
  // whole amount" forever.
  const checks = []
  const check = (ok, what, detail = '') => {
    checks.push(ok)
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
  }
  const num = (t) => Number(String(t ?? '').replace(/[^0-9.]/g, '')) || 0
  const disp = num(atSecond.usd0Displayed)
  const warned = num((atSecond.warning ?? '').match(/total \$([\d,]+)/)?.[1])
  const cash = num((atSecond.cashRow ?? '').match(/([\d,]+)/)?.[1])

  check(disp > 0, 'the drive produced a figure at all, so the checks below are not vacuous',
    `${disp}`)
  check(Math.abs(warned - disp) < 1,
    'R-N1 the schedule warning reads the SAME figure as the grid cell',
    `cell ${disp}, warning ${warned}`)
  check(Math.abs(cash - disp) < 1,
    'R-N1 and so does the cash flow',
    `cell ${disp}, cash flow ${cash}`)

  // AND THE RECORD. The screen is not the authority about what was saved.
  const storedPct = Number(stored2?.pct ?? 0)
  const derivedFromRecord = Math.round((storedPct / 100) * 934286 * 100) / 100
  check(!('usd' in (stored2 ?? {})),
    'R-N1 the record carries NO stored usd, so there is no second number to drift',
    JSON.stringify(stored2))
  check(storedPct === 50,
    'R-N1 the record carries the PERCENTAGE the person typed', `pct ${storedPct}`)
  check(Math.abs(derivedFromRecord - disp) < 1,
    'R-N1 and the percentage in the record derives to the figure on the screen',
    `record ${derivedFromRecord}, screen ${disp}`)

  // ── N1: THE TOTAL ROW, now that there is one reading to total ─────────
  check(atSecond.totalPct === '50%',
    'N1 the total row states the percentage the schedule adds up to',
    JSON.stringify(atSecond.totalPct))
  check(num(atSecond.totalUsd) === disp,
    'N1 and its amount is the SAME derived figure the cell shows',
    `total ${atSecond.totalUsd}, cell ${disp}`)
  check(!!atSecond.totalUsdRight
    && Math.abs(atSecond.totalUsdRight.total - atSecond.totalUsdRight.col) <= 2,
    'N1 and it ends where the USD column ends, right-aligned',
    JSON.stringify(atSecond.totalUsdRight))

  const passed = checks.filter(Boolean).length
  console.log(`\n${passed}/${checks.length} checks passed`)
  if (passed !== checks.length) process.exitCode = 1
} finally {
  await b.close()
  await tearDown([TAG])
}
