// K3's GUARD: the dialogue prevents the loss on cancel, and performs it on
// confirm. Both verdicts are read from the DATABASE, not from the screen.
//
// Verification 52's own remedy: "gate the verdict on the action having
// LANDED, read from the authority rather than from the screen that just
// claimed it - 'it survived' is exactly what a run where nothing happened
// reports." So the cancel path asserts the rows are STILL THERE after a
// cancel that was itself proven to have happened, and the confirm path
// asserts they are gone.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk9/probe-k3-dialogue.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api as apiCall } from '../api-client.mjs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk9/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const TAG = 'w9k3g'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const rows = async (oppId) => must(await db.from('record_contacts')
  .select('id').eq('record_id', oppId), 'links').length
const stanceRows = async (linkId) => must(await db.from('record_contact_stances')
  .select('id').eq('record_contact_id', linkId), 'stances').length

const opp = await freshOpportunity(TAG)
try {
  const oppRow = must(await db.from('records').select('account_id').eq('id', opp.oppId).single(), 'opp')
  const contacts = must(await db.from('records').select('id')
    .eq('record_type', 'contact').eq('parent_record_id', oppRow.account_id).is('deleted_at', null), 'contacts')
  const roles = await apiCall('GET', '/contact-roles')
  const stances = await apiCall('GET', '/contact-stances')
  // A CONTACT NOT ALREADY LINKED. `freshOpportunity` links its own contact as
  // the customer lead, so picking blindly selected one that was already there
  // and the lookup below matched two rows.
  const existing = must(await db.from('record_contacts').select('contact_id')
    .eq('record_id', opp.oppId), 'existing').map((r) => r.contact_id)
  const target = contacts.find((c) => !existing.includes(c.id))
  if (!target) throw new Error('every contact on the account is already linked, so there is nothing to arm')
  await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts`,
    { contact_id: target.id, role_id: roles.data[0].id })
  const link = must(await db.from('record_contacts').select('id, contact_id')
    .eq('record_id', opp.oppId).eq('contact_id', target.id).single(), 'link')
  await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts/${link.id}/stance`,
    { stance_id: stances.data[0].id, note: 'must survive a cancel' })
  const armed = { links: await rows(opp.oppId), stances: await stanceRows(link.id) }
  console.log(`armed: ${armed.links} links, ${armed.stances} stance entr(ies) on the target\n`)

  const b = await puppeteer.launch({ headless: 'new' })
  try {
    const p = await b.newPage()
    for (const width of [1440, 1240]) {
      await p.setViewport({ width, height: 1200 })
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
      await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
      await p.reload({ waitUntil: 'networkidle0' })
      await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
      // SETTLED, not merely present: `.is-loading > *` hides children while
      // preserving layout, so the x has a healthy rectangle mid-load and a
      // click lands on the loading wrap.
      await p.waitForFunction((lid) => {
        const v = document.getElementById('view-opportunity-detail')
        if (!v || v.classList.contains('hidden') || v.classList.contains('is-loading')) return false
        if (document.querySelector('.wrap.is-loading')) return false
        const x = v.querySelector(`[data-testid="kc-remove-${lid}"]`)
        return !!x && getComputedStyle(x).visibility === 'visible'
      }, { timeout: 25000 }, link.id)
      await p.evaluate(() => document.fonts.ready)
      console.log(`\n=== ${width}px ===`)

      // ── THE DIALOGUE OPENS, AND NAMES THE CONTACT ────────────────────
      await p.click(`[data-testid="kc-remove-${link.id}"]`)
      // THE DIALOGUE OPENING IS A CHECK, NOT A WAIT. Under calibration the
      // injection that removes the dialogue made this a hard timeout, so the
      // probe DIED and the harness read "the check never ran" - scoring a real
      // injection SILENT. An assertion here gives the injection something
      // named to fail, which is what a calibration reads.
      let opened = true
      try {
        await p.waitForFunction(() => document.querySelector('[data-testid="kc-confirm-remove"]'),
          { timeout: 10000 })
      } catch { opened = false }
      check(opened, `K3 the x OPENS a confirmation rather than removing at ${width}`)
      if (!opened) {
        const now = { links: await rows(opp.oppId), stances: await stanceRows(link.id) }
        check(false, `K3 and the link SURVIVES the click at ${width}`,
          `${armed.links} -> ${now.links} links, ${armed.stances} -> ${now.stances} stance entr(ies)`)
        break
      }
      const dlg = await p.evaluate(() => {
        const m = document.querySelector('[data-testid="kc-confirm-remove"]')
        const panel = m.querySelector('[role="dialog"]')
        return {
          body: (m.querySelector('[data-testid="kc-confirm-body"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          detail: (m.querySelector('[data-testid="kc-confirm-detail"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          hasCancel: !!m.querySelector('[data-testid="kc-confirm-cancel"]'),
          hasGo: !!m.querySelector('[data-testid="kc-confirm-remove-go"]'),
          ariaModal: panel?.getAttribute('aria-modal'),
          // KEYBOARD: focus must be INSIDE the dialogue on open.
          focusInside: !!panel && panel.contains(document.activeElement),
          focused: document.activeElement?.getAttribute('data-testid') ?? null,
        }
      })
      console.log(`  body  : ${JSON.stringify(dlg.body)}`)
      console.log(`  detail: ${JSON.stringify(dlg.detail)}`)
      const name = must(await db.from('record_revisions').select('payload')
        .eq('record_id', link.contact_id).order('revision_number', { ascending: false }).limit(1), 'cname')[0]?.payload?.name
      check(dlg.body.includes(name), `K3 the dialogue NAMES the contact at ${width}`, `expected ${JSON.stringify(name)}`)
      check(/stance/i.test(dlg.detail) && /cannot be undone/i.test(dlg.detail),
        `K3 and states what is removed and that it cannot be undone at ${width}`)
      check(dlg.hasCancel && dlg.hasGo, `K3 it offers both confirm and cancel at ${width}`)
      check(dlg.ariaModal === 'true', `K3 it is a real dialogue to a screen reader at ${width}`)
      check(dlg.focusInside, `K3 focus is inside the dialogue on open at ${width}`, `on ${dlg.focused}`)
      await p.screenshot({ path: `${OUT}k3-dialogue-${width}.png` })

      // ── CANCEL BY KEYBOARD, AND THE LOSS DOES NOT HAPPEN ─────────────
      await p.keyboard.press('Escape')
      await p.waitForFunction(() => !document.querySelector('[data-testid="kc-confirm-remove"]'),
        { timeout: 10000 })
      const afterEsc = { links: await rows(opp.oppId), stances: await stanceRows(link.id) }
      check(afterEsc.links === armed.links && afterEsc.stances === armed.stances,
        `K3 ESCAPE cancels and the link and its stance SURVIVE at ${width}`,
        `${afterEsc.links} links, ${afterEsc.stances} stance entr(ies)`)

      // ── AND CANCEL BY BUTTON ─────────────────────────────────────────
      await p.click(`[data-testid="kc-remove-${link.id}"]`)
      await p.waitForFunction(() => document.querySelector('[data-testid="kc-confirm-cancel"]'), { timeout: 10000 })
      await p.click('[data-testid="kc-confirm-cancel"]')
      await p.waitForFunction(() => !document.querySelector('[data-testid="kc-confirm-remove"]'), { timeout: 10000 })
      const afterCancel = { links: await rows(opp.oppId), stances: await stanceRows(link.id) }
      check(afterCancel.links === armed.links && afterCancel.stances === armed.stances,
        `K3 CANCEL closes and the link and its stance SURVIVE at ${width}`,
        `${afterCancel.links} links, ${afterCancel.stances} stance entr(ies)`)
    }

    // ── AND CONFIRM PERFORMS IT, ONCE, READ BACK ───────────────────────
    await p.click(`[data-testid="kc-remove-${link.id}"]`)
    await p.waitForFunction(() => document.querySelector('[data-testid="kc-confirm-remove-go"]'), { timeout: 10000 })
    await p.click('[data-testid="kc-confirm-remove-go"]')
    await p.waitForFunction(() => {
      const f = document.querySelector('[data-testid="kc-feedback"]')
      return f && /removed/i.test(f.textContent ?? '')
    }, { timeout: 15000 })
    const afterGo = { links: await rows(opp.oppId), stances: await stanceRows(link.id) }
    check(afterGo.links === armed.links - 1,
      'K3 CONFIRM performs the removal, read back from the database',
      `${armed.links} -> ${afterGo.links} links`)
    check(afterGo.stances === 0 && armed.stances > 0,
      'K3 and the stance history goes with it, as the dialogue said',
      `${armed.stances} -> ${afterGo.stances}`)
    const audit = must(await db.from('audit_log').select('detail').eq('record_id', opp.oppId)
      .eq('action', 'key_contact_removed'), 'audit')
    check(audit.length === 1 && (audit[0].detail?.stance_history?.length ?? 0) === armed.stances,
      'K3 and the audit row carries the history, which is why "cannot be undone HERE" is the honest wording',
      `${audit.length} row(s), ${audit[0]?.detail?.stance_history?.length ?? 0} stance entr(ies) preserved`)
  } finally { await b.close() }
} finally { await tearDown([TAG]) }
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
