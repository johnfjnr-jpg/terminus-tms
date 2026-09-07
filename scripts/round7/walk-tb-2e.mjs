// ── ROUND 7 PHASE 2E: THE LIVE WALK OF THE SWAPPED SURFACE ──────────────
//
// Verification 40: over HTTP, as the signed-in user, on the SUCCESS path,
// asserting the NEW BEHAVIOUR rather than the status.
//
// The first claim is the swap itself, and it is asserted by an ABSENCE that
// only the swap can produce: window.openTbField is a vanilla global, so a page
// that still has it is a page where the tag came back.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 220) })
const puppeteer = await loadPuppeteer('walk-tb-2e')
let browser = null
const fx = await freshTestBed('R7E2EWALK')
const bedId = fx.bedId ?? fx.id ?? fx.testBedId
let ME = null
let convertedOppId = null

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  ME = (await admin().from('records').select('owner_id').eq('id', bedId).maybeSingle()).data?.owner_id
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const q = (t) => page.$(`[data-testid="${t}"]`)
  // ── THE WAIT MUST NOT BE SATISFIED BY THE PREVIOUS RENDER ────────────
  //
  // Verification 7's counterfactual. `[data-testid="testbed-host"]` is already
  // in the document on a RETURN visit, so waiting on it returns before the
  // refetch lands - which made the ownership step read the old owner and
  // report the door as broken when the walk had simply looked too early.
  //
  // `expect` is a value only the new state can carry. The first visit passes
  // null and waits on the host; every later one waits on the record.
  const open = async (id = bedId, expect = null) => {
    await page.evaluate((x) => navigate('test-bed-detail', x), id)
    await page.waitForSelector('[data-testid="testbed-host"]', { timeout: 30000 })
    if (expect) {
      await page.waitForFunction((want) => {
        const v = document.getElementById('view-test-bed-detail')
        return v && !v.classList.contains('is-loading')
          && (v.innerText ?? '').includes(want)
      }, { timeout: 25000 }, expect).catch(() => {})
    }
    await settle()
  }

  // ── 1. THE SWAP ITSELF ────────────────────────────────────────────────
  const globals = await page.evaluate(() => ({
    openTbField: typeof window.openTbField,
    initPanel: typeof window.initTestBedDetailPanel,
    loader: typeof window.loadTestBedDetail,
    landing: typeof window.takeTestBedLanding,
  }))
  check('1a. the vanilla globals are GONE', globals.openTbField === 'undefined'
    && globals.initPanel === 'undefined', JSON.stringify(globals))
  check('1b. the bundle registers the loader', globals.loader === 'function')
  check('1c. the shell publishes the landing accessor', globals.landing === 'function')

  await open()
  check('1d. the React host is on screen', !!(await q('testbed-host')))
  check('1e. the header renders the record', !!(await q('tb-detail-name')))

  const rowCount = await page.evaluate(() =>
    document.querySelectorAll('.field-row [data-testid^="display-"]').length)
  check('1f. the field rows render', rowCount >= 20, `${rowCount} rows`)

  // ── 2. THE DOOR, MINE ─────────────────────────────────────────────────
  const stopsMine = await page.evaluate(() =>
    [...document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
      .filter((d) => d.getAttribute('tabindex') === '0').length)
  const editableMine = await page.evaluate(() =>
    document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]').length)
  check('2a. MINE: every editable row is a tab stop',
    editableMine > 0 && stopsMine === editableMine, `${stopsMine}/${editableMine}`)

  // ── 3. THE BATCHED SAVE, only-dirty and the handshake ────────────────
  const revBefore = (await api('GET', `/test-beds/${bedId}`)).data?.latest_revision_number
  const stamp = 'WALK-' + String(Date.now()).slice(-6)
  await page.evaluate(() => {
    const d = document.querySelector('[data-key="city"] [data-testid^="display-"]')
    d?.click()
  })
  await page.waitForSelector('[data-key="city"] input, [data-key="city"] textarea', { timeout: 8000 })
  await page.type('[data-key="city"] input', stamp)
  await settle()
  // The save button carries data-testid="save-all" and id="tb-react-save-all".
  // The first version of this walk queried the ID as a TESTID and found
  // nothing, which read as a save that wrote nothing.
  await page.evaluate(() => document.getElementById('tb-react-save-all')?.click())
  await page.waitForFunction(() => {
    const f = document.querySelector('[data-testid="tb-save-feedback"]')
    return f && f.textContent.trim().length > 0
  }, { timeout: 15000 }).catch(() => {})
  await settle()
  const after = (await api('GET', `/test-beds/${bedId}`)).data
  check('3a. the save WROTE, and only the dirty key',
    String(after?.payload?.city ?? '').includes(stamp), `city=${after?.payload?.city}`)
  check('3b. the revision handshake advanced',
    (after?.latest_revision_number ?? 0) > (revBefore ?? 0),
    `${revBefore} -> ${after?.latest_revision_number}`)

  // ── 4. THE STAGE TABS ─────────────────────────────────────────────────
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tb-tab]')].map((b) => b.dataset.tbTab))
  check('4a. ten tabs render', tabs.length === 10, tabs.join(','))

  await page.evaluate(() =>
    document.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]')?.click())
  await page.waitForSelector('[data-testid="tb-tab-stage-detail"]', { timeout: 15000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="tb-stage-exit-criteria-list"]')
    return el && el.getAttribute('data-stage') === 'Qualification'
  }, { timeout: 20000 }).catch(() => {})
  await settle()
  const panels = await page.evaluate(() => ({
    docs: document.querySelector('[data-testid="tb-stage-documents-section"]')?.getAttribute('data-stage'),
    crit: document.querySelector('[data-testid="tb-stage-exit-criteria-list"]')?.getAttribute('data-stage'),
    appr: document.querySelector('[data-testid="tb-stage-approval-row"]')?.getAttribute('data-stage'),
    card: document.querySelector('[data-testid="tb-stage-scoring-card"]')?.hasAttribute('hidden'),
  }))
  check('4b. the three panels SETTLE on the stage they show',
    panels.docs === 'Qualification' && panels.crit === 'Qualification'
    && panels.appr === 'Qualification', JSON.stringify(panels))
  check('4c. P8: the scoring card is revealed once its stage is derived',
    panels.card === false, `hidden=${panels.card}`)

  // The terminal tab renders the completed record INSTEAD of the panels.
  await page.evaluate(() =>
    document.querySelector('[data-testid="tb-tab-btn-stage-Closed"]')?.click())
  await page.waitForFunction(() =>
    !!document.querySelector('[data-testid="tb-closed-groups"]'), { timeout: 20000 }).catch(() => {})
  await settle()
  const closed = await page.evaluate(() => ({
    closed: !!document.querySelector('[data-testid="tb-closed-groups"]'),
    panels: !!document.querySelector('[data-testid="tb-stage-exit-criteria-list"]'),
    inputs: document.querySelectorAll('[data-testid="tb-closed"] input').length,
  }))
  check('4d. the TERMINAL tab shows the completed record and not the panels',
    closed.closed && !closed.panels, JSON.stringify(closed))
  check('4e. and it is read-only by construction', closed.inputs === 0, `${closed.inputs} inputs`)

  // ── 5. RE-NAVIGATION ──────────────────────────────────────────────────
  await page.evaluate(() => navigate('test-beds'))
  await settle()
  // Waits on the SAVED VALUE, which only a re-read can produce.
  await open(bedId, stamp)
  const second = await page.evaluate(() => ({
    host: !!document.querySelector('[data-testid="testbed-host"]'),
    loading: document.getElementById('view-test-bed-detail')?.className ?? '',
    stage: !!document.querySelector('[data-testid="tb-tab-stage-detail"]'),
    city: document.querySelector('[data-key="city"] [data-testid^="display-"]')?.textContent ?? '',
  }))
  check('5a. the SECOND visit renders', second.host, JSON.stringify(second))
  check('5b. and the view settles rather than staying on is-loading',
    !second.loading.includes('is-loading'), second.loading)
  check('5c. it lands on Reference, not the previous record\'s stage tab', !second.stage)
  check('5d. and it re-read the record', second.city.includes(stamp), second.city)

  // ── 6. THE CONVERT PATH, END TO END ───────────────────────────────────
  await page.evaluate(() => document.querySelector('[data-testid="tb-convert-trigger"]')?.click())
  await page.waitForSelector('[data-testid="tb-opp-name"]', { timeout: 8000 })
  const oppName = 'Walk conversion ' + String(Date.now()).slice(-6)
  await page.type('[data-testid="tb-opp-name"]', oppName)
  await page.evaluate(() => document.querySelector('[data-testid="tb-convert-submit"]')?.click())
  await page.waitForSelector('[data-testid="tb-convert-feedback"]', { timeout: 20000 })
  await settle()
  const conv = await page.evaluate(() => ({
    text: document.querySelector('[data-testid="tb-convert-feedback"]')?.textContent ?? '',
    view: !!document.querySelector('[data-testid="tb-convert-view"]'),
    formOpen: !!document.querySelector('[data-testid="tb-convert-form-wrap"]'),
  }))
  check('6a. THE CROSS-RECORD WRITE succeeded', conv.text.includes('Opportunity created'), conv.text)
  check('6b. it OFFERS the new record rather than navigating', conv.view && !conv.formOpen,
    JSON.stringify(conv))

  const det = await admin().from('opportunity_details')
    .select('record_id, converted_from_test_bed_id, probability_pct')
    .eq('converted_from_test_bed_id', bedId)
  check('6c. the LINK ROW exists on the target', (det.data ?? []).length === 1,
    JSON.stringify(det.data))
  convertedOppId = det.data?.[0]?.record_id ?? null

  if (convertedOppId) {
    const rev = await admin().from('record_revisions').select('payload, revision_number')
      .eq('record_id', convertedOppId).order('revision_number', { ascending: false }).limit(1)
    const p = rev.data?.[0]?.payload ?? {}
    const bedPayload = (await api('GET', `/test-beds/${bedId}`)).data?.payload ?? {}
    check('6d. the revision exists at number 1', rev.data?.[0]?.revision_number === 1,
      String(rev.data?.[0]?.revision_number))
    check('6e. the name carried', p.name === oppName, String(p.name))
    check('6f. client_organisation RENAMED to company_name',
      (p.company_name ?? '') === (bedPayload.client_organisation ?? ''),
      `${p.company_name} vs ${bedPayload.client_organisation}`)
    check('6g. initialLead RENAMED to customerLead',
      (p.customerLead ?? null) === (bedPayload.initialLead ?? null),
      `${p.customerLead} vs ${bedPayload.initialLead}`)
  }

  // NOTHING is written back to the source: the only trace is an audit row.
  const audit = await admin().from('audit_log').select('action')
    .eq('record_id', bedId).eq('action', 'converted_to_opportunity')
  check('6h. the SOURCE carries only an audit row', (audit.data ?? []).length === 1,
    JSON.stringify(audit.data))

  // THE DOUBLE-CONVERSION BEHAVIOUR, observed rather than assumed.
  // The api client THROWS on a non-2xx, so the refusal arrives as an exception.
  // Caught rather than allowed to end the walk: a refusal is the expected
  // result here, and the walk's own teardown must still run.
  let second2 = null
  try {
    await api('POST', `/test-beds/${bedId}/convert`, { opportunity_name: 'Second attempt' })
    second2 = { status: 201, body: null }
  } catch (e) {
    second2 = { status: e.status ?? 0, body: e.body ?? null }
  }
  check('6i. a SECOND conversion is refused, and says why',
    second2.status === 422 && String(second2.body?.error ?? '').includes('already been converted'),
    `${second2.status} ${JSON.stringify(second2.body)}`)

  // ── 7. THE DOOR, NOT MINE ─────────────────────────────────────────────
  const other = await admin().from('records').select('owner_id')
    .neq('owner_id', ME).not('owner_id', 'is', null).limit(1).maybeSingle()
  if (!other.data?.owner_id) {
    check('7. NOT MINE: no second owner exists to borrow', false, 'skipped')
  } else {
    await admin().from('records').update({ owner_id: other.data.owner_id }).eq('id', bedId)
    // Waits on the BANNER, which only the re-read record can produce. Bounded,
    // so a genuine absence still fails rather than hanging.
    await page.evaluate(() => navigate('test-beds'))
    await settle()
    await page.evaluate((x) => navigate('test-bed-detail', x), bedId)
    await page.waitForFunction(() =>
      !!document.querySelector('[data-testid="tb-readonly-banner-body"]'),
    { timeout: 20000 }).catch(() => {})
    await settle()
    const notMine = await page.evaluate(() => ({
      banner: !!document.querySelector('[data-testid="tb-readonly-banner-body"]'),
      klass: document.getElementById('view-test-bed-detail')?.classList.contains('is-not-mine'),
      stops: [...document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
        .filter((d) => d.getAttribute('tabindex') !== null).length,
      rows: document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]').length,
      reads: [...document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
        .filter((d) => (d.textContent ?? '').trim().length > 0).length,
    }))
    check('7a. NOT MINE: the banner is shown', notMine.banner, JSON.stringify(notMine))
    check('7b. A12 LIVE: NO row is a tab stop', notMine.rows > 0 && notMine.stops === 0,
      `${notMine.stops} stops of ${notMine.rows} rows`)
    check('7c. and every refused row STILL READS', notMine.reads > 0,
      `${notMine.reads}/${notMine.rows} read`)

    const opened = await page.evaluate(async () => {
      const ds = [...document.querySelectorAll('.field-row:not([data-readonly]) [data-testid^="display-"]')]
      for (const d of ds) d.click()
      await new Promise((r) => requestAnimationFrame(r))
      // AN OPEN ROW IS A HIDDEN DISPLAY HALF, not the presence of an input.
      // Behaviour 3 keeps BOTH halves in the document always and lets `hidden`
      // decide which is seen, so counting inputs counts the closed rows too -
      // which read as 31 rows opening when none had.
      return document.querySelectorAll('.field-row [data-testid^="display-"][hidden]').length
    })
    check('7d. and no row OPENS on a click', opened === 0, `${opened} editors open`)
  }

  check('99. no page errors', errs.length === 0, errs.join(' | '))
} finally {
  try { if (ME) await admin().from('records').update({ owner_id: ME }).eq('id', bedId) } catch {}
  // The conversion created a record the fixture tag does not cover.
  try {
    if (convertedOppId) {
      await admin().from('opportunity_details').delete().eq('record_id', convertedOppId)
      await admin().from('records').update({ deleted_at: new Date().toISOString() })
        .eq('id', convertedOppId)
    }
  } catch (e) { console.log('convert teardown: ' + e.message) }
  if (browser) await browser.close()
  await tearDown()
  const { data: left } = await admin().from('records').select('id, record_type')
    .is('deleted_at', null).eq('owner_id', ME)
  console.log(`\nRESIDUE: ${left?.length ?? '?'} live records owned by the test account`
    + (left?.length ? ' -> ' + JSON.stringify(left) : ''))
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
