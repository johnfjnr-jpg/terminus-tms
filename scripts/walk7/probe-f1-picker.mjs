// F1. DOES THE KEY CUSTOMER CONTACTS PICKER POPULATE?
//
// Measured on REAL records rather than a fixture, because the report is about
// John's own screen and a fixture would be built the way the code reads it
// (V47). Every one of the 18 live opportunities carries an account_id and
// every one of those accounts holds contacts, so an empty picker has no data
// explanation.
//
// HARD RELOAD FIRST (V42): two of walk 4's three findings were code that had
// already been fixed.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk7/probe-f1-picker.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk7/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const opps = must(await db.from('records').select('id, reference_code, account_id, status')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
const contacts = must(await db.from('records').select('id, parent_record_id')
  .eq('record_type', 'contact').is('deleted_at', null).limit(500), 'contacts')
const byAccount = {}
for (const c of contacts) if (c.parent_record_id) (byAccount[c.parent_record_id] ??= []).push(c)

// One per STATUS, so a status-dependent cause cannot hide behind one sample.
const seen = new Set()
const sample = []
for (const o of opps) {
  if (seen.has(o.status)) continue
  seen.add(o.status); sample.push(o)
}
console.log(`sampling ${sample.length} opportunities, one per status\n`)

const b = await puppeteer.launch({ headless: 'new' })
const rows = []
try {
  const p = await b.newPage()
  const seenReq = []
  p.on('request', (r) => { if (r.url().includes('/api/contacts')) seenReq.push(r.url()) })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const o of sample) {
   for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    seenReq.length = 0
    await p.reload({ waitUntil: 'networkidle0' })          // hard reload, V42
    await p.evaluate((id) => navigate('opportunity-detail', id), o.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && v.querySelector('[data-testid="ref-key-contacts"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))

    const m = await p.evaluate(() => {
      const card = document.querySelector('[data-testid="ref-key-contacts"]')
      if (!card) return { card: false }
      const sel = card.querySelector('select')
      return {
        card: true,
        noAccountMsg: (card.textContent ?? '').includes('no linked account'),
        text: (card.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 110),
        hasSelect: !!sel,
        selDisabled: sel ? sel.disabled : null,
        optionCount: sel ? sel.options.length : 0,
        options: sel ? [...sel.options].map((x) => x.text).slice(0, 8) : [],
      }
    })
    const expect = (byAccount[o.account_id] ?? []).length
    const blanks = m.options.filter((t) => !t || !t.trim()).length
    rows.push({ ref: o.reference_code, status: o.status, width, expect, blanks, ...m })
    console.log(`${o.reference_code}  ${o.status}  @${width}`)
    console.log(`   account has ${expect} contacts; picker offers ${m.optionCount} option(s), disabled=${m.selDisabled}, noAccountMsg=${m.noAccountMsg}`)
    console.log(`   request(s) to /api/contacts: ${seenReq.length ? seenReq.map((u) => u.replace('http://127.0.0.1:3000', '')).join(' , ') : 'NONE'}`)
    console.log(`   options: ${JSON.stringify(m.options)}`)
    console.log(`   card reads: ${JSON.stringify(m.text)}\n`)
    if (o === sample[1]) await p.screenshot({ path: `${OUT}f1-picker-${width}.png` })
   }
  }
} finally { await b.close() }

console.log('─── SUMMARY ───')
let bad = 0
for (const r of rows) {
  // TWO CLAIMS, NOT ONE: the right contacts ARRIVE, and each one is LABELLED.
  // R-W3 satisfied the first and the second is what John was looking at.
  const right = r.optionCount === r.expect + 1
  const named = r.blanks === 0
  if (!right || !named) bad++
  console.log(`  ${right ? 'SCOPED' : 'WRONG '} ${named ? 'NAMED  ' : 'BLANK  '}  ${r.ref}  @${r.width}  expect ${r.expect}, offers ${r.optionCount - 1}, blank ${r.blanks}`)
}
console.log(bad === 0 ? '\nALL SCOPED AND NAMED' : `\n${bad} FAILING`)
process.exit(bad === 0 ? 0 : 1)
