// LEADS CARD POLISH, Phase 1: R1, R2, R4 and R5 on the live screen.
//
// TWO CARDS, one owned and one not, because every door claim needs both in the
// same render: "everything is neutralised" is a reading of an empty screen
// otherwise.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-polish.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/leads-polish/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p1pol'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`); if (d) console.log(`        ${d}`) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}
const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER_ID = users.users.find((u) => u.email === 'john+test2@terminustechnologies.io')?.id
if (!OTHER_ID) throw new Error('no second identity; refusing to fake an owner id')
const industry = must(await db.from('industries').select('id, name').limit(1), 'ind')[0]

const mk = async (label, payload, owner = OWNER.user.id) => {
  const r = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: owner, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: r.id, revision_number: 1,
    payload: { name: `${TAG} ${label}`, ...payload }, created_by: owner,
  }).select().single(), `rev ${label}`)
  return r
}
// Missing exactly the address group plus linkedin, so the popup has real work.
const partial = await mk('Partial', {
  company: 'Polish Co', jobRole: 'Head', email: `${TAG}@example.invalid`,
  mobile: '+65 9000 0133', source: 'Referral', summary: 'nearly there',
})
const theirs = await mk('Theirs', {
  company: 'Polish Co', source: 'Referral', summary: 'someone else\'s',
  address: '9 Other Road', city: 'Singapore', postcode: '069118',
  country: 'Singapore', region: 'APAC',
}, OTHER_ID)
// R5 gets its OWN lead. The first run reused `partial`, which R4 had just
// qualified - so it had correctly LEFT the pipeline and the wait could never
// be satisfied. The product working, measured as a failure, for the third
// time in this round's probes: a fixture consumed by an earlier claim is not
// available to a later one.
const notesLead = await mk('Notes', {
  company: 'Polish Co', source: 'Referral', summary: 'for the notes checks',
})
const created = [partial.id, theirs.id, notesLead.id]

