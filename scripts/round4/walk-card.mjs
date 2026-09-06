// ── ROUND 4 PHASE 2: THE PRIMARY WRITE PATH, LIVE ────────────────────────
// The React card against the React form, on a real record.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 150) })
const puppeteer = await loadPuppeteer('walk-card')
let browser = null
const { oppId } = await freshOpportunity('R4CARD')
{
  const db = admin()
  const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (error) throw new Error('could not stage the fixture: ' + error.message)
}

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
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
    throw new Error('NOT SIGNED IN')
  }
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // COUNTERFACTUAL: the hidden vanilla markup satisfies any id-presence wait, so
  // the wait is on the REACT card's own mount point having a rendered tree.
  await page.waitForFunction(() => {
    const root = document.getElementById('deal-version-root')
    return root && root.querySelector('#deal-version-panel')
      && (root.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const type = async (id, v) => { await page.evaluate(([i, x]) => {
    const e = document.getElementById(i); if (!e) throw new Error('no #' + i)
    const proto = e.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, String(x))
    e.dispatchEvent(new Event('input', { bubbles: true }))
  }, [id, v]); await settle() }
  const click = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await settle() }
  const txt = (id) => page.evaluate((i) => document.getElementById(i)?.textContent ?? null, id)
  const cls = (id) => page.evaluate((i) => document.getElementById(i)?.className ?? null, id)
  const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []
  const rec = async () => (await api('GET', `/opportunities/${oppId}`)).data
  const waitVersions = async (n) => {
    for (let i = 0; i < 40; i++) { if ((await versions()).length >= n) return true
      await new Promise((r) => setTimeout(r, 500)) }
    return false
  }

  check('THE REACT CARD IS MOUNTED, and the vanilla card is hidden',
    await page.evaluate(() => !!document.querySelector('#deal-version-root #deal-version-panel')
      && !!document.getElementById('deal-version-vanilla')?.classList.contains('hidden')))
  check('the empty state names the act and the label it produces',
    (await page.evaluate(() => document.getElementById('deal-version-list')?.textContent ?? ''))
      .includes('V0.1 is the first'))

  // ── 1. A BLANK REASON REFUSES AND WRITES NOTHING ───────────────────────
  await click('#btn-save-version')
  check('a blank reason refuses, and says what is wanted',
    (await txt('deal-version-feedback') ?? '').includes('based on'), await txt('deal-version-feedback'))
  check('and the class is the error one', (await cls('deal-version-feedback')) === 'msg-error')
  check('AND IT WROTE NOTHING', (await versions()).length === 0)

  // ── 2. SAVE FROM A CLEAN FORM: no deal revision ────────────────────────
  const revBefore = (await rec()).latest_revision_number
  await type('deal-version-reason', 'the quote of 4 March, clean form')
  await click('#btn-save-version')
  check('a version was taken from a clean form', await waitVersions(1), (await versions()).length)
  const revAfterClean = (await rec()).latest_revision_number
  check('and NO deal revision was written', revAfterClean === revBefore, `${revBefore} -> ${revAfterClean}`)
  check('the reason box cleared on success',
    (await page.evaluate(() => document.getElementById('deal-version-reason')?.value)) === '')
  check('and the feedback is the success one', (await cls('deal-version-feedback')) === 'msg-success')

  // ── 3. SAVE FROM A DIRTY FORM: THE DEAL IS SAVED FIRST ─────────────────
  await type('deal-ssExisting', '31')
  check('the form is dirty, so the freeze must save first',
    await page.evaluate(() => window.dealFormSeam.hasUnsavedChanges()))
  await type('deal-version-reason', 'second version, from a dirty form')
  await click('#btn-save-version')
  check('a second version exists', await waitVersions(2), (await versions()).length)
  const after = await rec()
  check('THE DEAL WAS SAVED FIRST: a revision was written',
    after.latest_revision_number > revAfterClean,
    `${revAfterClean} -> ${after.latest_revision_number}`)
  check('and the record holds the edited value', Number(after.payload.ssExisting) === 31, after.payload.ssExisting)
  const vs = await versions()
  check('the version froze the SAVED value, not the screen',
    Number(vs[0]?.inputs?.ssExisting) === 31, vs[0]?.inputs?.ssExisting)

  // ── 4. ISSUE ───────────────────────────────────────────────────────────
  const issueVisible = await page.evaluate(() => {
    const b = document.getElementById('btn-issue-version')
    return !!b && !b.classList.contains('hidden') && b.offsetParent !== null
  })
  check('the issue control is VISIBLE, not merely present', issueVisible)
  const issueLabel = await txt('btn-issue-version')
  check('the issue control names both versions', /^Issue V0\.\d+ as V1$/.test(issueLabel ?? ''), issueLabel)
  await click('#btn-issue-version')
  for (let i = 0; i < 40; i++) {
    if ((await versions()).some((v) => v.status === 'issued')) break
    await new Promise((r) => setTimeout(r, 500))
  }
  check('the latest draft issued', (await versions()).some((v) => v.status === 'issued'),
    (await versions()).map((v) => v.status).join(','))

  // ── 7. THE PRICING-APPROVAL REQUEST, THROUGH THE REPORTER ──────────────
  const askVisible = await page.evaluate(() => {
    const b = document.getElementById('btn-request-pricing-approval')
    return !!b && !b.classList.contains('hidden') && b.offsetParent !== null
  })
  check('the ask control is VISIBLE at a stage the version gate applies to', askVisible)
  const askState = await page.evaluate(() => ({
    disabled: document.getElementById('btn-request-pricing-approval')?.disabled,
    label: document.getElementById('btn-request-pricing-approval')?.textContent,
    line: document.getElementById('pricing-approval-state')?.textContent,
  }))
  check('the ask is offered once a version is issued and nothing is in the way',
    askState.disabled === false && /^Request approval of V\d+$/.test(askState.label ?? ''),
    `${askState.label} disabled=${askState.disabled} state="${askState.line}"`)
  // Hold the request open so the requesting state is observable.
  await page.evaluate(() => {
    window.__realApi = window.api
    window.api = (m, p, b) => (String(p).includes('transition-requests') && m === 'POST')
      ? new Promise((r) => { window.__release = () => r({ ok: true, data: {} }) })
      : window.__realApi(m, p, b)
  })
  await click('#btn-request-pricing-approval')
  const requesting = await page.evaluate(() => ({
    disabled: document.getElementById('btn-request-pricing-approval')?.disabled,
    label: document.getElementById('btn-request-pricing-approval')?.textContent,
  }))
  check('REQUESTING: the reporter disabled the control and relabelled it',
    requesting.disabled === true && requesting.label === 'Requesting...',
    `${requesting.label} disabled=${requesting.disabled}`)
  // A RE-RENDER MID-REQUEST must not take the control back.
  await page.evaluate(() => window.oppRefreshVersionActions?.())
  await settle()
  const afterRerender = await page.evaluate(() => ({
    disabled: document.getElementById('btn-request-pricing-approval')?.disabled,
    label: document.getElementById('btn-request-pricing-approval')?.textContent,
  }))
  check('AND A RE-RENDER MID-REQUEST DOES NOT RE-ENABLE IT',
    afterRerender.disabled === true && afterRerender.label === 'Requesting...',
    `${afterRerender.label} disabled=${afterRerender.disabled}`)
  await page.evaluate(() => { window.__release?.(); window.api = window.__realApi })
  await settle()

  // ── 5. THE REFUSAL PATH, and the card says so ──────────────────────────
  await page.evaluate(() => {
    const el = document.getElementById('deal-installResp')
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, 'Terminus Contractor - Lump Sum')
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
  await type('deal-lumpCost', '250000')
  await type('deal-cm-0-month', '2')
  await type('deal-cm-0-pct', '25')
  const beforeRefusal = (await versions()).length
  await type('deal-version-reason', 'this must be refused')
  await click('#btn-save-version')
  await settle()
  const refusal = await txt('deal-version-feedback')
  check('A NON-RECONCILING SCHEDULE REFUSES THE VERSION, and the card says why',
    /against \$250,000|does not match the price/.test(refusal ?? ''), refusal)
  check('and the refusal wrote nothing', (await versions()).length === beforeRefusal)
  check('the reason survived the refusal, so it can be tried again',
    (await page.evaluate(() => document.getElementById('deal-version-reason')?.value)) === 'this must be refused')

  // ── 6. RESTORE WITH FULL FIDELITY ──────────────────────────────────────
  await type('deal-cm-0-pct', '100')
  await type('deal-margin-hwSs', '42')
  await type('deal-ms-0-month', '3')
  await type('deal-ms-0-pct', '30')
  await click('[data-structure="hybrid"]')
  await type('deal-version-reason', 'the fidelity fixture')
  const beforeFid = (await versions()).length
  await click('#btn-save-version')
  check('the fidelity version was taken', await waitVersions(beforeFid + 1),
    `${beforeFid} -> ${(await versions()).length}; card said "${await txt('deal-version-feedback')}"`)

  const FROZEN = { 'deal-lumpCost': '250000', 'deal-margin-hwSs': '42',
    'deal-ms-0-month': '3', 'deal-ms-0-pct': '30', 'deal-cm-0-month': '2', 'deal-cm-0-pct': '100' }
  await type('deal-lumpCost', '111111'); await type('deal-margin-hwSs', '')
  await type('deal-ms-0-month', '9'); await type('deal-ms-0-pct', '90')
  await type('deal-cm-0-month', '8'); await type('deal-cm-0-pct', '40')
  await click('[data-structure="single"]')
  const stillAt = await page.evaluate((f) => Object.entries(f)
    .filter(([id, v]) => document.getElementById(id)?.value === v).map(([id]) => id), FROZEN)
  check('the form was moved OFF the frozen state, or a restore proves nothing',
    stillAt.length === 0, stillAt.join(','))

  const target = (await versions()).find((v) => v.reason?.includes('fidelity fixture'))
  await page.evaluate((id) => document.querySelector(`[data-restore-version="${id}"]`)?.click(), target.id)
  await page.waitForFunction(() =>
    !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), { timeout: 20000 })
  check('RESTORE OVER A DIRTY FORM ASKS BEFORE DISCARDING', true)
  await click('#discard-confirm-discard')
  await page.waitForFunction((w) => document.getElementById('deal-lumpCost')?.value === w,
    { timeout: 20000 }, FROZEN['deal-lumpCost'])
  await settle()
  const back = await page.evaluate((f) => {
    const out = {}
    for (const id of Object.keys(f)) out[id] = document.getElementById(id)?.value ?? '<missing>'
    out.__structure = document.querySelector('#deal-structure-toggle .ring-radio.active')?.dataset.structure
    return out
  }, FROZEN)
  for (const [id, want] of Object.entries(FROZEN)) {
    check(`RESTORE FIDELITY: ${id} came back`, back[id] === want, `${back[id]} (wanted ${want})`)
  }
  check('RESTORE FIDELITY: the UI state came back', back.__structure === 'hybrid', back.__structure)

  // ── 8. AND A NEWER DRAFT TAKES THE ASK BACK ────────────────────────────
  await page.evaluate(() => window.oppRefreshVersionActions?.())
  await settle()
  const reAsk = await page.evaluate(() => ({
    disabled: document.getElementById('btn-request-pricing-approval')?.disabled,
    line: document.getElementById('pricing-approval-state')?.textContent,
  }))
  check('A NEWER DRAFT DISABLES THE ASK, and the card says why rather than going quiet',
    reAsk.disabled === true && /is a draft\. Issue it before requesting approval/.test(reAsk.line ?? ''),
    `disabled=${reAsk.disabled} state="${reAsk.line}"`)

  check('no page errors across the walk',
    errs.filter((e) => !e.includes('favicon')).length === 0,
    errs.filter((e) => !e.includes('favicon')).slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'WALK THREW: ' + String(err.message).slice(0, 130), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('record_type').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0,
    d: q.error ? q.error.message : String(q.data.length) })
}
const failed = R.filter((r) => !r.p)
console.log(`\nCARD WALK: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
