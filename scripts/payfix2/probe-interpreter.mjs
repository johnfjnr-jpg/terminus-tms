// ── R-PT3'S PROOF: THE INTERPRETER OUTLIVES THE OPTION ──────────────────
//
// John's ruling: "after migration, open one of the issued single-phase versions
// on the approval page and assert its figures still price from the frozen
// snapshot (non-zero, matching a direct derivation run over that snapshot)."
//
// WHAT COULD GO WRONG AND WHAT THIS IS THEREFORE SHAPED TO CATCH. Removing
// `single` from the rail removes a control. If it had removed the MEANING, the
// derivation would not fail loudly: `structure === 'single' ? months` would
// stop matching, `recov` would fall to the `null` branch, and an issued version
// would quietly reprice. So the test is not "the page renders" - it is "the
// page's figures equal a derivation run over the frozen snapshot, and are not
// zero".
//
// NON-ZERO IS LOAD-BEARING. Two derivations that both collapse to zero agree
// perfectly (Verification 14: a check that passes with nothing on either side
// is not a check), and this estate has shipped exactly that defect before.
//
// UNWIRED: needs a browser, a live server, a signed-in session and the
// service key.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payfix2/probe-interpreter.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payfix2/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
/* THE ORIGIN IS A PARAMETER SO THE CALIBRATION NEED NOT TOUCH THE RUNNING
   SERVER. Port 3000 is held by a process started without `--watch`, so a
   mutated `src/` would not reach it without a restart, and restarting the
   estate's own dev server to prove a point is a worse trade than starting a
   second one. The calibration runs a server on its own port against the
   injected source and points this probe at it. */
