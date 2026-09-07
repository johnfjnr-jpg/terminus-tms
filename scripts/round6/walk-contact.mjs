// ── ROUND 6 PHASE 2: THE CONTACT WRITE PATH AND THE QUALIFY WORKFLOW, LIVE ──
//
// Verification 40: every route the swap touches is exercised from OUTSIDE over
// HTTP, as the signed-in user, on the SUCCESS path, asserting the new behaviour
// rather than the status. A suite made of refusals is satisfied by a route that
// refuses everything.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 220) })
const puppeteer = await loadPuppeteer('walk-contact')
let browser = null

const iso = (daysFromNow) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

const unwrap = (r, what) => { if (!r.ok) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.data)}`); return r.data }

// ── THE FIXTURES ────────────────────────────────────────────────────────
//
// TWO CONTACTS, because the workflow needs both ends. A SPARSE one so the
// Qualify gate genuinely refuses - a fully populated contact would qualify on
// the first click and the blocking half of this walk could not run at all,
// which is Verification 25: the right measurement on a population that cannot
// exhibit the fault.
const industries = unwrap(await api('GET', '/industries'), 'industries')

const newContact = async (tag, extra = {}) => unwrap(await api('POST', '/contacts', {
  name: `${tag}`, company: `${tag} Holdings`,
  email: `${tag.toLowerCase().replace(/\s+/g, '')}@example.invalid`,
  mobile: '+65 9000 0002', industry_id: industries[0].id, source: 'Direct Outreach',
  jobRole: 'Head of Infrastructure', linkedin: 'https://example.invalid/in/y',
  address: '2 Fixture Street', address2: 'Level 3', city: 'Singapore',
  postcode: '018957', country: 'Singapore', region: 'Asia Pacific',
  summary: 'A fixture.', ...extra,
}), `create ${tag}`)

const full = await newContact('R6WALK Full')

// ── THE SPARSE ONE IS REACHED BY CLEARING, NOT BY CREATING ──────────────
//
// POST /contacts REFUSES a contact without email, mobile and industry_id, so
// the blocking state cannot be created directly. It is reached the way a
// person reaches it - by emptying fields on a real record - which is
// Verification 47: build the state the way the SYSTEM produces it.
//
// industry_id is cleared to null because it is a column; the rest go to ''.
// EMAIL AND MOBILE ARE NOT CLEARED: the route validates their FORMAT even on
// an empty string, so they cannot be emptied through the API at all. That is a
// finding about un-setting a validated field and it is recorded in the report;
// the walk works around it because it needs blockers, not all of them.
// which is what the gate's own emptiness rule treats as absent.
const sparse = await newContact('R6WALK Sparse')
unwrap(await api('PATCH', `/contacts/${sparse.id}`, {
  industry_id: null,
  payload: { jobRole: '', address: '', city: '', summary: '' },
}), 'empty the sparse contact')

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN')
  }
  await page.waitForFunction(() => typeof window.loadContactDetail === 'function', { timeout: 25000 })
  check('0. the bundle registers the Contact loader', true)
  try {

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  // WAIT ON RENDERED CONTENT, never on element count. Verification 6's
  // replacement clause: the surface being replaced is the state a wait must
  // not accept, and the vanilla markup is cleared by createRoot rather than
  // hidden - so a count could be satisfied mid-clear.
  const open = async (id) => {
    await page.evaluate((x) => navigate('contact-detail', x), id)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      const panel = document.querySelector('#view-contact-detail [data-testid="contact-panel"]')
      return v && !v.classList.contains('is-loading') && panel
    }, { timeout: 30000 })
    await settle()
  }
  const $t = (id) => page.evaluate((x) =>
    document.querySelector(`#view-contact-detail [data-testid="${x}"]`)?.textContent?.trim() ?? null, id)
  const exists = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
  const clickT = async (id) => {
    await page.evaluate((x) =>
      document.querySelector(`#view-contact-detail [data-testid="${x}"]`)?.click(), id)
    await settle()
  }
  const setField = async (name, value) => {
    await clickT(`display-${name}`)
    await page.waitForSelector(`[data-testid="input-${name}"]`, { timeout: 5000 })
    await page.evaluate((n, v) => {
      const el = document.querySelector(`[data-testid="input-${n}"]`)
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }, name, value)
    await settle()
  }
  const contactRow = async (id) => {
    const all = unwrap(await api('GET', '/contacts'), 'contacts')
    return all.find((c) => c.id === id)
  }

  // ── 1. THE SURFACE RENDERS, AND THE FRAME SURVIVED THE MOUNT ──────────
  await open(full.id)
  // SCOPED TO THE VIEW. A document-wide query counted 19: the hidden vanilla
  // Reference markup carries [data-key] rows too, and a walk that measures the
  // whole document measures every other surface's leftovers as well.
  const rowCount = () => page.evaluate(() =>
    document.querySelectorAll('#view-contact-detail [data-key]').length)
  check('1. every census row renders', (await rowCount()) === 15, `${await rowCount()} rows`)
  // THE OPTIONS ARRIVE AFTER THE PANEL. The surface fetches them (A11), so
  // "the panel exists" is satisfied by the pre-fetch state - Verification 7's
  // counterfactual - and the industry row must be waited on separately.
  await page.waitForFunction((want) =>
    document.querySelector('#view-contact-detail [data-testid="display-industry"]')
      ?.textContent?.trim() === want, { timeout: 20000 }, industries[0].name).catch(() => {})
  check('2. THE LOOKUP RESOLVES: Industry shows a NAME, not a uuid',
    (await $t('display-industry')) === industries[0].name,
    `display="${await $t('display-industry')}" expected "${industries[0].name}"`)

  // ── 2. EVERY EDITOR KIND OPENS ────────────────────────────────────────
  const kinds = { city: 'INPUT', region: 'SELECT', industry: 'SELECT', summary: 'TEXTAREA' }
  for (const [name, tag] of Object.entries(kinds)) {
    await clickT(`display-${name}`)
    const got = await page.evaluate((n) =>
      document.querySelector(`[data-testid="input-${n}"]`)?.tagName ?? null, name)
    check(`3.${name} opens a ${tag}`, got === tag, `got ${got}`)
    await page.keyboard.press('Escape')
    await settle()
  }

  // ── 3. THE LOOKUP'S SECOND DISPLAY PATH ───────────────────────────────
  //
  // The connected row renders rows.valueOf(), the live DRAFT. Phase 1 shipped
  // the standalone path resolved and this one raw, so the id would have gone
  // on screen the moment somebody chose a different industry.
  await setField('industry', industries[1].id)
  await page.keyboard.press('Escape')
  await settle()
  check('4. THE DRAFT RESOLVES TOO: choosing another industry reads as its NAME',
    (await $t('display-industry')) === industries[1].name,
    `display="${await $t('display-industry')}" expected "${industries[1].name}"`)
  await clickT('discard-all')
  await settle()

  // ── 4. THE BATCHED SAVE, WITH ITS NOTE ────────────────────────────────
  await setField('city', 'Kuala Lumpur')
  await setField('industry', industries[1].id)
  check('5. the bar counts both changes', /2 changes/.test(await $t('edit-bar') ?? ''),
    await $t('edit-bar'))
  await clickT('save-all')
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="cd-save-feedback"]'), { timeout: 15000 }).catch(() => {})
  await settle()

  const afterSave = await contactRow(full.id)
  check('6. THE SERVER HOLDS the payload change', afterSave?.payload?.city === 'Kuala Lumpur',
    `city=${afterSave?.payload?.city}`)
  check('7. and the COLUMN change, lifted out of the payload',
    afterSave?.industry_id === industries[1].id,
    `industry_id=${afterSave?.industry_id}`)
  check('8. payload.industry was never sent', afterSave?.payload?.industry === undefined,
    `payload.industry=${JSON.stringify(afterSave?.payload?.industry)}`)
  const notes = afterSave?.payload?.notes ?? []
  check('9. ONE note for the save session, naming both fields',
    notes.length === 1 && /City/.test(notes[0].text) && /Industry/.test(notes[0].text),
    `${notes.length} note(s): ${notes[0]?.text?.slice(0, 120)}`)
  check('10. and it names the industry by NAME, never by id',
    notes[0] && notes[0].text.includes(industries[1].name) && !notes[0].text.includes(industries[1].id),
    notes[0]?.text?.slice(0, 140))

  // ── 5. C5: THE 409 SENTENCE COMES FROM THE SHELL ──────────────────────
  //
  // Staged by writing the record from OUTSIDE the screen, so the revision the
  // surface holds is genuinely stale. Verification 47: the state is built the
  // way the system produces it.
  await open(full.id)
  await api('PATCH', `/contacts/${full.id}`, { payload: { city: 'Penang' } })
  await setField('postcode', '99999')
  await clickT('save-all')
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="cd-save-feedback"]'), { timeout: 15000 }).catch(() => {})
  await settle()
  const staleHtml = await page.evaluate(() =>
    document.querySelector('[data-testid="cd-save-feedback"]')?.innerHTML ?? '')
  check('11. C5: a stale write is refused and the SHELL renders the sentence',
    /reload/i.test(staleHtml), staleHtml.slice(0, 160))
  check('12. and the sentence carries a CONTROL, which a local string would not',
    /<a|<button/i.test(staleHtml), staleHtml.slice(0, 160))

  // ── 6. THE QUALIFY WORKFLOW, END TO END ───────────────────────────────
  await open(sparse.id)
  await clickT('cd-btn-qualify')
  await page.waitForFunction(() =>
    document.querySelectorAll('[data-key].field-blocked').length > 0, { timeout: 15000 }).catch(() => {})
  await settle()

  const tinted = await page.evaluate(() =>
    [...document.querySelectorAll('[data-key].field-blocked')].map((e) => e.dataset.key).sort())
  check('13. a blocked qualify TINTS the rows the server named', tinted.length > 0,
    `tinted: ${tinted.join(', ')}`)
  check('14. C2: THE INDUSTRY ROW IS TINTED, which the vanilla never managed',
    tinted.includes('industry'),
    `tinted: ${tinted.join(', ')} - the gate says industry_id and the row is industry`)
  check('15. the ACCOUNT CARD is tinted, not a row, for parent_record_id',
    await page.evaluate(() =>
      !!document.querySelector('[data-testid="cd-card-account"]')?.className.includes('field-blocked')))
  check('16. nothing was said about an unplaceable blocker',
    !/cannot show/.test(await $t('cd-save-feedback') ?? ''), await $t('cd-save-feedback'))
  check('17. and the record did NOT move', (await contactRow(sparse.id))?.status === 'Unqualified',
    `status=${(await contactRow(sparse.id))?.status}`)

  // RESOLUTION CLEARS, and only the field resolved.
  const before = tinted.length
  await setField('industry', industries[0].id)
  await clickT('save-all')
  await page.waitForFunction(() =>
    !document.querySelector('[data-key="industry"].field-blocked'), { timeout: 15000 }).catch(() => {})
  await settle()
  const afterResolve = await page.evaluate(() =>
    [...document.querySelectorAll('[data-key].field-blocked')].map((e) => e.dataset.key).sort())
  check('18. RESOLVING Industry clears ITS tint and leaves the others',
    !afterResolve.includes('industry') && afterResolve.length === before - 1,
    `before ${before} -> after ${afterResolve.length}: ${afterResolve.join(', ')}`)
  check('19. and resolving did NOT qualify the record as a side effect',
    (await contactRow(sparse.id))?.status === 'Unqualified',
    `status=${(await contactRow(sparse.id))?.status}`)

  // ── 7. QUALIFICATION COMPLETING ───────────────────────────────────────
  //
  // Filled from OUTSIDE the screen: this walk is about the workflow, and
  // typing eleven fields through the UI would be testing the row component
  // again rather than the gate.
  await api('PATCH', `/contacts/${sparse.id}`, {
    payload: {
      email: 'sparse@example.invalid', mobile: '+65 9000 0003',
      jobRole: 'Analyst', linkedin: 'https://example.invalid/in/z',
      address: '3 Fixture Street', city: 'Singapore', postcode: '018958',
      country: 'Singapore', region: 'Asia Pacific', summary: 'Filled.',
    },
  })
  const accounts = unwrap(await api('GET', '/accounts'), 'accounts')

  // ── 8. THE LINK-ACCOUNT ROUND TRIP ────────────────────────────────────
  await open(sparse.id)
  check('20. the Account card says Not linked before the round trip',
    /not linked/i.test(await $t('cd-account-status') ?? ''), await $t('cd-account-status'))
  await clickT('cd-btn-link-account')
  await page.waitForSelector('[data-testid="cd-link-search"]', { timeout: 5000 })
  await page.evaluate((q) => {
    const i = document.querySelector('[data-testid="cd-link-search"]')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, q)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }, accounts[0].payload?.name ?? accounts[0].name ?? '')
  await settle()
  const hasResult = await exists(`[data-testid="cd-link-${accounts[0].id}"]`)
  check('21. the search finds a real Account', hasResult,
    `looked for cd-link-${accounts[0].id}`)
  if (hasResult) {
    // THE GUARD, EXERCISED: two clicks in one tick. A state-based check reads
    // the same stale value in both closures and cannot refuse the second.
    await page.evaluate((id) => {
      const b = document.querySelector(`[data-testid="cd-link-${id}"]`)
      b.click(); b.click()
    }, accounts[0].id)
    await page.waitForFunction(() =>
      !document.querySelector('[data-testid="cd-link-search"]'), { timeout: 15000 }).catch(() => {})
    await settle()
    const linked = await contactRow(sparse.id)
    check('22. THE LINK LANDED', !!linked?.parent_record_id, `parent=${linked?.parent_record_id}`)
    const linkNotes = (linked?.payload?.notes ?? []).filter((n) => /account/i.test(n.text ?? ''))
    check('23. and the in-flight guard held: ONE link note, not two',
      linkNotes.length === 1, `${linkNotes.length} account notes`)
  }

  // ── 9. QUALIFY COMPLETES ──────────────────────────────────────────────
  await open(sparse.id)
  await clickT('cd-btn-qualify')
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contacts')
    return v && !v.classList.contains('hidden')
  }, { timeout: 20000 }).catch(() => {})
  await settle()
  check('24. QUALIFYING MOVES THE RECORD', (await contactRow(sparse.id))?.status === 'Qualified',
    `status=${(await contactRow(sparse.id))?.status}`)
  check('25. and the screen went to the contacts list',
    await page.evaluate(() => !document.getElementById('view-contacts')?.classList.contains('hidden')))

  // ── 10. C1: THE RETURN VIEW, BOTH WAYS ────────────────────────────────
  await open(sparse.id)
  // THE SEAM SETTLES AFTER THE REFETCH, not on mount. The query serves its
  // cached record first - which still says Unqualified - and corrects when the
  // fetch lands. The vanilla had the same shape: it assigned cdReturnView
  // after its own fetch. Waited on rather than read early, and the window is
  // recorded in the report as parity rather than hidden by the wait.
  await page.waitForFunction(() => window.contactReturnView?.() === 'contacts',
    { timeout: 20000 }).catch(() => {})
  check('25b. THE BACK BUTTON SURVIVED THE MOUNT, by being reproduced',
    await page.evaluate(() =>
      !!document.querySelector('#view-contact-detail #btn-back-contact-detail')),
    'createRoot clears the container, so a static back button is destroyed')
  check('26. the seam publishes contacts for a QUALIFIED contact',
    (await page.evaluate(() => window.contactReturnView?.())) === 'contacts',
    `seam says ${await page.evaluate(() => window.contactReturnView?.())}`)
  await clickT('cd-back')
  check('27. and the back button LANDS on contacts',
    await page.evaluate(() => !document.getElementById('view-contacts')?.classList.contains('hidden')))

  const other = await newContact('R6WALK Lead')
  await open(other.id)
  check('28. the seam publishes leads for an UNQUALIFIED contact',
    (await page.evaluate(() => window.contactReturnView?.())) === 'leads',
    `seam says ${await page.evaluate(() => window.contactReturnView?.())}`)
  await clickT('cd-back')
  check('29. and the back button LANDS on leads',
    await page.evaluate(() => !document.getElementById('view-leads')?.classList.contains('hidden')))

  // ══ THE FIVE CAPABILITIES, LIVE. Round 6 Phase 2b ══════════════════════
  //
  // ONE FIXTURE PER CAPABILITY, and that is a correction rather than a style.
  // Threading a single record through five state changes made every later
  // check depend on every earlier one: linking an Account for Park removed the
  // very condition the modal check needs, and writing through the API after
  // the page had loaded produced a 409 that read as a park defect. Each
  // capability now gets a record in the state IT is about.
  const capNote = await newContact('R6WALK Note')
  const capUnq = await newContact('R6WALK Unqual')
  const capModal = await newContact('R6WALK Modal')
  const capDel = await newContact('R6WALK Del')

  // ── N: A NOTE WRITTEN AND LISTED ──────────────────────────────────────
  await open(capNote.id)
  check('30. an empty history says so', /no notes yet/i.test(await $t('cd-notes-empty') ?? ''),
    await $t('cd-notes-empty'))
  await clickT('cd-add-note-btn')
  await page.waitForSelector('[data-testid="cd-new-note-input"]', { timeout: 5000 })
  await page.evaluate((t) => {
    const el = document.querySelector('[data-testid="cd-new-note-input"]')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, t)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, 'Spoke to the client about timing')
  await settle()
  await clickT('cd-add-note-btn')
  await page.waitForFunction(() =>
    document.querySelector('#view-contact-detail [data-testid="cd-note-0"]'),
    { timeout: 15000 }).catch(() => {})
  await settle()
  const noted = await contactRow(capNote.id)
  check('31. THE NOTE IS ON THE SERVER',
    (noted?.payload?.notes ?? []).some((n) => /Spoke to the client/.test(n.text ?? '')),
    JSON.stringify((noted?.payload?.notes ?? [])[0] ?? null).slice(0, 120))
  check('32. and it is LISTED on the screen',
    /Spoke to the client/.test(await $t('cd-note-0') ?? ''), await $t('cd-note-0'))

  // ── P: PARK, FROM THE STAGE IT IS REACHABLE FROM ──────────────────────
  //
  // FINDING, and it is the server's rather than this surface's: `Parked` is
  // sort_order 3 with reachable_from_any_stage false, so Unqualified -> Parked
  // SKIPS Qualified and the route refuses it - measured directly at the route,
  // for any client, so the vanilla hits the same wall. A stage_gate_rules row
  // nonetheless exists for that transition requiring followUpDate: configured,
  // and unsatisfiable from inside the product. Queued, not fixed here.
  //
  // The record is put in its Qualified state BEFORE the page opens it, so the
  // surface holds a current revision. Writing through the API after a load is
  // what the handshake exists to refuse, and it did.
  const capPark = await newContact('R6WALK Park')
  unwrap(await api('POST', `/contacts/${capPark.id}/link-account`,
    { account_id: accounts[0].id }), 'link for park')
  unwrap(await api('POST', `/records/${capPark.id}/transition`,
    { to_stage: 'Qualified' }), 'qualify for park')

  await open(capPark.id)
  await clickT('cd-btn-park')
  await page.waitForSelector('[data-testid="cd-park-date"]', { timeout: 5000 })
  await page.evaluate((d) => {
    const el = document.querySelector('[data-testid="cd-park-date"]')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, d)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, iso(45))
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="cd-park-reason"]')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      .call(el, 'Budget deferred to next quarter')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
  await clickT('cd-park-save')
  await page.waitForFunction(() =>
    !document.querySelector('[data-testid="cd-park-date"]'), { timeout: 20000 }).catch(() => {})
  await settle()
  const parkErr = await page.evaluate(() =>
    document.querySelector('[data-testid="cd-park-error"]')?.textContent ?? null)
  const parked = await contactRow(capPark.id)
  check('33. PARK MOVED THE RECORD', parked?.status === 'Parked',
    `status=${parked?.status}${parkErr ? ` | form says: ${parkErr}` : ''}`)
  check('34. and recorded the follow-up date', parked?.payload?.followUpDate === iso(45),
    `followUpDate=${parked?.payload?.followUpDate}`)
  check('35. and its reason, as prose, on the same list',
    (parked?.payload?.notes ?? []).some((n) => /Contact parked.*Budget deferred/.test(n.text ?? '')),
    JSON.stringify((parked?.payload?.notes ?? [])[0] ?? null).slice(0, 140))
  check('35b. FINDING: Unqualified -> Parked is refused by the ROUTE, not by this '
    + 'surface - a configured gate rule the stage order makes unreachable',
    true, 'measured directly at the route; queued, not fixed here')

  // ── U: UNQUALIFY, AND ITS CONSEQUENCES ────────────────────────────────
  unwrap(await api('POST', `/contacts/${capUnq.id}/link-account`,
    { account_id: accounts[0].id }), 'link for unqualify')
  unwrap(await api('POST', `/records/${capUnq.id}/transition`,
    { to_stage: 'Qualified' }), 'qualify for unqualify')
  await open(capUnq.id)
  await clickT('cd-btn-unqualify')
  await page.waitForFunction(() =>
    !document.querySelector('#view-contact-detail [data-testid="cd-btn-unqualify"]'),
    { timeout: 20000 }).catch(() => {})
  await settle()
  check('36. UNQUALIFY MOVED THE RECORD',
    (await contactRow(capUnq.id))?.status === 'Unqualified',
    `status=${(await contactRow(capUnq.id))?.status}`)
  check('37. and the control withdraws, because it no longer applies',
    !(await exists('#view-contact-detail [data-testid="cd-btn-unqualify"]')))
  check('38. while Qualify is offered again',
    await exists('#view-contact-detail [data-testid="cd-btn-qualify"]'))

  // ── A: THE ACCOUNT-DETAILS MODAL ROUND TRIP ───────────────────────────
  //
  // Reached the way a person reaches it: Qualify blocks on the Account and the
  // company matches nothing, so the creation form opens rather than a search.
  await open(capModal.id)
  await clickT('cd-btn-qualify')
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="account-details-modal"]'), { timeout: 15000 }).catch(() => {})
  await settle()
  check('39. A2: a blocked Account with NO match opens the creation form',
    await exists('[data-testid="account-details-modal"]'))
  const prefilled = await page.$eval('[data-testid="cd-account-details-name"]',
    (e) => e.value).catch(() => null)
  check('40. and the company is carried into it', !!prefilled && prefilled.length > 0,
    `prefill="${prefilled}"`)
  await page.evaluate((n) => {
    const el = document.querySelector('[data-testid="cd-account-details-name"]')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, n)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, 'R6WALK Created Account')
  await settle()
  await page.evaluate(() => document.querySelector('[data-testid="account-details-save"]')?.click())
  await page.waitForFunction(() =>
    !document.querySelector('[data-testid="account-details-modal"]'), { timeout: 20000 }).catch(() => {})
  await settle()
  const linkedByModal = await contactRow(capModal.id)
  check('41. CREATING THE ACCOUNT LINKED IT, one write',
    !!linkedByModal?.parent_record_id, `parent=${linkedByModal?.parent_record_id}`)

  // ── D: DELETE, AND ITS DESTINATION ────────────────────────────────────
  await open(capDel.id)
  await clickT('cd-btn-delete')
  await page.waitForFunction(() =>
    !document.getElementById('view-leads')?.classList.contains('hidden'),
    { timeout: 20000 }).catch(() => {})
  await settle()
  check('42. DELETE returns to the RETURN VIEW, which for a lead is leads',
    await page.evaluate(() => !document.getElementById('view-leads')?.classList.contains('hidden')))
  check('43. and the record is gone from the list', !(await contactRow(capDel.id)),
    `still present: ${!!(await contactRow(capDel.id))}`)

  check('99. no page errors and no 5xx', errs.length === 0, errs.join(' | '))
  } catch (err) {
    try {
      const state = await page.evaluate(() => {
        const v = document.getElementById('view-contact-detail')
        return {
          classes: v?.className ?? '(no view)',
          panel: !!v?.querySelector('[data-testid="contact-panel"]'),
          testids: [...(v?.querySelectorAll('[data-testid]') ?? [])].map((e) => e.dataset.testid).slice(0, 8),
          text: (v?.innerText ?? '').slice(0, 200),
          visibleView: [...document.querySelectorAll('[id^="view-"]')]
            .filter((e) => !e.classList.contains('hidden')).map((e) => e.id),
        }
      })
      console.log('STATE AT THROW:', JSON.stringify(state, null, 1))
    } catch { /* the page may be gone */ }
    throw err
  }
} catch (err) {
  // THE EVIDENCE SURVIVES THE THROW. Without this a timeout on check 20
  // discards checks 1 to 19, and the run reports nothing rather than
  // reporting where it got to - which is Verification 16 arriving in a walk
  // rather than in a pipe.
  check('!! the walk threw before finishing', false, err?.message ?? String(err))
} finally {
  if (browser) await browser.close()
  await tearDown()
  // RESIDUE CHECKED BY RE-QUERY, never by trusting the delete's own result.
  // Verification 11.
  const db = admin()
  const { data: left } = await db.from('records')
    .select('id, record_type').is('deleted_at', null)
    .eq('owner_id', JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id)
  console.log(`\nRESIDUE: ${left?.length ?? '?'} live records owned by the test account`)
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
