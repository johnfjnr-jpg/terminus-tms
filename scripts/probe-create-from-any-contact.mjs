#!/usr/bin/env node
// ── CREATE_FROM_ANY_CONTACT R9: A READER CREATES THEIR OWN RECORD ──────────
//
//   node --env-file=.env scripts/probe-create-from-any-contact.mjs [tag]
//
// John's ruling 2026-11-22 (CREATE_FROM_ANY_CONTACT_BRIEF.md): any signed-in
// user may create an Opportunity (R1) or a Test Bed (R4) from ANY contact they
// can see. The creator owns the new record; creation writes nothing on the
// contact or its Account. Editing the contact stays owner-only (R6), and Test
// Bed convert stays owner-only (R3).
//
// FROM THE CLICK, AS THE NON-OWNER. The contact AND its Account are owned by
// another real user: built the way the system builds them (the routes), then
// handed over by the ledgered handOver (Verification 47's clause: the door and
// the policies read owner_id and nothing about how it arrived).
//
//   1. both entry points, both kinds: the Contacts list and the contact's own
//      screen each send ONE create POST, answered 201, and land on the new
//      record's screen (4 creations);
//   2. ownership and link: each new record is the creator's, its account_id is
//      the contact's Account, and its record_contacts link is on ITS side;
//   3. nothing written on the contact: revision, updated_at, owner, status,
//      audit rows, record_freshness and links held, unchanged by each creation;
//   4. nothing written on the Account: the same fingerprint, unchanged;
//   5. no weakening, the counterfactuals:
//      a. the same non-owner's PATCH of the contact is refused 403 with the
//         ownership sentence, and nothing moved;
//      b. the contact screen is still doored: it carries is-not-mine and its
//         field rows take no pointer, while the two create items are live;
//      c. Test Bed convert stays owner-only (R3): converting a bed somebody
//         else owns is refused 403, and the bed did not move.
//
// The fingerprint is calibrated in its own run (a contact-keyed write moves
// it), so its "unchanged" is a reading, not a silence (Verification 13).
// Calibrated by scripts/create-from-any-contact/calibrate-probe.mjs against a
// temp copy on another port, each injection read by the check it names.
//
// TMS_BASE (default http://localhost:3000) points it at a server; the browser
// and the API both use it, so a calibration copy is measured end to end.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api as apiCall } from './api-client.mjs'
import { admin, handOver, tearDown } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { OWNERSHIP_REFUSAL } from '../src/lib/write-errors.js'

const TAG = process.argv[2] ?? 'cfanyprobe'
const BASE = process.env.TMS_BASE ?? 'http://localhost:3000'
const SHOT_DIR = '.verify/create-from-any-contact'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const api = async (m, p, b) => (await apiCall(m, p, b)).data
// A refusal is RECORDED, never thrown on, so a refusal that does not happen
// reaches its check and fails there.
const attempt = (m, p, b, because) => apiCall(m, p, b, { expect: 403, because })
  .catch((e) => ({ status: e.status, data: e.body?.got ?? e.body }))

const db = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const ME = session.user.id
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]

// ── THE FINGERPRINT (Verification 40's clause: a 2xx is not a write) ─────
const fp = async (id) => JSON.stringify({
  rev: must(await db.from('record_revisions').select('revision_number').eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single(), 'rev').revision_number,
  row: must(await db.from('records').select('updated_at, owner_id, status').eq('id', id).single(), 'row'),
  // A fixture record carries a handful of audit rows; the count is exact and
  // the list is bounded, so a row past the bound still moves the count.
  auditCount: (await db.from('audit_log').select('id', { count: 'exact', head: true }).eq('record_id', id)).count,
  audit: must(await db.from('audit_log').select('action').eq('record_id', id).order('timestamp').range(0, 199), 'audit').map((a) => a.action),
  fresh: must(await db.from('record_freshness').select('freshness_at').eq('record_id', id).maybeSingle(), 'fresh')?.freshness_at ?? null,
  linksHeld: (await db.from('record_contacts').select('id', { count: 'exact', head: true }).eq('record_id', id)).count,
})

// The browser BEFORE the fixture: a missing browser must stop the run before
// it creates anything it would then leave behind.
const puppeteer = await loadPuppeteer('probe-create-from-any-contact.mjs')