const BASE = process.env.C_BASE ?? 'http://127.0.0.1:3000'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const RULED = ['TT-SGP-SMARTC-003', 'TT-SGP-MANUFI-005']
const recs = must(await db.from('records').select('id, reference_code, status')
  .in('reference_code', RULED), 'records')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const rec of recs) {
    // ── THE VERSION THE PAGE WILL SHOW: the route takes versions ordered
    // major desc, minor desc and uses [0]. Read the same way here rather than
    // assuming which one that is.
    const versions = must(await db.from('deal_sheet_versions')
      .select('id, major, minor, status, inputs, rates, revision_number')
      .eq('record_id', rec.id)
      .order('major', { ascending: false }).order('minor', { ascending: false }), 'versions')
    const v = versions[0]
    const label = v.major === 0 ? `V0.${v.minor}` : (v.minor === 0 ? `V${v.major}` : `V${v.major}.${v.minor}`)

    // ── THE CURRENT RECORD, so the contrast is the point of the test ──
    const cur = must(await db.from('record_revisions').select('revision_number, payload')
      .eq('record_id', rec.id).order('revision_number', { ascending: false }).limit(1), 'cur')[0]

    // ── THE DIRECT DERIVATION OVER THE FROZEN SNAPSHOT ────────────────
    // The version's OWN inputs and its OWN frozen rates, which is what the
    // route does. `rates` is nested under `rates.rates` and that is the only
    // shape in the estate.
    const frozenRates = v.rates?.rates ?? {}
    const res = resolveRates(v.inputs, frozenRates)
    const direct = calculateDeal(buildDealInputs(v.inputs, { testBedCost: 0, rates: res.rates }))

    console.log(`\n══ ${rec.reference_code}  ${label}/${v.status} ══`)
    console.log(`   record now: paymentMode=${cur.payload.paymentMode} structure=${cur.payload.structure} (rev ${cur.revision_number})`)
    console.log(`   frozen    : structure=${v.inputs?.structure} paymentMode=${v.inputs?.paymentMode ?? '(absent)'}`)
    check(v.status === 'issued', `the version the page shows is ISSUED (${v.status})`)
    check(v.inputs?.structure === 'single', `the frozen snapshot still says structure=single`)
    check(cur.payload.paymentMode === 'opex', 'the CURRENT record has migrated to OPEX')

    // THE INTERPRETER IS ALIVE: `single` still means "recover over the whole
    // term", which is the one thing the calculator does with it.
    check(direct.cashFlow.structure === 'single',
      `the derivation still reports structure=single (${direct.cashFlow.structure})`)
    check(direct.cashFlow.recov === Number(v.inputs.duration),
      `single still recovers over the FULL TERM: recov ${direct.cashFlow.recov} against duration ${v.inputs.duration}`)

    check(direct.totals.contractNet > 0, `direct derivation contract net is NON-ZERO ($${direct.totals.contractNet})`)
    check(direct.totals.totalDealCost > 0, `direct derivation total cost is NON-ZERO ($${direct.totals.totalDealCost})`)

    // ── THE APPROVAL PAGE, IN A BROWSER ───────────────────────────────
    await p.setViewport({ width: 1440, height: 1900 })
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-approval","${rec.id}")`)
    await p.waitForFunction(() => document.querySelector('[data-testid="approval-view"]')
      && /Contract net/.test(document.body.textContent ?? ''), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
    /* ── THE EXTRACTOR, AND THE FIRST ONE RETURNED NULL FOR EVERYTHING ────
       It walked every descendant looking for a childless element whose text
       equalled the label, then took a sibling. `Row` renders
       `.ds-row > div > .ds-label` beside `.ds-row > .ds-value`, so the label's
       sibling is the NOTE, not the value - and for `Term` it matched something
       else entirely and returned `paymentMode: not set -> opex`.

       A null from a broken reader and a null from a missing figure are the
       same reading (Verification 12), and the screenshot is what separated
       them: the page was rendering all five rows correctly the whole time.

       Read through the component's OWN structure instead of guessing at it. */
    const onScreen = await p.evaluate(() => {
      const valueFor = (name) => {
        for (const row of document.querySelectorAll('[data-testid="approval-view"] .ds-row')) {
          if ((row.querySelector('.ds-label')?.textContent ?? '').trim() === name) {
            return (row.querySelector('.ds-value')?.textContent ?? '').trim()
          }
        }
        return null
      }
      return {
        contractNet: valueFor('Contract net'), totalCost: valueFor('Total cost'),
        achievedMargin: valueFor('Achieved margin'), term: valueFor('Term'),
        // The first <p> is the block HEADING ("1. The ask"), not the sentence.
        // Anchored on what the sentence says rather than on its position.
        headline: ([...document.querySelectorAll('[data-testid="approval-view"] p')]
          .map((e) => (e.textContent ?? '').trim())
          .find((t) => t.startsWith('Approve ')) ?? '(no Approve sentence found)'),
      }
    })
    const num = (s) => s === null ? null : Number(String(s).replace(/[^0-9.-]/g, ''))
    const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    console.log(`   on screen : contract net ${onScreen.contractNet}, total cost ${onScreen.totalCost}, `
      + `margin ${onScreen.achievedMargin}, term ${onScreen.term}`)
    check(num(onScreen.contractNet) !== null && num(onScreen.contractNet) > 0,
      `the page's contract net is NON-ZERO (${onScreen.contractNet})`)
    check(String(onScreen.contractNet) === `$${money(direct.totals.contractNet)}`,
      `the page MATCHES the direct derivation: ${onScreen.contractNet} against $${money(direct.totals.contractNet)}`)
    /* THE PAGE'S "Total cost" IS `result.totalDealCostAll`, NOT
       `totals.totalDealCost`. Read from `ask` in approval-page.js rather than
       assumed: the difference is the finance cost, and comparing against the
       wrong one of the two would have failed on a page that is correct. */
    check(String(onScreen.totalCost) === `$${money(direct.totalDealCostAll)}`,
      `total cost matches: ${onScreen.totalCost} against $${money(direct.totalDealCostAll)}`)
    check(String(onScreen.achievedMargin) === `${direct.achievedMargin.toFixed(2)}%`,
      `achieved margin matches: ${onScreen.achievedMargin} against ${direct.achievedMargin.toFixed(2)}%`)
    check(onScreen.headline.includes(`$${money(direct.totals.contractNet)}`),
      `the headline sentence names the derived figure: "${onScreen.headline}"`)
    check(num(onScreen.term) === Number(v.inputs.duration),
      `term matches the frozen snapshot: ${onScreen.term} against ${v.inputs.duration} months`)

    await p.evaluate(() => window.scrollTo(0, 0))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    const file = `${OUT}interp-${rec.reference_code}-${label}.png`
    await p.screenshot({ path: file })
    console.log(`   photograph ${file}`)
  }
} finally { await b.close() }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
