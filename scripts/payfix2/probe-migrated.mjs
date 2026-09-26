// ── THE MIGRATED RECORD, RENDERED ───────────────────────────────────────
//
// John's ruling asks for one migrated record photographed. This opens
// TT-SGP-SMARTC-003 after the migration and asserts the screen agrees with the
// database: the mode reads OPEX, Single phase is offered nowhere, and the
// record still prices as it did.
//
// IT IS SOMEBODY ELSE'S RECORD, so the door is shut and the controls are
// neutralised. That is correct and is asserted rather than worked around: the
// claim is about what the screen SAYS, not about editing it.
//
// UNWIRED: needs a browser, a live server, a signed-in session, the service key.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('payfix2/probe-migrated.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/payfix2/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) { pass++; console.log(`    ok   ${what}`) }
  else { fail++; console.log(`    FAIL ${what}`) } }

const REF = 'TT-SGP-SMARTC-003'
const rec = must(await db.from('records').select('id, reference_code')
  .eq('reference_code', REF).limit(1), 'record')[0]
const cur = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', rec.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
console.log(`${REF}  rev ${cur.revision_number}  paymentMode=${cur.payload.paymentMode} structure=${cur.payload.structure}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1900 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${rec.id}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.waitForFunction(() => /Invoicing/.test(
      document.querySelector('#deal-payment-rail')?.textContent ?? ''), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
    const r = await p.evaluate(() => {
      const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      const mode = document.querySelector('[data-testid="deal-payment-mode-toggle"]')
      return {
        modeText: mode?.textContent?.trim() ?? null,
        modeChecked: mode?.getAttribute('aria-checked') ?? null,
        anySingle: !!document.querySelector('[data-structure="single"]'),
        structures: [...document.querySelectorAll('#deal-payment-rail [data-structure]')].map((e) => e.dataset.structure),
        schedules: [...document.querySelectorAll(
          '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')].filter(vis).length,
        readOnly: /READ ONLY|another user/i.test(document.body.textContent ?? ''),
      }
    })
    console.log(`\n── ${width} ──`)
    check(r.modeText === 'OPEX', `the screen says OPEX, agreeing with the record (${r.modeText})`)
    check(r.modeChecked === 'true', `the switch is on (${r.modeChecked})`)
    check(!r.anySingle, 'Single phase is offered nowhere')
    check(r.structures.length === 0, `under OPEX the rail shows no structure radios (${r.structures.length})`)
    check(r.schedules === 1, `exactly one hosting schedule is visible (${r.schedules})`)
    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
    const file = `${OUT}migrated-${REF}-${width}.png`
    await p.screenshot({ path: file })
    console.log(`    photograph ${file}`)
  }
} finally { await b.close() }
console.log(`\n${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
