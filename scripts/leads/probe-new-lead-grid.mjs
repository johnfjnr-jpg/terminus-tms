// P5: the New Lead batch grid, verified on the live screen.
//
// ── THE MANDATORY-SET CLAIM IS NOT SCREEN-VERSUS-ENDPOINT ────────────────
//
// The obvious probe reads the required keys off the screen and compares them
// with GET /contacts/creation-requirements. That is a TAUTOLOGY: the grid
// renders its markers FROM that endpoint, so the two agree by construction and
// the check passes whatever the server actually refuses. It is Verification
// 20's second-reader trap with both readers pointed at the same value.
//
// The claim John ruled is "the mandatory set matches the server", and the
// server's mandatory set is defined by WHAT POST /contacts REFUSES. So the
// instrument here omits each field in turn from a real POST and reads the
// refusal. A field the server accepts as absent is not mandatory, whatever any
// endpoint says about itself.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-new-lead-grid.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tearDown } from '../fixtures.mjs'
import { api, ApiError } from '../api-client.mjs'
import { isValidMobile } from '../../src/lib/field-validation.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'p5grid'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => await api(m, p, b)
// The omission loop NEEDS the refusal as data - a thrown ApiError would end
// the measurement at the first mandatory field and report one, not six.
const attempt = async (m, p, b) => {
  try { const r = await api(m, p, b); return { ok: true, status: r.status, data: r.data } }
  catch (e) {
    if (e instanceof ApiError) return { ok: false, status: e.status, data: e.body }
    throw e
  }
}
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED - refusing to measure a stale bundle'); process.exit(2)
}

const COLUMNS = ['name', 'company', 'jobRole', 'industry_id', 'email', 'mobile', 'source', 'summary']
const industry = (await call('GET', '/industries')).data[0]
const GOOD = {
  name: `${TAG} Probe Lead`, company: 'Grid Holdings', jobRole: 'Head of Ops',
  industry_id: industry.id, email: 'grid@example.invalid', mobile: '+65 9000 0031',
  source: 'Direct Outreach', summary: 'from the batch grid probe',
}

