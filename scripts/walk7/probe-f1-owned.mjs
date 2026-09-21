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
    // ── THE ROLE AND STANCE DROPDOWNS, same card, same mistype ──────────
    const vocab = await p.evaluate(() => {
      const opts = (sel) => { const e = document.querySelector(sel)
        return e ? [...e.options].map((o) => o.text) : [] }
      return { roles: opts('[data-testid="kc-add-role"]') }
    })
    const roleNames = vocab.roles.filter((t) => t !== 'Role' && t !== 'Other')
    check(roleNames.length > 0 && roleNames.every((t) => t && t.trim()),
      `F1 every ROLE option carries a label rather than rendering blank at ${width}`,
      JSON.stringify(roleNames.slice(0, 4)))

    await p.screenshot({ path: `${OUT}f1-owned-${width}.png` })

    // ── AND THE ADD ACTUALLY LANDS, driven through the UI and read back
    // from the DATABASE. The route takes role_id or role_other and the
    // client sent `role`, so every Add answered 400.
    if (width === 1440) {
      // BRACKETED. The fixture already links its own contact as the customer
      // lead, so the count before is not zero and the row this Add creates is
      // found by its contact_id rather than by position. Asserting on
      // `after[0]` read the PRE-EXISTING row and reported a null role_id.
      const before = must(await db.from('record_contacts')
        .select('id, contact_id').eq('record_id', opp.oppId), 'before')
      const target = mine.find((c) => !before.some((b) => b.contact_id === c.id))
      if (!target) throw new Error('every contact on the account is already linked')
      await p.select('[data-testid="kc-add-contact"]', target.id)
      const roleId = await p.evaluate(() => {
        const e = document.querySelector('[data-testid="kc-add-role"]')
        const o = [...e.options].find((x) => x.value && x.value !== 'Other')
        return o ? o.value : null
      })
      await p.select('[data-testid="kc-add-role"]', roleId)
      await p.click('[data-testid="kc-add"]')
      await p.waitForFunction(() => {
        const f = document.querySelector('[data-testid="kc-feedback"]')
        return f && (f.textContent || '').trim().length > 0
      }, { timeout: 15000 })
      const feedback = await p.evaluate(() =>
        document.querySelector('[data-testid="kc-feedback"]').textContent.trim())
      const after = must(await db.from('record_contacts')
        .select('id, role_id, contact_id').eq('record_id', opp.oppId), 'after')
      const mineRow = after.find((r) => r.contact_id === target.id)
      console.log(`  Add feedback: ${JSON.stringify(feedback)}`)
      console.log(`  record_contacts rows: ${before.length} -> ${after.length}`)
      check(feedback === 'Added.', 'F1 the Add reports success', feedback)
      check(after.length === before.length + 1,
        'F1 and the link LANDED in the database, not just on screen',
        `${before.length} -> ${after.length}`)
      check(!!mineRow && mineRow.role_id === roleId,
        'F1 carrying the role_id the route requires, which the old body could not send',
        `${mineRow?.role_id} against ${roleId}`)
    }
  }
} finally { await b.close(); await tearDown([TAG]) }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
