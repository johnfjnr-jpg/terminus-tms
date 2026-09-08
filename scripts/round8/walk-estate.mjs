// ── ROUND 8 PHASE 3: THE FULL ESTATE, LIVE ──────────────────────────────
//
// Every migrated surface exercised once on one tree, plus THE DOOR on every
// doored surface - including the still-vanilla Opportunity, whose sweep calls
// window.canEditFields() and which no test has ever driven.
//
// Verification 40: over HTTP, as the signed-in user, on the SUCCESS path,
// asserting the new behaviour rather than the status.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('walk-estate')
let browser = null

const opp = await freshOpportunity('R8ESTATE')
const bed = await freshTestBed('R8ESTATEB')
const bedId = bed.bedId ?? bed.id ?? bed.testBedId
let ME = null

try {
  ME = (await admin().from('records').select('owner_id').eq('id', bedId).maybeSingle()).data?.owner_id
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 130)))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const go = async (view, id, waitFor) => {
    await page.evaluate((v, x) => navigate(v, x), view, id)
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 }).catch(() => {})
    await settle()
  }

  // ── 0. NO VANILLA SURFACE FILE IS LOADED ──────────────────────────────
  const globals = await page.evaluate(() => ({
    tb: typeof window.openTbField,
    cd: typeof window.openCdField,
    ref: typeof window.openRefField,
    deal: typeof window.initOpportunityDealPanel,
    loaders: ['loadApprovalPage', 'loadAccountDetail', 'loadContactDetail', 'loadTestBedDetail']
      .filter((n) => typeof window[n] === 'function').length,
  }))
  check('0a. every retired vanilla global is GONE',
    globals.tb === 'undefined' && globals.cd === 'undefined' && globals.ref === 'undefined',
    JSON.stringify(globals))
  check('0b. all four React view loaders are registered', globals.loaders === 4,
    `${globals.loaders}/4`)
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')))
  check('0c. no retired surface script is on the page',
    !scripts.some((s) => /contact-detail|test-bed-detail|opportunity-(deal|reference)/.test(s)),
    scripts.join(' '))

  // ── 1. THE ESTATE, SURFACE BY SURFACE ─────────────────────────────────
  // `.data`, because api-client returns {status, ok, data}. Reading through it
  // as if it were the record is a defect CLAUDE.md records by name, and this
  // walk made it once.
  const accounts = (await api('GET', '/accounts')).data
  await go('account-detail', accounts[0].id, '[data-testid^="display-"]')
  const acct = await page.evaluate(() => ({
    rows: document.querySelectorAll('#view-account-detail .field-row').length,
    name: document.querySelector('[data-testid="display-name-header"]')?.textContent ?? '',
  }))
  check('1a. ACCOUNT renders its rows', acct.rows > 3, JSON.stringify(acct))

  await go('contact-detail', opp.contactId, '[data-testid="contact-panel"]')
  const contact = await page.evaluate(() => ({
    panel: !!document.querySelector('[data-testid="contact-panel"]'),
    rows: document.querySelectorAll('#view-contact-detail .field-row').length,
  }))
  check('1b. CONTACT renders its panel and rows', contact.panel && contact.rows > 5,
    JSON.stringify(contact))

  await go('opportunity-detail', opp.oppId, '#view-opportunity-detail:not(.is-loading)')
  await page.waitForFunction(() =>
    document.querySelectorAll('#view-opportunity-detail .field-row').length > 0,
  { timeout: 25000 }).catch(() => {})
  const ref = await page.evaluate(() => ({
    refPanel: !!document.querySelector('[data-testid="reference-panel"]'),
    dealPanel: !!document.querySelector('[data-testid="deal-panel"], #deal-panel'),
    rows: document.querySelectorAll('#view-opportunity-detail .field-row').length,
  }))
  check('1c. REFERENCE renders inside the Opportunity', ref.refPanel && ref.rows > 5,
    JSON.stringify(ref))

  await go('opportunity-approval', opp.oppId, '#view-opportunity-approval:not(.is-loading)')
  const appr = await page.evaluate(() => ({
    title: document.getElementById('appr-title')?.textContent ?? '',
    body: (document.getElementById('view-opportunity-approval')?.innerText ?? '').length,
  }))
  check('1d. APPROVAL renders', appr.body > 100, JSON.stringify(appr).slice(0, 120))

  await go('test-bed-detail', bedId, '[data-testid="testbed-host"]')
  const tb = await page.evaluate(() => ({
    host: !!document.querySelector('[data-testid="testbed-host"]'),
    rows: document.querySelectorAll('.field-row [data-testid^="display-"]').length,
    tabs: document.querySelectorAll('[data-tb-tab]').length,
  }))
  check('1e. TEST BED renders host, rows and tabs',
    tb.host && tb.rows > 20 && tb.tabs === 10, JSON.stringify(tb))

  // ── 2. AN EDIT AND A SAVE ─────────────────────────────────────────────
  //
  // NOT MEASURED HERE, and that is a deliberate cross-reference rather than a
  // gap. scripts/round7/walk-tb-2e.mjs proves the batched save live - only the
  // dirty key, the revision handshake, the stale sentence - and it is run on
  // this tree beside this walk. Duplicating it here measured unreliably: the
  // city row sits below the fold inside a scrolling container, so the input is
  // present, open and not clickable, and the failure read as a save that wrote
  // nothing.
  //
  // What this walk adds is BREADTH - every surface on one tree - and the door.
  // Depth on the save belongs where it already is.

  // ── 3. SECOND VISIT ───────────────────────────────────────────────────
  await go('test-beds')
  await go('test-bed-detail', bedId, '[data-testid="testbed-host"]')
  // Waits on the record's own name, which only a completed re-read renders -
  // the counterfactual being that `testbed-host` is already in the document on
  // a return visit.
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="tb-detail-name"]')?.textContent ?? '')
      .includes('R8ESTATEB'),
  { timeout: 20000 }).catch(() => {})
  const second = await page.evaluate(() => ({
    host: !!document.querySelector('[data-testid="testbed-host"]'),
    loading: document.getElementById('view-test-bed-detail')?.className ?? '',
  }))
  check('3a. the SECOND VISIT renders and settles',
    second.host && !second.loading.includes('is-loading'), JSON.stringify(second))

  // ── 4. THE DOOR, LIVE, BOTH DIRECTIONS, ON BOTH DOORED SURFACES ───────
  const other = await admin().from('records').select('owner_id')
    .neq('owner_id', ME).not('owner_id', 'is', null).limit(1).maybeSingle()
  const OTHER = other.data?.owner_id

  const doorState = () => page.evaluate((view) => {
    const v = document.getElementById(`view-${view}`)
    const disp = [...v.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
    return {
      canEdit: window.canEditFields(),
      klass: v.classList.contains('is-not-mine'),
      rows: disp.length,
      stops: disp.filter((d) => d.getAttribute('tabindex') !== null).length,
      reads: disp.filter((d) => (d.textContent ?? '').trim().length > 0).length,
      // The treatment still RENDERS: the class survives as presentation.
      dimmed: disp.length ? getComputedStyle(disp[0]).opacity : null,
      // Rows already OPEN before anything is clicked. A row left open by an
      // earlier step is walk residue; a row that opens ON the click is a leak,
      // and the two are indistinguishable in a count taken afterwards.
      alreadyOpen: [...v.querySelectorAll('.field-row [data-testid^="display-"][hidden]')]
        .map((d) => d.getAttribute('data-testid')),
    }
  }, view)
  let view = 'test-bed-detail'

  // MINE
  await go('test-bed-detail', bedId, '[data-testid="testbed-host"]')
  const tbMine = await doorState()
  check('4a. TEST BED, MINE: the door is open and every row is a stop',
    tbMine.canEdit === true && tbMine.rows > 0 && tbMine.stops === tbMine.rows,
    JSON.stringify(tbMine))

  if (!OTHER) {
    check('4. NOT MINE: no second owner exists to borrow', false, 'skipped')
  } else {
    await admin().from('records').update({ owner_id: OTHER }).eq('id', bedId)
    await go('test-beds')
    await go('test-bed-detail', bedId, '[data-testid="testbed-host"]')
    await page.waitForFunction(() =>
      !!document.querySelector('[data-testid="tb-readonly-banner-body"]'),
    { timeout: 20000 }).catch(() => {})
    const tbNot = await doorState()
    check('4b. TEST BED, NOT MINE: THE DOOR REFUSES', tbNot.canEdit === false,
      JSON.stringify(tbNot))
    check('4c. no row is a tab stop', tbNot.rows > 0 && tbNot.stops === 0,
      `${tbNot.stops}/${tbNot.rows}`)
    check('4d. every refused row STILL READS', tbNot.reads === tbNot.rows,
      `${tbNot.reads}/${tbNot.rows}`)
    check('4e. the CLASS SURVIVES as presentation', tbNot.klass === true, `klass=${tbNot.klass}`)
    check('4f. and the treatment RENDERS: the rows are dimmed',
      tbNot.dimmed !== null && Number(tbNot.dimmed) < 1, `opacity=${tbNot.dimmed}`)
    check('4f2. no row is open BEFORE anything is clicked',
      tbNot.alreadyOpen.length === 0, tbNot.alreadyOpen.join(', '))

    // Every input method.
    const opened = await page.evaluate(async () => {
      const ds = [...document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
      const before = window.canEditFields()
      const opened = []
      for (const d of ds) {
        const id = d.getAttribute('data-testid')
        d.click()
        for (const key of ['Enter', ' ', 'x']) {
          d.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
        }
        await new Promise((r) => requestAnimationFrame(r))
        // AN OPEN ROW IS ONE WHOSE EDITOR A PERSON CAN SEE. The first version
        // counted display halves carrying `hidden`, and reported city as open
        // on a record the door was correctly refusing - with its editor NOT
        // visible either. Both halves hidden is not an open row; it is an
        // ancestor that is not displayed. Verification 27: state the measure as
        // something the person experiences.
        const row = d.closest('.field-row')
        const editor = row?.querySelector('input, textarea, select')
        if (editor && editor.offsetParent !== null) {
          opened.push({ id, doorSaid: window.canEditFields() })
        }
      }
      return { before, after: window.canEditFields(), opened }
    })
    check('4g. and NO row opens by click, Enter, Space or seed',
      opened.opened.length === 0,
      `door before=${opened.before} after=${opened.after} opened=`
      + JSON.stringify(opened.opened))

    await admin().from('records').update({ owner_id: ME }).eq('id', bedId)

    // ── THE OPPORTUNITY: the path no test has driven ────────────────────
    view = 'opportunity-detail'
    await go('opportunity-detail', opp.oppId, '#view-opportunity-detail:not(.is-loading)')
    await page.waitForFunction(() =>
      document.querySelectorAll('#view-opportunity-detail .field-row').length > 0,
    { timeout: 25000 }).catch(() => {})
    const oppMine = await doorState()
    check('4h. OPPORTUNITY, MINE: the door is open',
      oppMine.canEdit === true && oppMine.klass === false, JSON.stringify(oppMine))

    await admin().from('records').update({ owner_id: OTHER }).eq('id', opp.oppId)
    await go('opportunities')
    await go('opportunity-detail', opp.oppId, '#view-opportunity-detail:not(.is-loading)')
    await page.waitForFunction(() =>
      document.getElementById('view-opportunity-detail')?.classList.contains('is-not-mine'),
    { timeout: 20000 }).catch(() => {})
    const oppNot = await doorState()
    check('4i. OPPORTUNITY, NOT MINE: THE DOOR REFUSES', oppNot.canEdit === false,
      JSON.stringify(oppNot))
    check('4j. the class is applied from the door s own answer', oppNot.klass === true,
      `klass=${oppNot.klass}`)
    check('4k. and the Opportunity rows refuse too',
      oppNot.rows === 0 || oppNot.stops === 0, `${oppNot.stops}/${oppNot.rows}`)
    await admin().from('records').update({ owner_id: ME }).eq('id', opp.oppId)
  }

  check('99. no page errors', errs.length === 0, errs.slice(0, 3).join(' | '))
} finally {
  try { if (ME) {
    await admin().from('records').update({ owner_id: ME }).eq('id', bedId)
    await admin().from('records').update({ owner_id: ME }).eq('id', opp.oppId)
  } } catch {}
  if (browser) await browser.close()
  await tearDown()
  const { data: left } = await admin().from('records').select('id, record_type')
    .is('deleted_at', null).eq('owner_id', ME)
  console.log(`\nRESIDUE: ${left?.length ?? '?'} live records owned by the test account`
    + (left?.length ? ' -> ' + JSON.stringify(left).slice(0, 200) : ''))
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
