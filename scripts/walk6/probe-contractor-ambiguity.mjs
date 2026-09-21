// R-N1: DOES THE CONTRACTOR GRID SHARE THE DEFECT, against the lump sum?
//
// The customer grid's fault is that its USD is DERIVED for display and STORED
// stale, so a price change splits the two. The contractor grid is built
// differently - both the percentage and the amount are writable, and typing
// one updates the other - so the question is not the same one and has to be
// asked rather than assumed.
//
// THE DRIVE: type a percentage against one lump sum, then CHANGE THE LUMP SUM.
// If the stored pair is left where it was, the row's own percentage and amount
// now describe different fractions of the base, and the reconciliation line
// reads against whichever one it consults.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk6/probe-contractor-ambiguity.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk6/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w6cm'
const db = admin()
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }

const opp = await freshOpportunity(TAG)
const rev = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'rev')
const payload = { ...(rev[0]?.payload ?? {}) }
Object.assign(payload, {
  structure: 'twoPhase', duration: 36, targetMargin: 30,
  ssExisting: 40, ssNew: 0, aqm: 0, hemir: 0,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
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
  // SETTLED, not merely present: `.is-loading > *` hides children while
  // preserving layout, so a form reports healthy geometry while untypeable.
  await p.waitForFunction(() => {
    const view = document.getElementById('view-opportunity-detail')
    if (!view || view.classList.contains('is-loading')) return false
    const panel = document.getElementById('opp-tab-commercial')
    const el = [...(panel?.querySelectorAll('[data-testid="deal-cm-0-pct"]') ?? [])]
      .find((e) => !e.closest('#deal-form-vanilla'))
    return !!el && getComputedStyle(el).visibility === 'visible'
  }, { timeout: 25000 })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const type = async (testid, text) => {
    const sel = `#opp-tab-commercial [data-testid="${testid}"]`
    await p.click(sel)
    await p.keyboard.press('End')
    const existing = await p.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => !e.closest('#deal-form-vanilla'))
      return el ? String(el.value).length : 0
    }, sel)
    for (let i = 0; i < existing + 2; i++) await p.keyboard.press('Backspace')
    await p.type(sel, text, { delay: 20 })
    const landed = await p.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => !e.closest('#deal-form-vanilla'))
      return el ? el.value : null
    }, sel)
    if (String(landed) !== String(text)) {
      throw new Error(`typing "${text}" into ${testid} did not land: reads ${JSON.stringify(landed)}`)
    }
  }

  const read = () => p.evaluate(() => {
    const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    const panel = document.getElementById('opp-tab-commercial')
    const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
    const val = (id) => pick(`[data-testid="${id}"]`)?.value ?? null
    const txt = (id) => (pick(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim()
    return {
      lump: val('deal-lumpCost'),
      pct: val('deal-cm-0-pct'),
      usd: val('deal-cm-0-usd'),
      base: txt('contractor-base-figure'),
      totalPct: txt('contractor-total-pct'),
      totalUsd: txt('contractor-total-usd'),
      diff: txt('contractor-diff'),
    }
  })

  console.log('=== 1. a contractor milestone at the FIRST lump sum ===')
  await type('deal-cm-0-month', '2')
  await type('deal-cm-0-pct', '50')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const a = await read()
  console.log(`   lump=${a.lump}  pct=${a.pct}  usd=${a.usd}`)
  console.log(`   base line=${JSON.stringify(a.base)}  total %=${JSON.stringify(a.totalPct)}  total $=${JSON.stringify(a.totalUsd)}`)

  console.log('\n=== 2. change the LUMP SUM ===')
  await type('deal-lumpCost', '400000')
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await new Promise((r) => setTimeout(r, 1200))
  const c = await read()
  console.log(`   lump=${c.lump}  pct=${c.pct}  usd=${c.usd}`)
  console.log(`   base line=${JSON.stringify(c.base)}  total %=${JSON.stringify(c.totalPct)}  total $=${JSON.stringify(c.totalUsd)}`)
  console.log(`   reconciliation=${JSON.stringify(c.diff)}`)

  console.log('\n══ THE ANSWER ═══════════════════════════════════════════════')

  // ── R-N1: A GUARD NOW. It was written to ask whether the contractor grid
  // shared the customer grid's defect, and it found that it did in mirror
  // image: after the lump sum doubled the row still read 50% and $100,000,
  // which against that base is 25%, while the total line read 25%. The same
  // drive now asserts the row and its totals agree.
  const checks = []
  const check = (ok, what, detail = '') => {
    checks.push(ok)
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
  }
  const num = (t) => Number(String(t ?? '').replace(/[^0-9.]/g, '')) || 0
  const pct = Number(c.pct) || 0
  const usd = num(c.usd)
  const lump = num(c.lump)
  const impliedPct = lump ? (usd / lump) * 100 : 0

  check(lump === 400000 && pct === 50,
    'the drive landed, so the checks below are not vacuous', `lump ${lump}, pct ${pct}`)
  check(Math.abs(impliedPct - pct) < 0.01,
    'R-N1 the row\'s percentage and its amount agree about the base',
    `${pct}% and $${usd} of $${lump} is ${impliedPct.toFixed(2)}%`)
  check(num(c.totalPct) === pct,
    'R-N1 the total percentage matches the row it totals',
    `total ${c.totalPct}, row ${pct}%`)
  check(Math.abs(num(c.totalUsd) - usd) < 1,
    'R-N1 and the total amount matches the derived amount',
    `total ${c.totalUsd}, row $${usd}`)
  check(Math.abs(num(c.base) - lump) < 1,
    'R-N1 and the base line follows the lump sum', `${c.base} against ${lump}`)

  const passed = checks.filter(Boolean).length
  console.log(`\n${passed}/${checks.length} checks passed`)
  if (passed !== checks.length) process.exitCode = 1
} finally {
  await b.close()
  await tearDown([TAG])
}
