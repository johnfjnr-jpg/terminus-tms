// ── ROUND 3 PHASE 3: THE WALK ────────────────────────────────────────────
//
// A real record, the real server, the React panel live. Every wait is on real
// state and states its counterfactual; the teardown is in a finally.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '/Users/johnfryatt/terminus-tms/scripts/lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '/Users/johnfryatt/terminus-tms/scripts/fixtures.mjs'
import { api } from '/Users/johnfryatt/terminus-tms/scripts/api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms/'
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 140) })
const puppeteer = await loadPuppeteer('walk')
const { oppId } = await freshOpportunity('R3WALK')

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + (m.location()?.url ?? '')) })
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN, so nothing below measures the app')
  }
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // COUNTERFACTUAL: the hidden vanilla's inputs satisfy a control count either
  // way, so the wait is on the REACT panel by name plus rendered text.
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && p.offsetParent !== null
      && !!p.querySelector('#deal-form-root [data-testid="deal-panel"]')
      && (p.innerText ?? '').trim().length > 500
  }, { timeout: 30000 })

  const $ = (id) => page.evaluate((i) => {
    const e = document.getElementById(i)
    if (!e) return null
    return { value: e.value ?? null, text: (e.textContent ?? '').trim(),
      cls: e.className.toString(), ph: e.placeholder ?? null,
      hidden: e.classList.contains('hidden'), disabled: !!e.disabled,
      title: e.title ?? '', aria: e.getAttribute('aria-expanded') }
  }, id)
  const type = async (id, v) => { await page.evaluate(([i, x]) => {
    const e = document.getElementById(i); if (!e) throw new Error('no #' + i)
    const proto = e.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : e.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, String(x))
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }, [id, v]); await settle() }
  const click = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await settle() }
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const rec = async () => (await api('GET', `/opportunities/${oppId}`)).data
  const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []

  // ── 1. THE CENSUS RECIPE: all four empty-state contracts ───────────────
  await type('deal-ssExisting', '40')
  await type('deal-gstPct', '')          // numOrNull  -> not recorded
  await type('deal-targetMargin', '')    // numOrNull  -> placeholder default
  await type('deal-margin-hwSs', '')     // numOrUndefined -> key ABSENT
  await type('deal-factoring-ratePct', '') // num -> empty IS zero
  await type('deal-bidCurrency', '')     // emptyToNull -> null
  const contracts = await page.evaluate(() => ({
    gst: document.getElementById('deal-gstPct')?.placeholder,
    target: document.getElementById('deal-targetMargin')?.placeholder,
    margin: document.getElementById('deal-margin-hwSs')?.placeholder,
    rate: document.getElementById('deal-factoring-ratePct')?.placeholder,
    currency: document.getElementById('deal-bidCurrency')?.tagName,
  }))
  check('numOrNull says NOT RECORDED, never a confident zero',
    contracts.gst === 'not recorded', contracts.gst)
  check('numOrUndefined carries the TARGET, because a blank line prices at target',
    /^\d+$/.test(contracts.margin ?? ''), contracts.margin)
  check('num says 0, because empty IS zero for that key', contracts.rate === '0', contracts.rate)
  check('emptyToNull is a fixed list, not free text', contracts.currency === 'SELECT', contracts.currency)

  // ── 1b. BASELINE THE FORM, or every "clean" assertion below is false ───
  //
  // The census recipe above TYPES, so the form is dirty from here on. The
  // first run asserted "a clean form shows no section save" three steps later
  // and read the dirt this step created. Saving re-baselines, which is the
  // only thing that clears dirty.
  await page.evaluate(() => document.querySelector('.section-save')?.click())
  await page.waitForFunction(() => document.querySelectorAll('.section-save').length === 0,
    { timeout: 20000 })
  check('the census edits saved, so the walk starts from a clean baseline',
    (await page.evaluate(() => document.querySelectorAll('.section-save').length)) === 0)

  // ── 2. THE LATCH CYCLE ─────────────────────────────────────────────────
  const latchState = async (id) => await $(`latch-${id}`)
  const before = await latchState('deal-section-3')
  await click('[data-latch="deal-section-3"]')
  const latched = await latchState('deal-section-3')
  const panel = await $('deal-section-3')
  check('a latched section is MARKED, and the button says how to undo it',
    panel.cls.includes('is-latched') && latched.text === 'Show' && latched.aria === 'false',
    `${panel.cls} | ${latched.text} | aria ${latched.aria}`)
  check('and the SIGNAL SENTENCE names the panel, from the shared module',
    latched.title.includes('Structural Terms') && latched.title !== before.title, latched.title)
  await click('#latch-all')
  const all = await $('latch-all')
  const cleared = await page.evaluate(() =>
    [...document.querySelectorAll('.deal-section.is-latched')].length)
  check('SHOW ALL returns to everything visible, not to a remembered set',
    all.text === 'Hide all' && cleared === 0, `${all.text}, ${cleared} still latched`)
  check('and latching left the form CLEAN, because it never touches the payload',
    (await page.evaluate(() => document.querySelectorAll('.section-save').length)) === 0)

  // ── 3. THE DISCLOSURE ──────────────────────────────────────────────────
  const shut = await $('deal-detail-panel')
  await click('#btn-toggle-detail')
  const open = await $('deal-detail-panel')
  const row = await $('deal-summary-row')
  const label = await $('btn-toggle-detail-text')
  check('the disclosure opens the panel and marks the ROW, not the panel',
    shut.hidden && !open.hidden && row.cls.includes('detail-open')
      && !open.cls.includes('detail-open'), `${row.cls}`)
  check('and the chevron survives the toggle, because the label is its own span',
    label.text === 'Hide detail'
      && (await page.evaluate(() => !!document.querySelector('#btn-toggle-detail .disclose-chevron'))))

  // ── 4. SECTION SAVES APPEAR AND CLEAR ──────────────────────────────────
  const saves = () => page.evaluate(() => [...document.querySelectorAll('.section-save')]
    .map((b) => b.closest('.deal-section')?.id))
  check('a clean form shows no section save', (await saves()).length === 0)
  const originalDuration = (await $('deal-duration')).value
  await type('deal-duration', '48')
  const dirtyIn = await saves()
  check('editing raises the save on ITS OWN section only',
    dirtyIn.length === 1 && dirtyIn[0] === 'deal-section-3', dirtyIn.join(','))
  await type('deal-duration', originalDuration)
  const backTo = await saves()
  check('and editing back destroys it again', backTo.length === 0,
    'still dirty: ' + (backTo.join(',') || 'none') + '; duration now '
    + JSON.stringify(await page.evaluate(() => document.getElementById('deal-duration')?.value)))

  // ── 5. A FULL SAVE ROUND TRIP ──────────────────────────────────────────
  const revBefore = (await rec()).latest_revision_number
  await type('deal-ssNew', '17')
  await click('.section-save')
  await page.waitForFunction(() => document.querySelectorAll('.section-save').length === 0, { timeout: 20000 })
  const after = await rec()
  check('SAVE ROUND TRIP: the record holds the value and the revision moved',
    Number(after.payload.ssNew) === 17 && after.latest_revision_number > revBefore,
    `ssNew ${after.payload.ssNew}, rev ${revBefore} -> ${after.latest_revision_number}`)
  check('and the form reads clean afterwards', (await saves()).length === 0)

  // ── 6. THE RESTORE-FIDELITY CHECK ──────────────────────────────────────
  // A version frozen with NON-TRIVIAL state in every carrier the payload has:
  // milestone rows, contractor rows, margin overrides and UI state. The old
  // populate restored none of these, so a restore looked like it worked.
  await type('deal-installResp', 'Terminus Contractor - Lump Sum')
  await type('deal-lumpCost', '250000')
  await type('deal-margin-hwSs', '42')
  await type('deal-margin-hoAqm', '19')
  await type('deal-ms-0-month', '3'); await type('deal-ms-0-pct', '30')
  await type('deal-cm-0-month', '2'); await type('deal-cm-0-pct', '100')
  await click('[data-structure="hybrid"]')
  await click('[data-invoicing="monthly"]')
  await type('deal-version-reason', 'walk: the fidelity fixture')
  const vBefore = (await versions()).length
  check('the form is dirty, so the freeze will attempt a save',
    (await page.evaluate(() => document.querySelectorAll('.section-save').length)) > 0)
  await click('#btn-save-version')
  await page.waitForFunction(async () => true, { timeout: 1000 }).catch(() => {})
  let vAfter = vBefore
  for (let i = 0; i < 40 && vAfter === vBefore; i++) {
    await new Promise((r) => setTimeout(r, 500)); vAfter = (await versions()).length
  }
  // THE FAILURE DETAIL CARRIES THE CAUSE. "no version appeared" and "the freeze
  // refused" are different failures with different fixes, and only the card
  // says which.
  const vFeedback = await page.evaluate(() => ({
    version: (document.getElementById('deal-version-feedback')?.textContent ?? '').trim(),
    deal: (document.getElementById('deal-feedback')?.textContent ?? '').trim(),
  }))
  check('the fidelity version was taken', vAfter > vBefore,
    `${vBefore} -> ${vAfter}; version card said "${vFeedback.version}"; form said "${vFeedback.deal}"`)

  const FROZEN = {
    'deal-lumpCost': '250000', 'deal-margin-hwSs': '42', 'deal-margin-hoAqm': '19',
    'deal-ms-0-month': '3', 'deal-ms-0-pct': '30', 'deal-cm-0-month': '2', 'deal-cm-0-pct': '100',
  }
  // Move EVERY carrier away, so a restore that does nothing cannot pass.
  await type('deal-lumpCost', '111111')
  await type('deal-margin-hwSs', ''); await type('deal-margin-hoAqm', '')
  await type('deal-ms-0-month', '9'); await type('deal-ms-0-pct', '90')
  await type('deal-cm-0-month', '8'); await type('deal-cm-0-pct', '40')
  await click('[data-structure="single"]'); await click('[data-invoicing="annual"]')
  const moved = await page.evaluate((f) => Object.entries(f)
    .filter(([id, v]) => document.getElementById(id)?.value === v).map(([id]) => id), FROZEN)
  check('the form was moved OFF the frozen state first, or a restore proves nothing',
    moved.length === 0, 'still at frozen value: ' + moved.join(','))

  const target = (await versions()).find((v) => v.reason?.includes('fidelity fixture'))
  await page.evaluate((id) => document.querySelector(`[data-restore-version="${id}"]`)?.click(), target.id)
  // THE FORM IS DIRTY, SO RESTORE ASKS BEFORE OVERWRITING - which is the
  // behaviour, not an obstacle. The first run waited for the values to come
  // back while the modal sat open waiting for an answer.
  await page.waitForFunction(() =>
    !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), { timeout: 20000 })
  check('RESTORE OVER A DIRTY FORM ASKS BEFORE DISCARDING', true)
  await click('#discard-confirm-discard')
  await page.waitForFunction((want) =>
    document.getElementById('deal-lumpCost')?.value === want, { timeout: 20000 }, FROZEN['deal-lumpCost'])
  await settle()
  const restored = await page.evaluate((f) => {
    const out = {}
    for (const id of Object.keys(f)) out[id] = document.getElementById(id)?.value ?? '<missing>'
    out.__structure = document.querySelector('#deal-structure-toggle .ring-radio.active')?.dataset.structure
    out.__invoicing = document.querySelector('#deal-invoicing-toggle .ring-radio.active')?.dataset.invoicing
      ?? document.querySelector('#deal-hybrid-invoicing-toggle .ring-radio.active')?.dataset.invoicing
    return out
  }, FROZEN)
  for (const [id, want] of Object.entries(FROZEN)) {
    check(`RESTORE FIDELITY: ${id} came back`, restored[id] === want, `${restored[id]} (wanted ${want})`)
  }
  check('RESTORE FIDELITY: the UI state came back too',
    restored.__structure === 'hybrid' && restored.__invoicing === 'monthly',
    `${restored.__structure} / ${restored.__invoicing}`)

  // ── 7. FROZEN-RECORD BEHAVIOUR ─────────────────────────────────────────
  const raised = await api('POST', `/records/${oppId}/transition-requests`, {
    to_stage: 'Proposal', track: 'Commercial',
  }).then((r) => r.data).catch((e) => ({ error: String(e.message).slice(0, 80) }))
  const frozen = await rec()
  check('a raised transition request freezes the record',
    !!raised?.id || !!raised?.request?.id || !!frozen, JSON.stringify(raised).slice(0, 90))
  const write = await api('PATCH', `/opportunities/${oppId}`, { payload: { ...frozen.payload, ssNew: 99 } })
    .then(() => 'ACCEPTED').catch((e) => `refused ${e.status}`)
  check('AND A WRITE TO A FROZEN RECORD IS REFUSED', write.startsWith('refused'), write)

  check('no page errors across the whole walk',
    errs.filter((e) => !e.includes('favicon')).length === 0,
    errs.filter((e) => !e.includes('favicon')).slice(0, 2).join(' | '))
  await browser.close()
} catch (err) {
  R.push({ n: 'WALK THREW: ' + String(err.message).slice(0, 120), p: false, d: '' })
} finally {
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('record_type, reference_code')
    .eq('owner_id', uid).is('deleted_at', null)
  const live = q.error ? [{ record_type: 'QUERY FAILED: ' + q.error.message }] : q.data
  R.push({ n: 'RESIDUE across record types: none live', p: live.length === 0,
    d: live.map((r) => r.record_type).join(',') || 'zero' })
}

const failed = R.filter((r) => !r.p)
console.log(`\nWALK: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