// ── THE FIXTURE: an Account and two Qualified contacts, then handed away ──
const other = must(await db.from('track_approvers').select('user_id').neq('user_id', ME).limit(1), 'another user')[0]?.user_id
if (!other) throw new Error('no second real user to own the fixture: the claim needs one')
const industry = (await api('GET', '/industries'))[0]
const account = await api('POST', '/accounts', { name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore' })
const mkContact = async (which) => {
  const c = await api('POST', '/contacts', {
    name: `${TAG} ${which} Contact`, company: `${TAG} Holdings`,
    email: `${TAG}-${which}@example.invalid`, mobile: '+65 9000 0001',
    industry_id: industry.id, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
    linkedin: 'https://example.invalid/in/x', address: '1 Fixture Street', address2: 'Level 2',
    city: 'Singapore', postcode: '018956', country: 'Singapore', region: 'Asia Pacific',
    summary: `Fixture for ${TAG}.`,
  })
  await api('POST', `/contacts/${c.id}/link-account`, { account_id: account.id })
  await api('POST', `/records/${c.id}/transition`, { to_stage: 'Qualified' })
  return c.id
}
const contacts = { list: await mkContact('list'), detail: await mkContact('detail') }
for (const id of [...Object.values(contacts), account.id]) await handOver(id, other)
const rows = must(await db.from('records').select('id, owner_id, status, parent_record_id').in('id', [...Object.values(contacts), account.id]).limit(3), 'fixture')
check('fixture: both contacts Qualified, linked to the Account, and both they and the Account owned by ANOTHER user',
  rows.length === 3 && rows.every((r) => r.owner_id === other) &&
  Object.values(contacts).every((id) => { const r = rows.find((x) => x.id === id); return r?.status === 'Qualified' && r.parent_record_id === account.id }),
  JSON.stringify(rows.map((r) => [r.status, r.owner_id === other ? 'OTHER' : 'ME'])))

// The fingerprint must be able to move (Verification 13): a contact-keyed
// audit row on a THROWAWAY contact moves it. Not on the measured contacts.
{
  const spare = await mkContact('spare')
  const b = await fp(spare)
  must(await db.from('audit_log').insert({ record_id: spare, record_type: 'contact', action: 'probe_fp_calibration', actor_id: ME, detail: { probe: TAG } }).select('id'), 'calibration row')
  check('the fingerprint moves on a contact-keyed write (so "unchanged" below is a reading)', (await fp(spare)) !== b)
}

let browser
const created = []
try {
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const posts = []
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/\/create-(opportunity|test-bed)$/.test(new URL(r.url()).pathname)) return
    let body = null
    try { body = JSON.parse(await r.text()) } catch { }
    posts.push({ path: new URL(r.url()).pathname, status: r.status(), body })
  })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), `sb-${REF}-auth-token`, JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })

  const create = async (entry, kind) => {
    const id = contacts[entry]
    const label = `${entry} ${kind}`
    const itemSel = entry === 'detail'
      ? `[data-testid="cd-create-${kind}"]`
      : `#view-contacts .contact-create-item[onclick*="${id}', '${kind}'"]`
    await page.keyboard.press('Escape')
    await page.evaluate(() => navigate('dashboard'))
    if (entry === 'detail') {
      await page.evaluate((cid) => navigate('contact-detail', cid), id)
      // Counterfactual: the trigger exists only on a rendered Qualified
      // contact, and is-loading clears only once the record has loaded.
      await page.waitForFunction(() => document.querySelector('[data-testid="cd-create"]') && !document.querySelector('#view-contact-detail.is-loading'), { timeout: 30000 })
      await page.click('[data-testid="cd-create"]')
    } else {
      await page.evaluate(() => navigate('contacts'))
      await page.waitForFunction((cid) => document.querySelector(`#view-contacts .contact-create-item[onclick*="${cid}"]`), { timeout: 30000 }, id)
      // The list RE-RENDERS after its rows first appear (the contacts fetch
      // and the records-column hover data land separately), which detaches a
      // handle taken too early. Wait for the network to go quiet, a real
      // state, then take the handle and click; one retry covers a render that
      // lands between the two.
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {})
      for (let tries = 0; ; tries++) {
        try {
          const trig = await page.evaluateHandle((sel) => {
            const it = document.querySelector(sel)
            it.scrollIntoView({ block: 'center' })
            return it.closest('.contact-create-hover').querySelector('.contact-create-trigger')
          }, itemSel)
          await trig.click()
          break
        } catch (e) {
          if (tries >= 2) throw e
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {})
        }
      }
    }
    await page.waitForFunction((sel) => { const e = document.querySelector(sel); return e && e.offsetParent !== null }, { timeout: 8000 }, itemSel).catch(() => {})
    // What is AT the item's centre (Verification 14's clause): a click that
    // sends nothing is told apart from a click that landed elsewhere.
    const item = await page.evaluate((sel) => {
      const e = document.querySelector(sel)
      if (!e) return { present: false }
      const r = e.getBoundingClientRect()
      return { present: true, visible: e.offsetParent !== null, disabled: e.disabled, inert: e.classList.contains('is-inert-action'),
        onTop: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e }
    }, itemSel)
    const before = { contact: await fp(id), account: await fp(account.id) }
    const n0 = posts.length
    if (item.visible && item.onTop) {
      await page.click(itemSel)
      // The dialogue opens only after createFromContact's duplicate check has
      // fetched every record of the kind, which on this estate takes seconds.
      // Counterfactual: the modal carries `hidden` until it opens, and the
      // name's placeholder reads "Loading..." until the suggestion arrives.
      item.dialogue = await page.waitForFunction(() => !document.getElementById('new-test-bed-modal').classList.contains('hidden')
        && document.getElementById('new-test-bed-name').placeholder !== 'Loading suggested name...', { timeout: 30000 }).then(() => true, () => false)
      if (item.dialogue) {
        // Select-all then delete: a triple click did NOT select the whole
        // suggested name (found by opening the screenshot: the typed name
        // landed inside it). The stored name is asserted in check 2.
        await page.focus('#new-test-bed-name')
        await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta')
        await page.keyboard.press('Backspace')
        await page.type('#new-test-bed-name', `${TAG} ${entry} ${kind}`)
        await page.click('#new-test-bed-save')
        const t0 = Date.now()
        while (posts.length === n0 && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 100))
      }
    }
    const sent = posts.slice(n0)
    const rec = sent[0]?.status === 201 ? sent[0].body : null
    const view = kind === 'opportunity' ? 'view-opportunity-detail' : 'view-test-bed-detail'
    const landed = rec ? await page.waitForFunction((v) => { const e = document.getElementById(v); return e && !e.classList.contains('hidden') }, { timeout: 15000 }, view).then(() => true, () => false) : false
    check(`1. ${label}: one create POST, answered 201, landing on the new record's screen`,
      sent.length === 1 && !!rec?.id && landed,
      `item ${JSON.stringify(item)}; posts ${JSON.stringify(sent.map((p) => [p.path, p.status, p.body?.error ?? '']))}; landed ${landed}`)
    if (rec?.id) {
      created.push({ kind, id: rec.id })
      const r = must(await db.from('records').select('owner_id, account_id, record_type').eq('id', rec.id).single(), 'new record')
      const links = must(await db.from('record_contacts').select('record_id, contact_id').eq('contact_id', id).eq('record_id', rec.id).limit(2), 'link')
      const name = must(await db.from('record_revisions').select('payload->>name').eq('record_id', rec.id).eq('revision_number', 1).single(), 'name').name
      check(`2. ${label}: owned by the creator, account_id the contact's Account, link held on the new record's side, named as typed`,
        r.owner_id === ME && r.account_id === account.id && links.length === 1 && name === `${TAG} ${entry} ${kind}`,
        JSON.stringify({ owner: r.owner_id === ME ? 'ME' : r.owner_id, account: r.account_id === account.id, links: links.length, name }))
    } else {
      check(`2. ${label}: owned by the creator, account_id the contact's Account, link held on the new record's side, named as typed`, false, 'nothing was created')
    }
    const after = { contact: await fp(id), account: await fp(account.id) }
    check(`3. ${label}: nothing written on the contact`, before.contact === after.contact, before.contact === after.contact ? '' : `before ${before.contact} after ${after.contact}`)
    check(`4. ${label}: nothing written on the Account`, before.account === after.account, before.account === after.account ? '' : `before ${before.account} after ${after.account}`)
    await page.screenshot({ path: `${SHOT_DIR}/${TAG}-${entry}-${kind}.png` })
  }

  mkdirSync(SHOT_DIR, { recursive: true })
  for (const entry of ['list', 'detail']) for (const kind of ['opportunity', 'test-bed']) await create(entry, kind)

  // ── 5. THE COUNTERFACTUALS ───────────────────────────────────────────
  {
    const id = contacts.detail
    const b = await fp(id)
    const rev = must(await db.from('record_revisions').select('revision_number').eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single(), 'rev').revision_number
    const r = await attempt('PATCH', `/contacts/${id}`, { payload: { summary: `${TAG} non-owner edit` }, expected_revision: rev }, 'R6: editing a contact stays owner-only')
    check('5a. the non-owner\'s PATCH of the contact is refused 403 with the ownership sentence, and nothing moved',
      r.status === 403 && r.data?.error === OWNERSHIP_REFUSAL && (await fp(id)) === b, `${r.status} ${JSON.stringify(r.data)}`)

    await page.evaluate(() => navigate('dashboard'))
    await page.evaluate((cid) => navigate('contact-detail', cid), id)
    await page.waitForFunction(() => document.querySelector('[data-testid="cd-create"]') && !document.querySelector('#view-contact-detail.is-loading'), { timeout: 30000 })
    await page.click('[data-testid="cd-create"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="cd-create-opportunity"]'), { timeout: 8000 }).catch(() => {})
    const door = await page.evaluate(() => {
      const view = document.getElementById('view-contact-detail')
      const rows = [...view.querySelectorAll('.field-row-display')].filter((e) => e.offsetParent !== null)
      const live = (sel) => { const e = view.querySelector(sel); return !!e && !e.disabled && !e.classList.contains('is-inert-action') && getComputedStyle(e).pointerEvents !== 'none' }
      // The contact's edit surface is mostly INPUTS (Personal and Address
      // details), plus the field-row displays. Both are asserted: the first
      // calibration of this check read only the rows and came back SILENT on
      // a door that no longer disabled a single input.
      const inputs = [...view.querySelectorAll('input, textarea, select')].filter((e) => e.offsetParent !== null)
      return { notMine: view.classList.contains('is-not-mine'), rows: rows.length,
        rowsDoored: rows.filter((e) => getComputedStyle(e).pointerEvents === 'none').length,
        inputs: inputs.length, inputsDisabled: inputs.filter((e) => e.disabled).length,
        items: [live('[data-testid="cd-create-test-bed"]'), live('[data-testid="cd-create-opportunity"]')] }
    })
    check('5b. the contact screen is still doored (is-not-mine, every field row takes no pointer, every input disabled) while exactly its two create items are live',
      door.notMine && door.rows > 0 && door.rowsDoored === door.rows && door.inputs > 0 && door.inputsDisabled === door.inputs && door.items.every(Boolean), JSON.stringify(door))
    await page.screenshot({ path: `${SHOT_DIR}/${TAG}-detail-doored.png` })
  }
  {
    const bed = created.find((c) => c.kind === 'test-bed')
    if (!bed) check('5c. Test Bed convert stays owner-only (R3)', false, 'no bed was created to convert')
    else {
      await handOver(bed.id, other)
      const b = await fp(bed.id)
      const r = await attempt('POST', `/test-beds/${bed.id}/convert`, { opportunity_name: `${TAG} convert` }, 'R3: Test Bed convert stays owner-only')
      check('5c. Test Bed convert stays owner-only (R3): a bed somebody else owns is refused 403, and the bed did not move',
        r.status === 403 && (await fp(bed.id)) === b, `${r.status} ${JSON.stringify(r.data)}`)
    }
  }
  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser?.close()
  // Hand everything back so the tag sweep (whose candidate set is the test
  // account's records) reaches it, then sweep and re-query (Verification 11).
  const ids = must(await db.from('record_revisions').select('record_id').like('payload->>name', `${TAG} %`).range(0, 999), 'tagged')
  for (const rid of new Set(ids.map((x) => x.record_id))) {
    const r = must(await db.from('records').select('owner_id, deleted_at').eq('id', rid).single(), 'owner')
    if (!r.deleted_at && r.owner_id !== ME) await handOver(rid, ME)
  }
  await tearDown(TAG)
  const live = must(await db.from('records').select('id').in('id', [...new Set(ids.map((x) => x.record_id))]).is('deleted_at', null).range(0, 999), 'residue')
  console.log(`teardown: ${new Set(ids.map((x) => x.record_id)).size} tagged records, ${live.length} still live`)
  if (live.length) results.push(false)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
