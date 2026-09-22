// K3, PER VERIFICATION 52: MEASURE THE LOSS BEFORE BUILDING A WARNING ABOUT IT.
//
// Walk 3 found three dialogues on one screen warning about a loss that never
// happened, and no test could fail, because being wrong about a hypothetical
// is not an error. So this drives the x and reads the DATABASE either side,
// gating the verdict on the removal having LANDED rather than on the screen
// saying it did.
//
// The state is built with a STANCE recorded, because a stance history is the
// part the cascade destroys and a removal with nothing to lose would measure
// the easy case.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk9/probe-k3-removal.mjs')
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
const TAG = 'w9k3'

const opp = await freshOpportunity(TAG)
try {
  const oppRow = must(await db.from('records').select('account_id').eq('id', opp.oppId).single(), 'opp')
  const contacts = must(await db.from('records').select('id')
    .eq('record_type', 'contact').eq('parent_record_id', oppRow.account_id).is('deleted_at', null), 'contacts')
  const roles = await apiCall('GET', '/contact-roles')
  const stances = await apiCall('GET', '/contact-stances')

  const added = await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts`,
    { contact_id: contacts[0].id, role_id: roles.data[0].id })
  const linkId = must(await db.from('record_contacts').select('id')
    .eq('record_id', opp.oppId).eq('contact_id', contacts[0].id).single(), 'link').id
  // A STANCE, so there is history for the cascade to destroy.
  await apiCall('POST', `/opportunities/${opp.oppId}/key-contacts/${linkId}/stance`,
    { stance_id: stances.data[0].id, note: 'measured before removal' })

  const before = {
    links: must(await db.from('record_contacts').select('id').eq('record_id', opp.oppId), 'b-links').length,
    stances: must(await db.from('record_contact_stances').select('id').eq('record_contact_id', linkId), 'b-st').length,
    audit: must(await db.from('audit_log').select('id').eq('record_id', opp.oppId)
      .eq('action', 'key_contact_removed'), 'b-audit').length,
  }
  console.log(`BEFORE  links ${before.links}, stance entries ${before.stances}, removal audit rows ${before.audit}`)

  const b = await puppeteer.launch({ headless: 'new' })
  let clicked = false
  try {
    const p = await b.newPage()
    await p.setViewport({ width: 1440, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    // WAIT ON A SETTLED VIEW, NOT ON THE ELEMENT EXISTING. `.is-loading > *`
    // hides children while PRESERVING LAYOUT, so the x exists and has a
    // healthy rectangle while the whole view is still loading - and the first
    // run of this probe clicked into `DIV.wrap is-loading` and changed
    // nothing, then reported "the removal did not happen".
    await p.waitForFunction((lid) => {
      const v = document.getElementById('view-opportunity-detail')
      if (!v || v.classList.contains('hidden') || v.classList.contains('is-loading')) return false
      if (document.querySelector('.wrap.is-loading')) return false
      const x = v.querySelector(`[data-testid="kc-remove-${lid}"]`)
      return !!x && getComputedStyle(x).visibility === 'visible'
    }, { timeout: 25000 }, linkId)
    await p.evaluate(() => document.fonts.ready)
    // WHAT THE SCREEN OFFERS BEFORE THE CLICK: is there any confirmation at
    // all today, and does the control say what it does?
    const control = await p.evaluate((lid) => {
      const x = document.querySelector(`[data-testid="kc-remove-${lid}"]`)
      return { text: (x.textContent || '').trim(), title: x.getAttribute('title'),
        aria: x.getAttribute('aria-label'), tag: x.tagName }
    }, linkId)
    console.log(`the control reads ${JSON.stringify(control)}`)

    let dialogueSeen = false
    p.on('dialog', async (d) => { dialogueSeen = true; await d.accept() })
    // WHAT IS ACTUALLY AT THE POINT, before blaming the handler. CLAUDE.md
    // records the case: present, enabled and in view are three properties of
    // the element, and what is ON TOP of it is a fourth that no assertion
    // about the element can see. The first run of this probe changed nothing
    // and reported a dialogue on screen, which is that shape exactly.
    const atPoint = await p.evaluate((lid) => {
      const x = document.querySelector(`[data-testid="kc-remove-${lid}"]`)
      x.scrollIntoView({ block: 'center' })
      const r = x.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const overlays = [...document.querySelectorAll('[role="dialog"], .modal-backdrop')]
        .filter((e) => !e.classList.contains('hidden'))
        .map((e) => `${e.className || e.tagName} vis=${getComputedStyle(e).visibility} disp=${getComputedStyle(e).display}`)
      return {
        hit: hit ? `${hit.tagName}.${hit.className}` : '(nothing)',
        isTheX: hit === x || x.contains(hit),
        rect: { t: Math.round(r.top), l: Math.round(r.left) },
        overlays,
      }
    }, linkId)
    console.log(`at the x's own point: ${atPoint.hit}  -> is it the x? ${atPoint.isTheX}`)
    console.log(`  overlays not hidden: ${JSON.stringify(atPoint.overlays)}`)
    await p.click(`[data-testid="kc-remove-${linkId}"]`)
    clicked = true
    await p.waitForFunction(() => {
      const f = document.querySelector('[data-testid="kc-feedback"]')
      return f && (f.textContent || '').trim().length > 0
    }, { timeout: 15000 }).catch(() => {})
    const after = await p.evaluate((lid) => ({
      feedback: (document.querySelector('[data-testid="kc-feedback"]')?.textContent ?? '').trim(),
      rowGone: !document.querySelector(`[data-testid="kc-row-${lid}"]`),
      // SCOPED, and the first version was not. `.modal-panel` matches the
      // shell's own modals, which sit in the DOM on every page; a
      // document-wide query reported "a dialogue on screen" on a page with
      // none, which would have made the "no confirmation today" claim
      // unfalsifiable. What matters is a VISIBLE overlay whose backdrop is
      // actually displayed.
      anyConfirmOnScreen: [...document.querySelectorAll('[role="dialog"], .modal-backdrop, .modal-panel')]
        .filter((e) => {
          const r = e.getBoundingClientRect()
          return getComputedStyle(e).display !== 'none'
            && getComputedStyle(e).visibility === 'visible'
            && r.width > 0 && r.height > 0
        }).map((e) => e.className || e.tagName),
    }), linkId)
    console.log(`\nAFTER THE CLICK`)
    console.log(`  native confirm() dialogue shown : ${dialogueSeen}`)
    console.log(`  a VISIBLE in-page dialogue      : ${JSON.stringify(after.anyConfirmOnScreen)}`)
    console.log(`  the row left the screen         : ${after.rowGone}`)
    console.log(`  feedback                        : ${JSON.stringify(after.feedback)}`)
    await p.screenshot({ path: `${OUT}k3-after-removal.png` })
  } finally { await b.close() }

  if (!clicked) throw new Error('the x was never clicked, so nothing below is a measurement of removal')

  const post = {
    links: must(await db.from('record_contacts').select('id').eq('record_id', opp.oppId), 'a-links').length,
    stances: must(await db.from('record_contact_stances').select('id').eq('record_contact_id', linkId), 'a-st').length,
    auditRows: must(await db.from('audit_log').select('id, detail').eq('record_id', opp.oppId)
      .eq('action', 'key_contact_removed'), 'a-audit'),
  }
  const record = await apiCall('GET', `/opportunities/${opp.oppId}`)
  console.log(`\nAFTER, READ FROM THE DATABASE`)
  console.log(`  record_contacts rows        : ${before.links} -> ${post.links}`)
  console.log(`  record_contact_stances rows : ${before.stances} -> ${post.stances}`)
  console.log(`  key_contact_removed audit   : ${before.audit} -> ${post.auditRows.length}`)
  console.log(`  the record's own key_contacts: ${(record.data?.key_contacts ?? []).length}`)
  const d = post.auditRows[0]?.detail
  console.log(`  the audit row's detail keys : ${d ? Object.keys(d).join(', ') : '(none)'}`)
  console.log(`  stance history preserved in it: ${d?.stance_history?.length ?? 0} entr(ies)`)
  console.log(`\nVERDICT`)
  console.log(`  the link is destroyed immediately : ${post.links === before.links - 1}`)
  console.log(`  its stance history is destroyed   : ${post.stances === 0 && before.stances > 0}`)
  console.log(`  a full copy survives in audit_log : ${(d?.stance_history?.length ?? 0) === before.stances && !!d?.contact_id}`)
} finally { await tearDown([TAG]) }
