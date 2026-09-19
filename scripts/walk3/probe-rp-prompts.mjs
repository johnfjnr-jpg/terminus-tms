// ── R-P: ARE THE LINK-ACCOUNT AND PARK PROMPTS HONEST? ───────────────────
//
// Walk 3, John's ruling. V4 measured the NOTE prompt and found it warning about
// a loss that does not happen: `useFieldRows` drops drafts only when the
// SUBJECT changes, and a reload of the same record does not change it. The note
// prompt was removed.
//
// Two prompts were left standing and said so in ContactHost's own comment:
// "Park, link-account and Back keep theirs below: Back is honest, measured, and
// the other two have not been measured, which is NOT the same as being wrong."
//
// This measures those two, with V4's own drive. Each is classified HONEST (the
// edit really is lost, so the warning is true and the prompt stays) or FALSE
// PREMISE (the edit survives, so the prompt threatens a loss that does not
// occur, and it goes the same way the note prompt went).
//
// READING SAYS BOTH ARE FALSE PREMISES - `onLinked` is `load()` and `park` ends
// in `setParkOpen(false); await load()`, both reloads of the SAME record with
// `subject` unchanged. Reading is not evidence (build discipline 2), which is
// the whole reason V4 existed, so it is driven.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates two Contacts and an Account.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-rp-prompts.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-rp-prompts.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshContact, freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w3rp'
const C = '#view-contact-detail'
const checks = []
const verdicts = {}
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// ── THE ACTION MUST BE PROVED TO HAVE LANDED, OR THE VERDICT IS WORTHLESS ──
//
// "The edit survived" is exactly what a run where NOTHING HAPPENED reports. A
// link that silently failed and a park that never transitioned would both leave
// the draft standing and this probe would call both prompts false premises on
// the strength of it - Verification 14's own shape, an alarm that would have
// fired whether or not the thing under test worked.
//
// So each verdict is gated on the record MOVING, read from the database rather
// than from the screen that just claimed it.
const db = admin()
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const recordRow = async (id) => must(await db.from('records')
  .select('id, status, parent_record_id').eq('id', id).single(), 'record')