const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=3440,1400'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  page.on('pageerror', (e) => console.log(`        [pageerror] ${e.message}`))
  // Verification 14's clause: when an assertion about an EFFECT fails, the
  // failure detail must carry the CAUSE's own answer. "the summary did not
  // save" and "nothing was sent" are different failures with different fixes.
  const writes = []
  page.on('response', async (res) => {
    const req = res.request()
    if (req.method() !== 'PATCH' || !res.url().includes('/api/contacts/')) return
    writes.push({ status: res.status(), body: (await res.text().catch(() => '')).slice(0, 90) })
    if (!res.ok()) console.log(`        [PATCH ${res.status()}] ${writes.at(-1).body}`)
  })
  const toLeads = async () => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`),
      { timeout: 20000 }, partial.id)
  }
  await toLeads()

  // ══ R1: COMPLETE IN PLACE, NO OTHER PANEL ════════════════════════════
  console.log('\nR1  the completion popup is actionable')
  await page.click(`[data-testid="lead-qualify-${partial.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${partial.id}"]`, { timeout: 15000 })
  const server = await api('GET', `/records/${partial.id}/exit-criteria`)
  const blocking = (server.data.blocking ?? []).map((b) => b.field)
  const inputs = await page.$$eval(
    `[data-testid="lead-missing-${partial.id}"] [data-testid^="lead-fix-"]`,
    (els) => els.map((x) => x.getAttribute('data-testid').replace(/^lead-fix-/, '').replace(/-[0-9a-f-]{36}$/, '')))
  check('every field the server says is missing has an INPUT in the surface',
    blocking.every((b) => inputs.includes(b)),
    `server blocks ${blocking.length}: ${blocking.join(', ')} | surface inputs ${inputs.length}`)
  // ── R1, WHICH IS R2 ───────────────────────────────────────────────────
  //
  // address2 is NOT in the gate's fourteen, so a surface rendering only the
  // blocking keys can never offer it - and ten of fourteen live contacts
  // carry a Line 2. The panel offers it BECAUSE it is a panel.
  check('R1: address2 is enterable although the gate never blocks on it',
    inputs.includes('address2') && !blocking.includes('address2'),
    `address2 input present: ${inputs.includes('address2')}, in the gate: ${blocking.includes('address2')}`)
  const groups = await page.$$eval(`[data-testid^="lead-complete-"][data-testid*="-details-"], `
    + `[data-testid^="lead-complete-summary-"]`, (els) => els.length)
  check('R2: the surface is three PANELS, not a list',
    groups === 3, `${groups} panel groups rendered`)
  // R3: region is a select, from the server's list.
  const regionKind = await page.$eval(`[data-testid="lead-fix-region-${partial.id}"]`,
    (el) => ({ tag: el.tagName, opts: el.tagName === 'SELECT' ? el.options.length : 0 }))
  check('R3: Region is a SELECT from the served list, not free text',
    regionKind.tag === 'SELECT' && regionKind.opts === 6,
    `<${regionKind.tag}> with ${regionKind.opts} options (5 regions plus the blank)`)
  check('the popup no longer tells the person to go somewhere else',
    !(await page.$eval(`[data-testid="lead-incomplete-${partial.id}"]`,
      (e) => /open the lead/i.test(e.textContent))),
    'the message is "Please complete missing data"')
  await page.screenshot({ path: `${OUT}p1-popup.png` })

  // Save enables only on dirty.
  const saveSel = `[data-testid="lead-fix-save-${partial.id}"]`
  check('Save is disabled before anything is typed',
    await page.$eval(saveSel, (b) => b.disabled), 'nothing entered yet')

  const typeInto = async (key, v) => {
    const sel = `[data-testid="lead-fix-${key}-${partial.id}"]`
    await page.click(sel); await page.type(sel, v)
  }
  for (const [k, v] of [['address', '1 Polish Way'], ['address2', 'Unit 04-12'],
    ['city', 'Singapore'], ['postcode', '069118'], ['country', 'Singapore'],
    ['linkedin', 'https://example.invalid/in/p']]) {
    await typeInto(k, v)
  }
  // Region is a select now, so it is picked rather than typed.
  await page.select(`[data-testid="lead-fix-region-${partial.id}"]`, 'APAC')
  check('Save enables once fields are entered', !(await page.$eval(saveSel, (b) => b.disabled)),
    'dirty')

  // COMPLETING MUST MOVE THE FLOW ON BY ITSELF - that is what "no separate
  // panel" means: one press of Qualify, finish, and the account step appears.
  await page.click(saveSel)
  await page.waitForSelector(`[data-testid="lead-account-step-${partial.id}"]`, { timeout: 25000 })
  check('completing in place moves straight to the account step',
    true, 'no second Qualify press, no other panel opened')
  const after = must(await db.from('record_revisions').select('payload')
    .eq('record_id', partial.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  check('and the entered fields were actually saved',
    after.payload?.address === '1 Polish Way' && after.payload?.city === 'Singapore',
    `address "${after.payload?.address}", city "${after.payload?.city}"`)
  await page.click('[data-testid="cd-link-cancel"]')

  // ══ R2: THE ADDRESS POPUP, BOTH WAYS ═════════════════════════════════
  console.log('\nR2  the address popup, editable, door both ways')
  await toLeads()
  await page.click(`[data-testid="lead-address-${partial.id}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${partial.id}"]`, { timeout: 10000 })
  const mineAddr = await page.evaluate((id) => {
    const p = document.querySelector(`[data-testid="address-popup-${id}"]`)
    // `input, select` - R3 made Region a select, and an input-only census
    // would leave that control unmeasured on both sides of the door.
    const inputs = [...p.querySelectorAll('input, select')]
    const save = p.querySelector(`[data-testid="addr-save-${id}"]`)
    return {
      inputs: inputs.length,
      liveInputs: inputs.filter((i) => !i.disabled && getComputedStyle(i).pointerEvents !== 'none').length,
      saveDisabled: save.disabled,
      values: inputs.map((i) => i.value).filter(Boolean).length,
    }
  }, partial.id)
  check('OWNED: the address popup is editable',
    mineAddr.inputs === 6 && mineAddr.liveInputs === 6,
    `${mineAddr.liveInputs} of ${mineAddr.inputs} inputs live`)
  check('OWNED: Save is disabled until dirty', mineAddr.saveDisabled === true, 'nothing changed yet')
  const citySel = `[data-testid="addr-city-${partial.id}"]`
  await page.click(citySel, { clickCount: 3 })
  await page.type(citySel, 'Jurong')
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="addr-save-${id}"]`).disabled,
    { timeout: 8000 }, partial.id)
  check('OWNED: Save enables on dirty', true, 'city edited')
  await page.screenshot({ path: `${OUT}p1-address-owned.png` })
  await page.click(`[data-testid="addr-save-${partial.id}"]`)
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="address-popup-${id}"]`),
    { timeout: 20000 }, partial.id)
  const saved = must(await db.from('record_revisions').select('payload')
    .eq('record_id', partial.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  check('OWNED: the edit is written', saved.payload?.city === 'Jurong', `city "${saved.payload?.city}"`)
  // AND IT MUST NOT BLANK THE FIELDS NOBODY TOUCHED. The popup used to write
  // all six unconditionally from a state seeded once at mount, so editing
  // `city` cleared address, address2, postcode, country and region - real
  // data, silently, on a screen that looked correct throughout.
  check('OWNED: saving one address field does NOT blank the others',
    !!saved.payload?.address && !!saved.payload?.postcode && !!saved.payload?.country
      && !!saved.payload?.region,
    `address "${saved.payload?.address}" postcode "${saved.payload?.postcode}" `
    + `country "${saved.payload?.country}" region "${saved.payload?.region}"`)

  // THE UNOWNED SIDE. Reading preserved, writing dead.
  await toLeads()
  await page.click(`[data-testid="lead-address-${theirs.id}"]`)
  await page.waitForSelector(`[data-testid="address-popup-${theirs.id}"]`, { timeout: 10000 })
  const theirAddr = await page.evaluate((id) => {
    const p = document.querySelector(`[data-testid="address-popup-${id}"]`)
    const inputs = [...p.querySelectorAll('input, select')]
    const save = p.querySelector(`[data-testid="addr-save-${id}"]`)
    const dead = (el) => el.disabled || getComputedStyle(el).pointerEvents === 'none' || el.tabIndex === -1
    return {
      inputs: inputs.length,
      readable: inputs.filter((i) => i.value.trim()).length,
      deadInputs: inputs.filter(dead).length,
      saveDead: dead(save),
    }
  }, theirs.id)
  check('UNOWNED: the address is still READABLE',
    theirAddr.readable >= 5, `${theirAddr.readable} of ${theirAddr.inputs} fields carry values`)
  check('UNOWNED: every edit control is DEAD',
    theirAddr.deadInputs === theirAddr.inputs,
    `${theirAddr.deadInputs} of ${theirAddr.inputs} inputs neutralised`)
  check('UNOWNED: Save is unreachable', theirAddr.saveDead === true, `save dead: ${theirAddr.saveDead}`)
  // AND THE POPUP MUST BE DISMISSIBLE. The first run trapped the screen: the
  // door killed Close along with the writes, leaving a full-screen backdrop
  // over an unowned card. A door that makes a lead unreadable is the one thing
  // P3 recorded it must never do.
  const closeAlive = await page.evaluate((id) => {
    const b = document.querySelector(`[data-testid="addr-close-${id}"]`)
    return !!b && !b.disabled && getComputedStyle(b).pointerEvents !== 'none'
  }, theirs.id)
  check('UNOWNED: Close still works, so the popup is not a trap', closeAlive,
    'reading is preserved, and so is getting back out')
  await page.screenshot({ path: `${OUT}p1-address-unowned.png` })
  await page.click(`[data-testid="addr-close-${theirs.id}"]`)

  // ══ R4: SUMMARY EDITABLE, DOOR BOTH WAYS ═════════════════════════════
  console.log('\nR4  the Summary is editable, and the door reaches it')
  await toLeads()
  const sumSel = `[data-testid="lead-summary-input-${partial.id}"]`
  // APPEND rather than replace. A triple-click does not reliably clear a
  // React-controlled textarea, and the first run hung waiting for a value that
  // was never going to arrive - the probe's fault, not the editor's. Appending
  // proves the same thing: the editor takes real keystrokes and the result is
  // written.
  const before = await page.$eval(sumSel, (e) => e.value)
  const SUFFIX = ' | edited on the card'
  await page.click(sumSel)
  await page.keyboard.press('End')
  await page.type(sumSel, SUFFIX)
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="lead-summary-save-${id}"]`).disabled,
    { timeout: 8000 }, partial.id)
  // WHAT IS ACTUALLY AT THAT POINT? A click that sends nothing is either a
  // handler that refused or a click that never reached it, and those are
  // different failures. elementFromPoint answers it in one line.
  const atPoint = await page.evaluate((id) => {
    const b = document.querySelector(`[data-testid="lead-summary-save-${id}"]`)
    const r = b.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      disabled: b.disabled,
      inView: r.top >= 0 && r.bottom <= window.innerHeight,
      hit: hit ? `${hit.tagName}.${hit.className}`.slice(0, 60) : 'null',
      isTheButton: hit === b,
    }
  }, partial.id)
  console.log(`        [click target] ${JSON.stringify(atPoint)}`)
  await page.click(`[data-testid="lead-summary-save-${partial.id}"]`)
  // WAIT ON THE CLAIM, not on a DOM state that the list's reload is busy
  // replacing. The save button does re-disable - measured directly - but
  // waiting for it races the re-render that makes it true, and the thing being
  // asserted is that the text was WRITTEN.
  let sumSaved = null
  for (let i = 0; i < 40; i++) {
    sumSaved = must(await db.from('record_revisions').select('payload')
      .eq('record_id', partial.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
    if (String(sumSaved?.payload?.summary ?? '').endsWith(SUFFIX.trim())) break
    await new Promise((r) => setTimeout(r, 500))
  }
  check('OWNED: the Summary saves from the card',
    String(sumSaved.payload?.summary ?? '').endsWith(SUFFIX.trim()),
    `was "${before}" -> saved "${sumSaved.payload?.summary}" | PATCHes seen this run: `
    + JSON.stringify(writes.slice(-3)))
  check('OWNED: Save goes back to disabled once saved, so it is not always-on',
    await page.$eval(`[data-testid="lead-summary-save-${partial.id}"]`, (b) => b.disabled),
    'the text now equals what was loaded, so dirty is false again')
  // AND THE PATCH MERGES rather than replacing the payload. A summary save
  // that wiped name and company would pass every check above.
  check('OWNED: saving the Summary does not destroy the rest of the payload',
    !!sumSaved?.payload?.name && !!sumSaved?.payload?.company,
    `name "${sumSaved?.payload?.name}", company "${sumSaved?.payload?.company}"`)
  const theirSum = await page.evaluate((id) => {
    const ta = document.querySelector(`[data-testid="lead-summary-input-${id}"]`)
    const save = document.querySelector(`[data-testid="lead-summary-save-${id}"]`)
    const dead = (el) => !el || el.disabled || getComputedStyle(el).pointerEvents === 'none'
    return { text: ta?.value ?? '', dead: dead(ta), saveDead: dead(save) }
  }, theirs.id)
  check('UNOWNED: the Summary is readable but not editable',
    !!theirSum.text && theirSum.dead && theirSum.saveDead,
    `text "${theirSum.text.slice(0, 24)}", editor dead: ${theirSum.dead}, save dead: ${theirSum.saveDead}`)

  // ══ R4: CREATE IS OFFERED EVEN WHEN SOMETHING MATCHES ════════════════
  console.log('\nR4  the account step offers Create alongside matches')
  await toLeads()
  // Verification 14's clause, promoted this round: when a click produces
  // nothing, ask what is AT the point before asking why the handler refused.
  const qDiag = await page.evaluate((id) => {
    const b = document.querySelector(`[data-testid="lead-qualify-${id}"]`)
    if (!b) return { present: false }
    const r = b.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
    return {
      present: true, disabled: b.disabled, label: b.textContent.trim(),
      hit: hit ? `${hit.tagName}.${String(hit.className).slice(0, 40)}` : 'null',
      isTheButton: hit === b,
      notMine: card?.dataset.notMine,
      err: document.querySelector(`[data-testid="lead-action-error-${id}"]`)?.textContent ?? null,
    }
  }, partial.id)
  console.log(`        [qualify diag] ${JSON.stringify(qDiag)}`)
  await page.click(`[data-testid="lead-qualify-${partial.id}"]`)
  await new Promise((r) => setTimeout(r, 2500))
  const afterClick = await page.evaluate((id) => ({
    step: !!document.querySelector(`[data-testid="lead-account-step-${id}"]`),
    incomplete: !!document.querySelector(`[data-testid="lead-incomplete-${id}"]`),
    err: document.querySelector(`[data-testid="lead-action-error-${id}"]`)?.textContent ?? null,
  }), partial.id)
  console.log(`        [after click] ${JSON.stringify(afterClick)}`)
  if (afterClick.incomplete) {
    const still = await api('GET', `/records/${partial.id}/exit-criteria`)
    const rev = must(await db.from('record_revisions').select('payload')
      .eq('record_id', partial.id).order('revision_number', { ascending: false }).limit(1), 'r')[0]
    console.log(`        [still blocking] ${JSON.stringify((still.data.blocking ?? []).map((b) => b.field))}`)
    console.log(`        [payload now] address="${rev.payload?.address}" address2="${rev.payload?.address2}" `
      + `city="${rev.payload?.city}" region="${rev.payload?.region}" linkedin="${rev.payload?.linkedin}"`)
  }
  await page.waitForSelector(`[data-testid="lead-account-step-${partial.id}"]`, { timeout: 20000 })
  // An account that really exists, so there IS a match to be shadowed by.
  const existing = must(await db.from('records').select('id').eq('record_type', 'account')
    .is('deleted_at', null).limit(1), 'acct')[0]
  const existingName = must(await db.from('record_revisions').select('payload')
    .eq('record_id', existing.id).order('revision_number', { ascending: false }).limit(1), 'acctrev')[0]
    .payload?.name ?? ''
  const prefix = existingName.slice(0, Math.max(4, Math.floor(existingName.length / 2)))
  await page.type('[data-testid="cd-link-search"]', prefix)
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="cd-link-${id}"]`),
    { timeout: 10000 }, existing.id)
  const both = await page.evaluate((id) => ({
    match: !!document.querySelector(`[data-testid="cd-link-${id}"]`),
    create: !!document.querySelector('[data-testid="cd-link-create"]'),
  }), existing.id)
  check('R4: typing a PREFIX of a real account offers both the match AND Create',
    both.match && both.create,
    `typed "${prefix}" against "${existingName}": match ${both.match}, create ${both.create}`)
  await page.screenshot({ path: `${OUT}p2-r4-autocomplete.png` })
  // AND PICKING THE EXISTING ONE STILL WORKS - the other half of link-or-create.
  const beforeAccts = must(await db.from('records').select('id').eq('record_type', 'account')
    .is('deleted_at', null), 'a').length
  await page.click(`[data-testid="cd-link-${existing.id}"]`)
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="lead-card-${id}"]`),
    { timeout: 25000 }, partial.id)
  const afterAccts = must(await db.from('records').select('id').eq('record_type', 'account')
    .is('deleted_at', null), 'a').length
  const qualified = must(await db.from('records').select('status, parent_record_id')
    .eq('id', partial.id).single(), 'q')
  check('R4: picking the existing match links it and creates NO new account',
    qualified.status === 'Qualified' && qualified.parent_record_id === existing.id
      && afterAccts === beforeAccts,
    `status ${qualified.status}, linked to the existing account: `
    + `${qualified.parent_record_id === existing.id}, accounts ${beforeAccts} -> ${afterAccts}`)

  // ══ R5: ADD NOTE AND DISCARD ON THE NOTES HEADER LINE ════════════════
  console.log('\nR5  the Notes header carries both controls')
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`),
    { timeout: 20000 }, notesLead.id)
  const notesSel = `[data-testid="lead-notes-${theirs.id}"]`
  const headerBefore = await page.evaluate((sel) => {
    const h = document.querySelector(`${sel} [data-testid="cd-notes-header-row"]`)
    return [...h.querySelectorAll('button')].map((b) => b.textContent.trim())
  }, notesSel)
  check('R5: closed, the header carries Add note', headerBefore.includes('Add note'),
    `header buttons: ${JSON.stringify(headerBefore)}`)
  // Open it on the OWNED card, where the control is alive.
  const mineNotes = `[data-testid="lead-notes-${notesLead.id}"]`
  await page.click(`${mineNotes} [data-testid="cd-add-note-btn"]`)
  await page.waitForSelector(`${mineNotes} [data-testid="cd-new-note-input"]`, { timeout: 10000 })
  const openState = await page.evaluate((sel) => {
    const h = document.querySelector(`${sel} [data-testid="cd-notes-header-row"]`)
    const header = [...h.querySelectorAll('button')].map((b) => b.textContent.trim())
    const wrap = document.querySelector(`${sel} [data-testid="cd-note-input-wrap"]`)
    return {
      header,
      inWrap: wrap ? [...wrap.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
      totalAdd: document.querySelectorAll(`${sel} [data-testid="cd-add-note-btn"]`).length,
      totalDiscard: document.querySelectorAll(`${sel} [data-testid="cd-note-discard"]`).length,
    }
  }, mineNotes)
  check('R5: open, BOTH Add note and Discard are on the header line',
    openState.header.includes('Add note') && openState.header.includes('Discard'),
    `header: ${JSON.stringify(openState.header)}, in the editor wrap: ${JSON.stringify(openState.inWrap)}`)
  check('R5: and there is exactly ONE of each, not a duplicate pair',
    openState.totalAdd === 1 && openState.totalDiscard === 1,
    `Add note x${openState.totalAdd}, Discard x${openState.totalDiscard}`)
  await page.type(`${mineNotes} [data-testid="cd-new-note-input"]`, 'a note being typed')
  await page.click(`${mineNotes} [data-testid="cd-note-discard"]`)
  await page.waitForFunction((sel) => !document.querySelector(`${sel} [data-testid="cd-new-note-input"]`),
    { timeout: 8000 }, mineNotes)
  const notesAfter = must(await db.from('record_revisions').select('payload')
    .eq('record_id', notesLead.id).order('revision_number', { ascending: false }).limit(1), 'n')[0]
  check('R5: Discard cancels THIS NOTE and writes nothing',
    !Array.isArray(notesAfter.payload?.notes) || notesAfter.payload.notes.length === 0,
    `notes on the record: ${(notesAfter.payload?.notes ?? []).length}`)
  await page.screenshot({ path: `${OUT}p2-r5-notes.png` })
} finally {
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').is('deleted_at', null), 'sweep')
  const revs = must(await db.from('record_revisions').select('payload').in('record_id', live.map((r) => r.id)), 'revs')
  console.log(`\n  soft deleted ${created.length}; live ${TAG} remaining: ${revs.filter((r) => String(r.payload?.name ?? '').startsWith(TAG)).length}`)
  await browser.close()
}
const f = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - f.length}/${results.length} checks pass`)
process.exit(f.length ? 1 : 0)