// ── CLAIM 1a: the SERVER's mandatory set, measured by refusal ─────────────
console.log('\nCLAIM 1a  the server\'s own creation minimum, by omission')
const serverRequired = []
const createdIds = []
for (const key of COLUMNS) {
  const body = { ...GOOD, name: `${TAG} omit-${key}` }
  delete body[key]
  const res = await attempt('POST', '/contacts', body)
  if (res.ok) { createdIds.push(res.data.id); console.log(`        without ${key.padEnd(12)} -> ACCEPTED`) }
  else { serverRequired.push(key); console.log(`        without ${key.padEnd(12)} -> REFUSED  ${JSON.stringify(res.data?.missing ?? res.data?.error)}`) }
}
// CALIBRATION: the instrument must be shown ACCEPTING, or a blanket refusal
// (an expired token, a broken body) would read as "everything is mandatory".
check('the omission instrument reaches both answers',
  serverRequired.length > 0 && serverRequired.length < COLUMNS.length,
  `refused without ${serverRequired.length} of ${COLUMNS.length} fields, accepted without ${COLUMNS.length - serverRequired.length}`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  page.on('console', (m) => { if (m.type() === 'error') console.log(`        [console] ${m.text()}`) })
  page.on('pageerror', (e) => console.log(`        [pageerror] ${e.message}`))
  await page.evaluate(() => navigate('leads'))
  await page.waitForSelector('#btn-new-contact', { visible: true })
  await page.click('#btn-new-contact')
  await page.waitForSelector('[data-testid="nlg-th-name"]', { visible: true })
  // AND THEN WAIT AGAIN, ON THE FETCH. The first run waited only on the th
  // above and read ZERO required markers - not because the grid was wrong but
  // because the th is STATIC markup that exists whether or not
  // GET /contacts/creation-requirements has answered. Verification 7's
  // counterfactual names it exactly: the condition was already true.
  //
  // The wait is on the INDUSTRY select being populated, deliberately not on
  // the markers themselves. Both are set by the same Promise.all, so this
  // proves the fetch landed; waiting on the markers would be waiting on the
  // very thing CLAIM 1b asserts.
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="nlg-industry_id-0"]')?.options.length ?? 0) > 1)

  // ── CLAIM 1b: the SCREEN's mandatory set ───────────────────────────────
  console.log('\nCLAIM 1b  the screen\'s markers against that measured set')
  const screenRequired = await page.evaluate((cols) =>
    cols.filter((k) => !!document.querySelector(`[data-testid="nlg-required-${k}"]`)), COLUMNS)
  const same = serverRequired.length === screenRequired.length &&
    serverRequired.every((k) => screenRequired.includes(k))
  check('the grid marks exactly what the server refuses without',
    same,
    `server=[${serverRequired.join(', ')}]  screen=[${screenRequired.join(', ')}]`)

  // Verification 17: the marker probe must be shown returning a DIFFERENT
  // value, or "they match" could be two empty lists agreeing.
  check('the marker probe discriminates (a non-required column carries no marker)',
    screenRequired.length > 0 && !screenRequired.includes('summary'),
    `summary marked: ${screenRequired.includes('summary')}, markers found: ${screenRequired.length}`)

  const type = async (key, row, text) => {
    const sel = `[data-testid="nlg-${key}-${row}"]`
    await page.click(sel)
    await page.evaluate((s) => { document.querySelector(s).value = '' }, sel)
    // A framework-controlled input is driven with REAL keystrokes. A synthetic
    // value write is deduped by React's value tracker and the DOM then shows
    // text the component's state never received.
    await page.type(sel, text)
  }
  const pick = async (key, row, value) => {
    await page.select(`[data-testid="nlg-${key}-${row}"]`, value)
  }
  const fillRow = async (row, over = {}) => {
    const v = { ...GOOD, ...over }
    for (const k of ['name', 'company', 'jobRole', 'email', 'mobile', 'summary']) await type(k, row, v[k])
    await pick('industry_id', row, v.industry_id)
    await pick('source', row, v.source)
  }

  // ── CLAIM 2: field-by-field validation, both directions ────────────────
  console.log('\nCLAIM 2  validation both ways, on the live screen')
  const BAD_EMAIL = 'not-an-email'
  const BAD_MOBILE = 'abc'
  // The mobile case is PROVEN against the server's own function, not a
  // rebuilt pattern: the probe asserts isValidMobile agrees before it asks
  // the screen anything.
  check('the mobile case is one the server\'s own validator rejects',
    isValidMobile(GOOD.mobile) === true && isValidMobile(BAD_MOBILE) === false,
    `isValidMobile("${GOOD.mobile}")=true, isValidMobile("${BAD_MOBILE}")=false`)

  await fillRow(0, { email: BAD_EMAIL })
  await page.click('[data-testid="nlg-name-1"]')     // blur the last field
  await page.waitForFunction(() => !!document.querySelector('[data-testid="nlg-why-email-0"]'))
  const emailWhy = await page.$eval('[data-testid="nlg-why-email-0"]', (e) => e.textContent)
  check('an invalid email flags its own field on blur', !!emailWhy, `row 0 email: "${emailWhy}"`)

  await fillRow(1, { mobile: BAD_MOBILE, email: 'row1@example.invalid' })
  await page.click('[data-testid="nlg-name-2"]')
  await page.waitForFunction(() => !!document.querySelector('[data-testid="nlg-why-mobile-1"]'))
  check('an invalid mobile flags its own field on blur',
    true, `row 1 mobile: "${await page.$eval('[data-testid="nlg-why-mobile-1"]', (e) => e.textContent)}"`)

  // THE OTHER DIRECTION, and without it the two above are satisfied by a
  // grid that flags everything.
  await fillRow(2, { name: `${TAG} Valid A`, email: 'valida@example.invalid' })
  await fillRow(3, { name: `${TAG} Valid B`, email: 'validb@example.invalid' })
  // BLUR ON THE HEADER, not on row 4. Row 4 exists only BECAUSE auto-extend
  // works, so blurring there made every later assertion depend on it - and the
  // calibration proved the cost: removing auto-extend killed the probe HERE,
  // six lines before its own auto-extend check ever ran. That check was
  // therefore never shown capable of failing, which is the one thing a
  // calibration exists to establish. A th is always present.
  await page.click('[data-testid="nlg-th-name"]')
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="nlg-row-2"]')?.dataset.invalid === 'false')
  const flags = await page.evaluate(() => [0, 1, 2, 3].map((i) =>
    document.querySelector(`[data-testid="nlg-row-${i}"]`)?.dataset.invalid))
  check('valid rows are NOT flagged while invalid ones are',
    flags[0] === 'true' && flags[1] === 'true' && flags[2] === 'false' && flags[3] === 'false',
    `row invalid flags: ${JSON.stringify(flags)}`)

  // The Save button's TREATMENT, asserted because a screenshot found it wrong
  // and nothing else could: an unclassed button is present, positioned and
  // clickable, so presence, position and behaviour all passed on a white
  // browser default sitting on a dark screen.
  const save = await page.$eval('[data-testid="nlg-save"]', (e) => ({
    cls: e.className,
    bg: getComputedStyle(e).backgroundColor,
    right: Math.round(e.getBoundingClientRect().right),
    footRight: Math.round(e.closest('.new-lead-foot').getBoundingClientRect().right),
  }))
  check('Save carries the estate treatment and sits bottom-right',
    save.cls.includes('btn-primary') && save.footRight - save.right < 4,
    `class="${save.cls}", background ${save.bg}, ${save.footRight - save.right}px from the footer's right edge`)

  const counts = await page.$eval('[data-testid="nlg-counts"]', (e) => e.textContent)
  check('the grid reports 2 ready and 2 to correct', counts.includes('2 ready') && counts.includes('2 to correct'), counts)

  // ── the last row auto-extends ──────────────────────────────────────────
  const rowsBefore = await page.$$eval('[data-testid^="nlg-row-"]', (r) => r.length)
  await page.click(`[data-testid="nlg-name-${rowsBefore - 1}"]`)
  // Bounded, and the timeout is CAUGHT so a missing auto-extend reports as a
  // named FAIL rather than a stack trace. The calibration is what asked for
  // this: the injection was firing, and the output said only "TimeoutError at
  // line 186", which is a reader's problem to decode.
  try {
    await page.waitForFunction((n) =>
      document.querySelectorAll('[data-testid^="nlg-row-"]').length > n, { timeout: 5000 }, rowsBefore)
  } catch { /* reported by the check below, with the counts */ }
  const rowsAfter = await page.$$eval('[data-testid^="nlg-row-"]', (r) => r.length)
  check('focusing the last row extends the grid', rowsAfter > rowsBefore, `${rowsBefore} -> ${rowsAfter} rows`)

  await page.screenshot({ path: `${OUT}p5-grid-mixed.png` })

  // ── CLAIM 3: partial save, by MEMBERSHIP ───────────────────────────────
  console.log('\nCLAIM 3  partial save, measured on the list not the message')
  const before = (await call('GET', '/contacts')).data.filter((c) => c.payload?.name?.startsWith(TAG)).length
  await page.click('[data-testid="nlg-save"]')
  await page.waitForFunction(() => !!document.querySelector('[data-testid="new-lead-result"]'))
  const message = await page.$eval('[data-testid="new-lead-result"]', (e) => e.textContent)

  const after = (await call('GET', '/contacts')).data
  const mine = after.filter((c) => c.payload?.name?.startsWith(TAG))
  const validA = mine.find((c) => c.payload.name === `${TAG} Valid A`)
  const validB = mine.find((c) => c.payload.name === `${TAG} Valid B`)
  check('both valid rows exist on the list', !!validA && !!validB,
    `Valid A: ${validA ? validA.id : 'ABSENT'}, Valid B: ${validB ? validB.id : 'ABSENT'}`)
  check('the two invalid rows did NOT create records',
    !mine.some((c) => c.payload.email === BAD_EMAIL || c.payload.mobile === BAD_MOBILE),
    `${TAG} records on the list: ${mine.length}, was ${before} before Save`)
  check('the message agrees with the membership', message.startsWith('2 lead'), `message: "${message}"`)

  const keptFlags = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="nlg-row-"]')]
    .map((r) => r.dataset.invalid))
  const keptEmail = await page.$eval('[data-testid="nlg-email-0"]', (e) => e.value)
  check('the invalid rows stay in the grid, still flagged',
    keptFlags.filter((f) => f === 'true').length === 2 && keptEmail === BAD_EMAIL,
    `flags after save: ${JSON.stringify(keptFlags)}, row 0 email still "${keptEmail}"`)
  await page.screenshot({ path: `${OUT}p5-grid-after-save.png` })

  // ── CLAIM 4: created leads land Unqualified, on the pipeline ───────────
  console.log('\nCLAIM 4  status and pipeline membership')
  check('both created leads carry status Unqualified',
    validA?.status === 'Unqualified' && validB?.status === 'Unqualified',
    `Valid A: ${validA?.status}, Valid B: ${validB?.status}`)

  // THE MODAL FRAME SURVIVED THE FORM'S RETIREMENT, and this is asserted
  // rather than worked around. The close X still routes through the dirty
  // guard: two invalid rows are unsaved work, so it offers the shared discard
  // dialogue instead of closing. The first run of this probe timed out here
  // and the reason was the guard doing its job.
  //
  // Verification 7's replacement clause: what was already there must still be
  // there, and a retirement that quietly dropped the unsaved-changes guard
  // would have read as a clean close.
  await page.click('#btn-close-new-contact')
  await page.waitForSelector('#discard-confirm-modal:not(.hidden)', { timeout: 10000 })
  check('the close X still routes through the unsaved-changes guard', true,
    'two invalid rows pending, so the shared discard dialogue opened instead of closing')
  await page.click('#discard-confirm-discard')
  await page.waitForFunction(() => document.getElementById('new-contact-form').classList.contains('hidden'))
  check('Discard then closes the modal', true, '#new-contact-form is hidden')
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((ids) => ids.every((id) =>
    !!document.querySelector(`[data-testid="lead-card-${id}"]`)),
    { timeout: 20000 }, [validA.id, validB.id])
  // MEMBERSHIP, not the heading. John ruled it this way and the first attempt
  // proved him right: walking up from the card to "the previous heading" found
  // the hidden modal instead. The list renders one <section> per pipeline
  // status, so the group a card is INSIDE is the answer, and a card in the
  // wrong group cannot read as right.
  const groups = await page.evaluate((ids) => ids.map((id) => {
    const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
    const section = card?.closest('section.lead-group')
    return section?.getAttribute('data-testid')?.replace('lead-group-', '') ?? null
  }), [validA.id, validB.id])
  check('both appear on the Leads pipeline INSIDE the Unqualified group',
    groups.length === 2 && groups.every((g) => g === 'Unqualified'),
    `the group each card sits in: ${JSON.stringify(groups)}`)
  // Verification 17: the group probe must be shown returning something other
  // than 'Unqualified', or "both are Unqualified" could be a reader that
  // always says so.
  const otherGroups = await page.evaluate(() =>
    [...document.querySelectorAll('section.lead-group')]
      .map((s) => s.getAttribute('data-testid').replace('lead-group-', '')))
  check('the group probe discriminates (the list renders more than one group)',
    otherGroups.length > 1 && otherGroups.includes('Nurture'),
    `groups on the page: ${JSON.stringify(otherGroups)}`)
  await page.screenshot({ path: `${OUT}p5-pipeline.png` })
} finally {
  // Enumerated from the DATABASE by tag, never from a list this run kept:
  // a retry or a killed run leaves records the list no longer names.
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`\n  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}

const fails = results.filter((r) => !r.pass)
writeFileSync(`${OUT}p5-results.json`, JSON.stringify(results, null, 2))
console.log(`\n  ${results.length - fails.length}/${results.length} checks pass`)
process.exit(fails.length ? 1 : 0)
