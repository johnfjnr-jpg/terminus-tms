// ── LIVE PROOF: A REAL VERSION WITH REAL PRICING, RENDERED ──────────────
//
// On the record John walked, at both widths, read from the screen and checked
// against the same derivation run over the version's own snapshot.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('approve-figures/probe-live.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/approve-figures/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const REF = process.env.C_REF ?? 'TT-SGP-MANUFI-004'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const money = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const rec = must(await db.from('records').select('id, reference_code').eq('reference_code', REF).single(), 'record')
const versions = must(await db.from('deal_sheet_versions')
  .select('id, major, minor, status, inputs, rates, reason, created_by_email, revision_number')
  .eq('record_id', rec.id).order('major', { ascending: false }).order('minor', { ascending: false }), 'versions')
const top = versions[0]
// THE AUTHORITY FOR WHAT THE SCREEN SHOULD SAY: the same derivation, over the
// same snapshot, computed here rather than read from the thing under test.
const want = calculateDeal(buildDealInputs(top.inputs,
  { testBedCost: 0, rates: resolveRates(top.inputs, top.rates?.rates ?? {}).rates }))
console.log(`\n${REF}, top version V${top.major}.${top.minor} ${top.status}`)
console.log(`  the snapshot prices at contract net ${money(want.totals.contractNet)}, `
  + `cost ${money(want.totalDealCostAll)}, margin ${want.achievedMargin.toFixed(2)}%`)
check(want.totals.contractNet > 0, 'the fixture record prices above zero, so a zero on screen would be a defect')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1600 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-approval","${rec.id}")`)
    await p.waitForFunction(() => {
      const v = document.querySelector('#view-opportunity-approval')
      return v && !v.classList.contains('hidden') && (v.innerText ?? '').includes('THE ASK')
    }, { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    // MEASURED FROM THE RENDERED TEXT, which is what a person reads.
    const seen = await p.evaluate(() => {
      const v = document.querySelector('#view-opportunity-approval')
      const rows = {}
      for (const el of v.querySelectorAll('*')) {
        const t = (el.children.length === 0 ? el.textContent : '').trim()
        if (t) rows[t] = true
      }
      return { text: v.innerText, labels: Object.keys(rows) }
    })
    const has = (s) => seen.text.includes(s)
    check(has(`$${money(want.totals.contractNet)}`), 'contract net is on screen',
      `$${money(want.totals.contractNet)}`)
    check(has(`$${money(want.totalDealCostAll)}`), 'total cost is on screen',
      `$${money(want.totalDealCostAll)}`)
    check(has(`${want.achievedMargin.toFixed(2)}%`), 'achieved margin is on screen',
      `${want.achievedMargin.toFixed(2)}%`)
    // THE DEFECT'S OWN SIGNATURE, asserted gone rather than inferred from the above.
    check(!/contract net of \$0\./.test(seen.text), 'the ask does not say a contract net of $0')
    check(!/\b0\.00%/.test(seen.text) || want.achievedMargin === 0,
      'no stray 0.00% margin on a deal that is priced')
    const ask = seen.text.split('\n').find((l) => l.startsWith('Approve V')) ?? ''
    check(/Approve V\d/.test(ask) && !/\$0\b/.test(ask), 'the ask sentence carries the real figure', ask.slice(0, 80))
    // THE HEADER AND THE BODY DESCRIBE ONE STATE. The page prices the version,
    // so naming the record's latest revision put "priced at revision 25" above
    // figures frozen at 22, four lines from a row saying "Taken from revision 22".
    const sub = seen.text.split('\n').find((l) => l.includes('priced at revision')) ?? ''
    check(sub.includes(`priced at revision ${top.revision_number}`),
      'the header names the revision the FIGURES came from', sub.slice(0, 90))
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    await p.screenshot({ path: `${OUT}approval-${width}.png` })
    console.log(`     approval-${width}.png ${statSync(`${OUT}approval-${width}.png`).size} bytes`)
  }
} finally { await b.close() }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
