// F1, ON A RECORD THE SESSION OWNS, so the ENABLED claim and the NAMED claim
// are proven together.
//
// WHY THIS IS SEPARATE: the live records are John's, and against them the
// ownership door correctly disables every write control - so `disabled=true`
// there is my session, not a defect, and reporting it as one would be a
// finding manufactured by the instrument (V25's population clause).
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk7/probe-f1-owned.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk7/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const TAG = 'w7f1'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const opp = await freshOpportunity(TAG)
// The fixture's account, and contacts hung off it the way the SYSTEM does:
// a contact's account is `parent_record_id` (V47, and the column walk 5's
// first two passes got wrong).
const oppRow = must(await db.from('records').select('account_id').eq('id', opp.oppId).single(), 'opp')
const accountId = oppRow.account_id
const mine = must(await db.from('records').select('id, payload:record_revisions!inner(payload)')
  .eq('record_type', 'contact').eq('parent_record_id', accountId).is('deleted_at', null), 'contacts')
console.log(`fixture opportunity ${opp.oppId}\n  account ${accountId}\n  contacts on that account: ${mine.length}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && v.querySelector('[data-testid="kc-add-contact"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))

    // SCROLLED INTO VIEW BEFORE THE SHUTTER, and proven visible rather than
    // merely positioned: `.is-loading > *` hides children while preserving
    // layout, so geometry reads healthy on a blank picture.
    await p.evaluate(() => document.querySelector('[data-testid="ref-key-contacts"]')
      ?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const card = document.querySelector('[data-testid="ref-key-contacts"]')
      const sel = card?.querySelector('[data-testid="kc-add-contact"]')
      const r = card?.getBoundingClientRect()
      return {
        disabled: sel ? sel.disabled : null,
        options: sel ? [...sel.options].map((o) => o.text) : [],
        readOnlyBanner: !!document.querySelector('[data-testid="ref-readonly"], .ref-readonly')
          || (document.body.innerText || '').includes("ANOTHER USER'S RECORD"),
        inShot: !!r && r.top < window.innerHeight && r.bottom > 0
          && getComputedStyle(card).visibility === 'visible',
      }
    })
    const named = m.options.slice(1)
    console.log(`\n=== ${width}px ===`)
    console.log(`  options: ${JSON.stringify(m.options)}`)
    console.log(`  read-only banner on screen: ${m.readOnlyBanner}`)
    check(m.inShot, `the card is inside the captured region and visible at ${width}`)
    check(!m.readOnlyBanner, `the session OWNS this record, so the door is not the explanation at ${width}`)
    check(m.disabled === false, `F1 the picker is ENABLED on an owned record with an account at ${width}`)
    check(named.length === mine.length, `F1 it offers every contact on the account at ${width}`,
      `${named.length} offered against ${mine.length} on the account`)
    check(named.length > 0 && named.every((t) => t && t.trim()),
      `F1 and every option carries a NAME rather than rendering blank at ${width}`,
      JSON.stringify(named))
    await p.screenshot({ path: `${OUT}f1-owned-${width}.png` })
  }
} finally { await b.close(); await tearDown([TAG]) }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