const linkC = await freshContact(TAG)
const parkC = await freshContact(TAG)
const acct = await freshTestBed(TAG)   // creates `${TAG} Account`, something to link TO
console.log(`link contact ${linkC.contactId}\npark contact ${parkC.contactId}\naccount ${acct.accountId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  const settle = (fn, arg) => p.waitForFunction(fn, { timeout: 12000 }, arg).catch(() => false)
  const dialogueUp = () => p.evaluate(() => {
    const el = document.getElementById('discard-confirm-modal')
    if (!el) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && !el.hidden
  })
  const accept = () => p.evaluate(() => {
    const el = document.getElementById('discard-confirm-modal')
    const btn = [...el.querySelectorAll('button')].find((x) => /discard/i.test(x.textContent ?? ''))
    btn.click()
  })

  // Dirty the one editable row on this surface and read back WHAT THE EDITOR
  // ACTUALLY HOLDS rather than what was typed. `summary` is a textarea and this
  // estate has an open, recorded defect where a textarea reverses typed text,
  // so asserting the intended string would fail for a reason that has nothing
  // to do with the claim.
  const dirtyTheField = async () => {
    await settle((c) => !!document.querySelector(`${c} [data-testid="display-summary"]`), C)
    await p.click(`${C} [data-testid="display-summary"]`)
    await settle((c) => !!document.querySelector(`${c} [data-testid="input-summary"]`)
      && !document.querySelector(`${c} [data-testid="edit-summary"]`).hasAttribute('hidden'), C)
    await p.type(`${C} [data-testid="input-summary"]`, 'RPMARKER')
    await p.click(`${C} [data-testid="cd-header"]`)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    return p.evaluate((c) => ({
      held: document.querySelector(`${c} [data-testid="input-summary"]`)?.value ?? null,
      bar: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.textContent?.trim() ?? null,
      barHidden: document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)?.hasAttribute('hidden'),
    }), C)
  }
  const stillThere = (held) => p.evaluate((c, h) => {
    const el = document.querySelector(`${c} [data-testid="input-summary"]`)
    const ind = document.querySelector(`${c} [data-testid="cd-dirty-indicator"]`)
    return { value: el?.value ?? null, survives: (el?.value ?? '') === h,
      bar: ind?.textContent?.trim() ?? null, barHidden: ind?.hasAttribute('hidden') }
  }, C, held)

  // ══ PROMPT 1: LINK TO ACCOUNT ══════════════════════════════════════════
  console.log('  PROMPT 1: link to Account')
  await p.evaluate((id) => navigate('contact-detail', id), linkC.contactId)
  const d1 = await dirtyTheField()
  console.log(`  ${JSON.stringify(d1)}`)
  check(!d1.barHidden && /1 unsaved/.test(d1.bar ?? ''),
    `a field is genuinely dirty before the link ("${d1.bar}")`)

  await p.click(`${C} [data-testid="cd-btn-link-account"]`)
  await settle((c) => !!document.querySelector(`${c} [data-testid="cd-link-search"]`), C)
  await p.type(`${C} [data-testid="cd-link-search"]`, TAG)
  await settle((c) => document.querySelectorAll(`${c} [data-testid^="cd-link-"][data-testid!="cd-link-search"]`).length > 0, C)
  const target = await p.evaluate((c) => {
    const el = [...document.querySelectorAll(`${c} [data-testid^="cd-link-"]`)]
      .find((x) => /^cd-link-[0-9a-f-]{36}$/.test(x.getAttribute('data-testid') ?? ''))
    return el?.getAttribute('data-testid') ?? null
  }, C)
  check(!!target, `an Account is offered to link to (${target})`)
  await p.click(`${C} [data-testid="${target}"]`)
  await settle(() => {
    const el = document.getElementById('discard-confirm-modal')
    return !!el && getComputedStyle(el).display !== 'none' && !el.hidden
  })
  // ── AFTER THE FIX THIS INVERTS, and the inversion is the proof the removal
  // reached the screen rather than only the source. Before the fix this probe
  // recorded `raised1 = true` and the edit surviving; the verdict stands on
  // that measurement, and this now asserts the consequence.
  const raised1 = await dialogueUp()
  check(!raised1, 'and NO discard prompt is raised, because linking loses nothing')
  await p.screenshot({ path: `${OUT}rp-1-link.png` })
  if (raised1) await accept()
  await settle((c) => !!document.querySelector(`${c} [data-testid="cd-link-account-panel"]`) === false, C)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))

  const after1 = await stillThere(d1.held)
  const row1 = await recordRow(linkC.contactId)
  console.log(`  after accepting: ${JSON.stringify(after1)}`)
  console.log(`  the record: ${JSON.stringify(row1)}`)
  check(row1.parent_record_id === acct.accountId,
    `THE LINK ACTUALLY LANDED, so the verdict is about a real action (parent ${row1.parent_record_id})`)
  verdicts.linkAccount = after1.survives ? 'FALSE PREMISE' : 'HONEST'
  check(after1.value !== null, 'the state after the link was readable')
  console.log(`  >>> LINK TO ACCOUNT: ${verdicts.linkAccount} - the edit ${after1.survives ? 'SURVIVED' : 'WAS LOST'}\n`)

  // ══ PROMPT 2: SAVE AND PARK ════════════════════════════════════════════
  console.log('  PROMPT 2: save and park')
  await p.evaluate((id) => navigate('contact-detail', id), parkC.contactId)
  const d2 = await dirtyTheField()
  console.log(`  ${JSON.stringify(d2)}`)
  check(!d2.barHidden && /1 unsaved/.test(d2.bar ?? ''),
    `a field is genuinely dirty before the park ("${d2.bar}")`)

  await p.evaluate((c) => {
    const btn = [...document.querySelectorAll(`${c} button`)].find((x) => /^Nurture$/i.test(x.textContent?.trim() ?? ''))
    btn?.click()
  }, C)
  await settle((c) => !!document.querySelector(`${c} [data-testid="cd-park-form"]`), C)
  check(await p.evaluate((c) => !!document.querySelector(`${c} [data-testid="cd-park-form"]`), C),
    'the park form opened')
  // Both fields, because the form validates its OWN inputs before it ever asks
  // about the field edits - so a missing date would stop this short of the
  // prompt and the probe would report a silence that meant nothing.
  await p.type(`${C} [data-testid="cd-park-date"]`, '12/31/2026')
  await p.type(`${C} [data-testid="cd-park-reason"]`, 'measuring the prompt')
  await p.click(`${C} [data-testid="cd-park-save"]`)
  await settle(() => {
    const el = document.getElementById('discard-confirm-modal')
    return !!el && getComputedStyle(el).display !== 'none' && !el.hidden
  })
  const raised2 = await dialogueUp()
  check(!raised2, 'and NO discard prompt is raised, because parking loses nothing')
  await p.screenshot({ path: `${OUT}rp-2-park.png` })
  if (raised2) await accept()
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))

  const after2 = await stillThere(d2.held)
  const row2 = await recordRow(parkC.contactId)
  console.log(`  after accepting: ${JSON.stringify(after2)}`)
  console.log(`  the record: ${JSON.stringify(row2)}`)
  check(row2.status === 'Nurture',
    `THE PARK ACTUALLY LANDED, so the verdict is about a real action (status ${row2.status})`)
  verdicts.park = after2.survives ? 'FALSE PREMISE' : 'HONEST'
  check(after2.value !== null, 'the state after the park was readable')
  console.log(`  >>> SAVE AND PARK: ${verdicts.park} - the edit ${after2.survives ? 'SURVIVED' : 'WAS LOST'}`)
} finally {
  await b.close()
  console.log(`\n  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

console.log(`\n  VERDICTS: ${JSON.stringify(verdicts)}`)
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
