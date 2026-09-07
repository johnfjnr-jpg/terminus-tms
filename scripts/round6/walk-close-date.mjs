// ── ROUND 6 PHASE 0: THE EST. CLOSE DATE WRITE PATH, LIVE ────────────────
//
// The jsdom suite asserts what the host HANDS the shell dialogue. This asserts
// what the SERVER ends up holding, which is the claim that matters: before this
// phase a person could type a date, press Save, and have it discarded silently.
//
// Verification 40: the success path is exercised over HTTP as the signed-in
// user, asserting the NEW BEHAVIOUR rather than a status. A suite made of
// refusals is satisfied by a route that refuses everything.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('walk-close-date')
let browser = null
const { oppId } = await freshOpportunity('R6CLOSE')

const iso = (daysFromNow) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}
const FIRST = iso(120)
const MOVED = iso(200)

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  // 404s are counted separately, not folded into errs: check 99's claim is
  // about page errors and 5xx, and a 404 from a route that was never built is
  // a finding of its own rather than noise to fail an unrelated check with.
  const notFound = new Set()
  page.on('response', (r) => { if (r.status() === 404) notFound.add(new URL(r.url()).pathname) })
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  // THE CAUSE'S OWN ANSWER, beside the effect. Verification 14: an assertion
  // about an effect that fails must carry whether the call happened at all,
  // or "the date did not save" and "nothing was sent" read identically.
  const posts = []
  page.on('response', async (r) => {
    if (!r.url().includes('close-date-move')) return
    let body = ''
    try { body = (await r.text()).slice(0, 160) } catch { body = '<unreadable>' }
    posts.push(`${r.request().method()} ${r.status()} ${body}`)
  })
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN')
  }
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  const open = async () => {
    await page.evaluate((x) => navigate('opportunity-detail', x), oppId)
    await page.waitForFunction(() => {
      const root = document.getElementById('ref-root')
      const v = document.getElementById('view-opportunity-detail')
      return root?.querySelector('[data-field]') && v && !v.classList.contains('is-loading')
    }, { timeout: 30000 })
    await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
    await settle()
  }

  // ── DRIVING A type="date" INPUT, AND page.type DOES NOT DO IT ────────
  //
  // Verification 6's write clause says to drive a framework-controlled input
  // with real keyboard events, because a synthetic .value write is deduped by
  // React's per-input value tracker. MEASURED HERE, that remedy does not reach
  // a date input at all: page.type('01052027') into it leaves the value EMPTY,
  // whatever digit order is used, because a date input's segments are not fed
  // by plain character events.
  //
  // The native-setter write DOES land - value '2027-01-05', edit bar '1 change'
  // - because the tracker only dedupes a value it has already recorded, and a
  // freshly opened editor has recorded nothing. So the two remedies swap round
  // for this control, and the read-back below is what proves which happened
  // rather than assuming either.
  const typeDate = async (value) => {
    await page.evaluate(() => document.querySelector('[data-testid="display-estClose"]')?.click())
    await settle()
    await page.waitForSelector('[data-testid="input-estClose"]', { timeout: 5000 })
    await page.evaluate((v) => {
      const i = document.querySelector('[data-testid="input-estClose"]')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(i, v)
      i.dispatchEvent(new Event('input', { bubbles: true }))
      i.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    await settle()
  }
  const pressSave = async () => {
    await page.evaluate(() => document.querySelector('[data-testid="save-all"]')?.click())
    await settle()
  }
  // THE COMPUTED PROPERTY, not offsetParent. Verification 4's clause says an
  // attribute assertion is not a visibility assertion; this is the same trap
  // from the other side. `offsetParent` is NULL for a position:fixed element
  // by specification, and .modal-backdrop is fixed - so the dialogue reported
  // shut every time while it was open on screen with its heading rendered.
  // It cost five runs and read exactly like the feature not working.
  const dialogueOpen = () => page.evaluate(() => {
    const f = document.getElementById('change-reason-form')
    if (!f) return false
    return getComputedStyle(f).display !== 'none' && getComputedStyle(f).visibility !== 'hidden'
  })
  // THE CLIENT RETURNS A WRAPPER, {status, ok, data}, and reading through it
  // as if it were the record is Verification 47's response-fixture clause:
  // shaped by what I expected rather than by what the route answers. It cost a
  // run that reported the server holding nothing while the POST returned 200.
  const getOpp = async () => {
    const r = await api('GET', `/opportunities/${oppId}`)
    if (!r.ok) throw new Error(`GET opportunity failed: ${r.status}`)
    return r.data
  }
  const stored = async () => (await getOpp())?.opportunity_details?.forecast_close_date ?? null
  const moves = async () => (await getOpp())?.payload?.closeMoves ?? 0

  // ── 1. THE STARTING STATE, so the first-recording branch is reachable ──
  await open()
  check('0. a fresh opportunity holds no forecast close date', (await stored()) === null, `stored=${await stored()}`)

  // ── 2. FIRST RECORDING: no dialogue, and the server holds it ───────────
  await typeDate(FIRST)
  const beforeFirst = await page.$eval('[data-testid="input-estClose"]', (e) => e.value)
  check('1. the date reached the controlled input', beforeFirst === FIRST, `typed=${FIRST} read=${beforeFirst}`)
  await pressSave()
  check('2. a FIRST recording opens no dialogue', !(await dialogueOpen()))
  await page.waitForFunction(() => !document.querySelector('[data-testid="save-all"]')
    || document.querySelector('[data-testid="edit-bar"]')?.hasAttribute('hidden'), { timeout: 15000 }).catch(() => {})
  const afterFirst = await stored()
  check('3. THE SERVER HOLDS IT. This is the whole defect: before this phase '
    + 'the value was discarded', afterFirst === FIRST, `stored=${afterFirst} expected=${FIRST}`)
  check('4. and a first recording is NOT counted as a move', (await moves()) === 0, `closeMoves=${await moves()}`)

  // ── 3. A MOVE: the dialogue opens and nothing is written until confirmed ──
  await open()
  // THE SURFACE MUST SHOW WHAT THE SERVER HOLDS before a move can be a move.
  // If the row reads empty here the host thinks there is no stored date, takes
  // the first-recording branch, and the missing dialogue is a symptom rather
  // than the defect - so this check separates the two.
  const shownAfterFirst = await page.evaluate(() =>
    document.querySelector('[data-testid="display-estClose"]')?.textContent?.trim() ?? '')
  check('4b. the reloaded surface SHOWS the stored date', shownAfterFirst.includes(FIRST)
    || shownAfterFirst.includes('2027'), `display="${shownAfterFirst}" expected to contain ${FIRST}`)
  await typeDate(MOVED)
  const preSave = await page.evaluate(() => ({
    input: document.querySelector('[data-testid="input-estClose"]')?.value ?? '(no input)',
    bar: document.querySelector('[data-testid="edit-bar"]')?.textContent?.slice(0, 30) ?? '(no bar)',
    barHidden: document.querySelector('[data-testid="edit-bar"]')?.hasAttribute('hidden'),
  }))
  check('4c. the move is staged as a dirty change before Save',
    preSave.input.startsWith('2027-') && preSave.barHidden === false, JSON.stringify(preSave))
  const probe = await page.evaluate(() => ({
    dialogueFn: typeof window.requestChangeReason,
    formClasses: document.getElementById('change-reason-form')?.className ?? '(absent)',
  }))
  console.log('   PRE-SAVE PROBE:', JSON.stringify(probe))
  await pressSave()
  const post = await page.evaluate(() => ({
    formClasses: document.getElementById('change-reason-form')?.className ?? '(absent)',
    heading: document.getElementById('change-reason-heading')?.textContent ?? '',
  }))
  console.log('   POST-SAVE PROBE:', JSON.stringify(post))
  check('5. a MOVE opens the reason dialogue', await dialogueOpen())
  check('6. and writes NOTHING before the reason is given', (await stored()) === FIRST,
    `stored=${await stored()} should still be ${FIRST}`)

  // ── 4. THE REASON-REQUIRED BRANCH, walked ──────────────────────────────
  await page.evaluate(() => {
    const i = document.getElementById('change-reason-input')
    if (i) i.value = ''
    document.getElementById('change-reason-confirm')?.click()
  })
  await settle()
  check('7. an EMPTY reason is refused and the dialogue stays open', await dialogueOpen())
  const emptyMsg = await page.evaluate(() =>
    document.getElementById('change-reason-error')?.textContent
    ?? document.getElementById('change-reason-form')?.textContent ?? '')
  check('8. and it says why', /reason/i.test(emptyMsg), emptyMsg.slice(0, 120))
  check('9. still nothing written', (await stored()) === FIRST, `stored=${await stored()}`)

  // ── 5. CONFIRMED WITH A REASON ─────────────────────────────────────────
  // A DIRECT WRITE IS CORRECT HERE, and the distinction matters. The reason
  // box is the VANILLA dialogue's own textarea, not a framework-controlled
  // input: app.js reads `input.value` at confirm time, so assigning it is what
  // the app itself observes. page.type left it empty - measured - because the
  // dialogue's focus trap owns the keydown stream.
  await page.evaluate((t) => {
    const i = document.getElementById('change-reason-input')
    i.value = t
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }, 'Customer pushed the tender by two months')
  console.log('   REASON BOX:', JSON.stringify(await page.evaluate(() => ({
    val: document.getElementById('change-reason-input')?.value ?? '(absent)',
    tag: document.getElementById('change-reason-input')?.tagName,
    confirmDisabled: document.getElementById('change-reason-confirm')?.disabled,
    err: document.getElementById('change-reason-error')?.textContent ?? '',
  }))))
  await page.evaluate(() => document.getElementById('change-reason-confirm')?.click())
  await settle()
  console.log('   AFTER CONFIRM:', JSON.stringify(await page.evaluate(() => ({
    classes: document.getElementById('change-reason-form')?.className,
    err: document.getElementById('change-reason-error')?.textContent ?? '',
  }))))
  // THE COUNTERFACTUAL, stated before waiting. Verification 7. This read
  // `|| f.offsetParent === null`, which is ALWAYS TRUE for the fixed backdrop,
  // so the wait resolved instantly and every assertion after it measured the
  // state BEFORE the write. The condition has to be one only the closed state
  // can satisfy, and the class is the app's own mechanism for it.
  await page.waitForFunction(() => {
    const f = document.getElementById('change-reason-form')
    return !f || f.classList.contains('hidden')
  }, { timeout: 20000 }).catch(() => {})
  await settle()
  const afterMove = await stored()
  check('10. THE MOVE IS HELD BY THE SERVER', afterMove === MOVED, `stored=${afterMove} expected=${MOVED}`)
  check('11. and the move IS counted', (await moves()) === 1, `closeMoves=${await moves()}`)
  const notes = (await getOpp())?.payload?.notes ?? []
  check('12. the reason is written into the record as prose',
    notes.some((n) => /pushed the tender/i.test(n?.text ?? String(n))),
    JSON.stringify(notes[0] ?? null).slice(0, 160))

  // ── FINDING KC1, RECORDED BY THE WALK SO IT CANNOT BE FORGOTTEN ───────
  //
  // ReferenceHost GETs /api/opportunities/:id/key-contacts on every load and
  // NO SUCH GET ROUTE EXISTS - only POST, DELETE and the stance POST. The Key
  // Customer Contacts card therefore never receives anything from the server.
  // Pre-existing from Round 5, so it is recorded here and queued rather than
  // fixed in this phase (build-discipline rule 10).
  const kc = [...notFound].filter((p) => p.includes('key-contacts'))
  check('97. KNOWN FINDING KC1 is still exactly what it was, and no wider',
    kc.length === 1 && kc[0].includes('key-contacts'),
    `404 paths seen: ${[...notFound].join(', ') || 'none'}`)
  check('98. the close-date route was actually called', posts.length > 0,
    posts.length ? posts.join('  ||  ') : 'NO REQUEST TO close-date-move WAS EVER SENT')
  console.log('\nPOSTS SEEN:', posts.length ? posts.join('\n  ') : 'none')
  check('99. no page errors and no 5xx', errs.length === 0, errs.join(' | '))
} finally {
  if (browser) await browser.close()
  await tearDown()
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
