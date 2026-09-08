// RULING 15: one live walk. A Test Bed converted through the BROWSER, as the
// signed-in user, and a second conversion refused where a person would see it.
//
// ─────────────────────────────────────────────────────────────
// WHY A WALK AT ALL, WHEN THE HTTP PROBES ARE GREEN
// ─────────────────────────────────────────────────────────────
//
// Every proof in this round stopped at the route. A walk is this project's
// stopping condition because the defects that reached a person were, almost
// without exception, invisible to the suite: a superseded function overwriting
// a React registration, a door reading a class nobody wrote any more, a
// ReferenceError thrown while building a 201. None of those is reachable from a
// probe that speaks HTTP.
//
// ─────────────────────────────────────────────────────────────
// BUILD DISCIPLINE 9's PROBE CLAUSE, APPLIED BEFORE ANYTHING ELSE
// ─────────────────────────────────────────────────────────────
//
// The server must have been restarted after the last change to src/, or this
// walk measures the code that was replaced. Checked below rather than assumed,
// because that check is the rule this round just wrote.
//
// Verification 42: the page is loaded fresh with cache disabled, so a stale
// bundle cannot report a defect that is already fixed - or hide one that is not.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'
import { execSync } from 'child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `walk-${process.argv[2] ?? 'r15'}`
const SHOT = `${ROOT}.verify/walk-convert-${process.argv[2] ?? 'r15'}.png`
const R = []
const check = (n, pass, detail = '') => {
  R.push({ n, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${detail ? '  -> ' + detail : ''}`)
}

// ── STEP 0, before the browser: is the server serving this tree? ──────────
{
  const pid = execSync("ps ax -o pid=,command= | grep '[s]rc/server.js' | awk '{print $1}'")
    .toString().trim().split('\n')[0]
  const started = execSync(`ps -o lstart= -p ${pid}`).toString().trim()
  const startedAt = new Date(started).getTime()
  const newest = readdirSync(ROOT + 'src/routes')
    .map((f) => statSync(ROOT + 'src/routes/' + f).mtimeMs)
    .concat(statSync(ROOT + 'src/lib/write-errors.js').mtimeMs)
    .reduce((a, b) => Math.max(a, b), 0)
  console.log(`step 0  server pid ${pid} started ${started}`)
  console.log(`        newest src file mtime      ${new Date(newest).toString()}`)
  check('0. the server was started AFTER the last change to src/', startedAt > newest,
    startedAt > newest ? 'serving this tree' : 'STALE: it is serving replaced code')
  if (startedAt <= newest) { console.log('\nSTOP: restart the server before walking.'); process.exit(3) }
}

const puppeteer = await loadPuppeteer('walk-convert')
let browser
let bedId
try {
  // ── THE FIXTURE, made the way the system makes one ──────────────────────
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account Ltd`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  // accumulated_cost IS settable at creation (it is not settable by PATCH), so
  // the walk has a distinctive number to look for on the screen rather than the
  // zero a fresh bed carries.
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} Test Bed`, account_id: account.id,
    industry_id: industry.id, country_code: 'SG',
    client_organisation: `${TAG} Client Organisation`,
    accumulated_cost: 12345.67,
  })
  bedId = bed.id
  const OPP_NAME = `${TAG} Converted Deal`
  console.log(`\nfixture  account "${account.name}"`)
  console.log(`         bed ${bed.id}  ref ${bed.reference_code}  cost 12345.67`)

  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 140)))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setCacheEnabled(false)
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
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 })
    await settle()
  }
  const T = (sel) => `[data-testid="${sel}"]`

  // ── STEP 1: open the Test Bed ───────────────────────────────────────────
  await go('test-bed-detail', bedId, T('testbed-host'))
  check('1. the Test Bed view renders', await page.$(T('testbed-host')) !== null)
  check('2. the convert trigger is on the screen', await page.$(T('tb-convert-trigger')) !== null)

  // ── STEP 2: convert, through the UI ─────────────────────────────────────
  //
  // Verification 6's write clause: a controlled input is NOT written by writing
  // its DOM value. React's per-input value tracker dedupes a synthetic set, so
  // the box would read as filled while the component's state stayed empty and
  // the save would correctly refuse. Real keyboard events.
  await page.click(T('tb-convert-trigger'))
  await page.waitForSelector(T('tb-opp-name'), { timeout: 10000 })
  await page.focus(T('tb-opp-name'))
  await page.keyboard.type(OPP_NAME)
  const typed = await page.$eval(T('tb-opp-name'), (el) => el.value)
  check('3. the name box holds what was typed', typed === OPP_NAME, typed)

  await page.click(T('tb-convert-submit'))
  // The counterfactual, stated: the feedback element exists for BOTH outcomes,
  // so waiting on its presence would be satisfied by a refusal. Wait on the
  // success class, which only a success can produce.
  await page.waitForSelector(`${T('tb-convert-feedback')}.msg-success`, { timeout: 30000 })
  const fb1 = await page.$eval(T('tb-convert-feedback'), (el) => el.innerText.trim())
  check('4. the conversion succeeds and says so on the screen', true, JSON.stringify(fb1))

  // ── STEP 3: open the Opportunity and read what a person would read ──────
  check('5. the screen OFFERS the new Opportunity rather than jumping to it',
    await page.$(T('tb-convert-view')) !== null)
  await page.click(T('tb-convert-view'))
  // Wait on RENDERED TEXT, not on a container: the reference code is unique to
  // this fixture, so it cannot be satisfied by the previous view.
  await page.waitForFunction((code) => document.body.innerText.includes(code),
    { timeout: 30000 }, bed.reference_code)
  await settle()

  const seen = await page.evaluate(() => document.body.innerText)
  const WANT = [
    ['the Opportunity name', OPP_NAME],
    ['the company, carried from client_organisation', `${TAG} Client Organisation`],
    ['the Account, carried from the bed', `${TAG} Account Ltd`],
    ['the reference code, carried unchanged', bed.reference_code],
  ]
  for (const [what, needle] of WANT) {
    check(`6. ${what} is on the screen`, seen.includes(needle), JSON.stringify(needle))
  }
  // The cost is a currency figure, so it may be formatted. Accept the grouped
  // or ungrouped rendering; reject its absence.
  const costOnScreen = /12,345\.67|12345\.67/.test(seen)
  check('7. the Test Bed cost is on the screen', costOnScreen,
    costOnScreen ? 'found 12,345.67' : 'NOT FOUND in the rendered text')

  await page.screenshot({ path: SHOT, fullPage: false })
  console.log(`  screenshot: ${SHOT}`)

  // ── STEP 4: the second conversion, refused where a person sees it ───────
  await go('test-bed-detail', bedId, T('testbed-host'))
  await page.click(T('tb-convert-trigger'))
  await page.waitForSelector(T('tb-opp-name'), { timeout: 10000 })
  await page.focus(T('tb-opp-name'))
  await page.keyboard.type(`${TAG} Second Attempt`)
  await page.click(T('tb-convert-submit'))
  await page.waitForSelector(`${T('tb-convert-feedback')}.msg-error`, { timeout: 30000 })
  const fb2 = await page.$eval(T('tb-convert-feedback'), (el) => el.innerText.trim())
  check('8. the second conversion is REFUSED, in words, on the screen',
    fb2.length > 0, JSON.stringify(fb2))
  check('9. and the refusal is the conversion message, not a server error',
    /already been converted/i.test(fb2), JSON.stringify(fb2))
  const rows = (await admin().from('opportunity_details').select('record_id')
    .eq('converted_from_test_bed_id', bedId)).data ?? []
  check('10. and the refusal wrote nothing: still exactly one conversion',
    rows.length === 1, `${rows.length} conversion row(s)`)

  check('11. no page errors and no 5xx across the whole walk', errs.length === 0,
    errs.join(' | ') || 'none')
} catch (e) {
  check('99. the walk ran to completion', false, e.message)
} finally {
  if (browser) await browser.close()
  await tearDown()
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', S.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
  check('12. teardown leaves nothing live', (left?.length ?? -1) === 0, `${left?.length}`)
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
process.exit(pass === R.length ? 0 : 1)
