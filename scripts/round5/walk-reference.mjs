// ── ROUND 5 PHASE 2 ITEMS 2 AND 3: THE WRITE PATH AND THE DOOR, LIVE ────
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 190) })
const puppeteer = await loadPuppeteer('walk-reference')
let browser = null
const { oppId } = await freshOpportunity('R5WALK')

const EDITABLE = ['name', 'lead', 'commercial', 'technical', 'legal', 'region', 'country',
  'customerLead', 'commAddress', 'commAddress2', 'commCity', 'commPostcode', 'commCountry',
  'commRegion', 'estClose', 'actualClose', 'estGoLive', 'actualGoLive', 'duration',
  'oppType', 'summary']
const SAA = 'commAddressSameAsAccount'

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
  await page.waitForFunction(() => typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  // Phase 0's lesson: the rows render BEFORE the view is interactive, and
  // #view-opportunity-detail carries is-loading until detailLoaded clears it.
  // A wait on rendered rows alone is satisfied by the pre-interactive state.
  const open = async (id, { fresh = false } = {}) => {
    if (fresh) {
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForFunction(() =>
        typeof window.initOpportunityReferencePanel === 'function', { timeout: 25000 })
    }
    await page.evaluate((x) => navigate('opportunity-detail', x), id)
    await page.waitForFunction(() => {
      const root = document.getElementById('ref-root')
      const v = document.getElementById('view-opportunity-detail')
      return root?.querySelector('[data-field]') && v && !v.classList.contains('is-loading')
    }, { timeout: 30000 })
    await page.evaluate(() => document.querySelector('[data-opp-tab="reference"]')?.click())
    await settle()
  }
  const scrollTo = async (sel) => {
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel)
    await settle()
  }
  const clickRow = async (n) => {
    const sel = `#ref-root [data-testid="display-${n}"]`
    await scrollTo(sel)
    try {
      await page.click(sel)
    } catch (e) {
      const why = await page.evaluate((s2) => {
        const d = document.querySelector(s2)
        if (!d) return 'NO ELEMENT'
        const r = d.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return `w=${Math.round(r.width)} h=${Math.round(r.height)} top=${Math.round(r.top)} `
          + `pe=${getComputedStyle(d).pointerEvents} hit=${hit?.tagName}.${(hit?.className || '').slice(0, 30)} `
          + `self=${hit === d}`
      }, sel)
      return { clicked: false, why: `${String(e.message).slice(0, 40)} :: ${why}` }
    }
    await settle()
    return { clicked: true, why: null }
  }
  // A READ-ONLY ROW HAS NO EDIT HALF AT ALL, so `!el?.hasAttribute()` yields
  // !undefined = TRUE and reports the row OPEN. Verification 14: a check
  // reached with nothing on either side is not a check. Presence, then state.
  const isOpen = (n) => page.evaluate((x) => {
    const el = document.querySelector(`#ref-root [data-testid="edit-${x}"]`)
    return !!el && !el.hasAttribute('hidden')
  }, n)
  const typeInto = async (n, text) => {
    const sel = `#ref-root [data-testid="input-${n}"]`
    await scrollTo(sel)
    await page.click(sel)
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (el.setSelectionRange) el.setSelectionRange(0, el.value.length)
    }, sel)
    await page.keyboard.press('Backspace')
    await page.keyboard.type(text, { delay: 8 })
    await settle()
    const got = await page.evaluate((s2) => document.querySelector(s2)?.value ?? null, sel)
    if (got !== text) {
      check(`the keystrokes reached #input-${n}, or nothing below means anything`,
        false, `typed "${text}", input holds "${got}"`)
    }
  }
  const setSelect = async (n, value) => {
    await page.evaluate(([x, v]) => {
      const el = document.querySelector(`#ref-root [data-testid="input-${x}"]`)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, [n, value])
    await settle()
  }
  const rec = async () => (await api('GET', `/opportunities/${oppId}`)).data
  const bar = () => page.evaluate(() => ({
    hidden: document.querySelector('#ref-root [data-testid="edit-bar"]')?.hasAttribute('hidden'),
    count: document.querySelector('#ref-root [data-testid="dirty-count"]')?.textContent ?? null,
  }))

  await open(oppId)

  // ── THE SWAP ITSELF ───────────────────────────────────────────────────
  check('THE REACT REFERENCE PANEL IS MOUNTED, and the vanilla is hidden',
    await page.evaluate(() => !!document.querySelector('#ref-root [data-testid="reference-panel"]')
      && !!document.getElementById('ref-vanilla')?.classList.contains('hidden')))
  check('all 21 editable rows rendered',
    await page.evaluate(() => document.querySelectorAll('#ref-root [data-dirty]').length) === 21,
    await page.evaluate(() => document.querySelectorAll('#ref-root [data-dirty]').length))
  check('and the 5 read-only rows carry NO tab stop on the live server',
    await page.evaluate(() => {
      const ro = [...document.querySelectorAll('#ref-root [data-readonly="true"] .field-row-display')]
      return ro.length === 5 && ro.every((e) => e.getAttribute('tabindex') === null)
    }))

  // ── ITEM 2: EVERY EDITOR KIND ─────────────────────────────────────────
  await clickRow('country'); check('TEXT opens', await isOpen('country'))
  await typeInto('country', 'Malaysia')
  await clickRow('lead'); check('SELECT opens', await isOpen('lead'))
  const staffOpts = await page.evaluate(() =>
    [...document.querySelectorAll('#ref-root [data-testid="input-lead"] option')].map((o) => o.value))
  check('and the staff picker fetched its own options', staffOpts.length > 1, staffOpts.slice(0, 3).join(','))
  await setSelect('lead', staffOpts[1])
  await clickRow('estClose'); check('DATE opens', await isOpen('estClose'))
  const mins = await page.evaluate(() => ({
    estClose: document.querySelector('#ref-root [data-testid="input-estClose"]')?.getAttribute('min'),
  }))
  check('estClose carries its min on the live server', /^\d{4}-\d{2}-\d{2}$/.test(mins.estClose ?? ''), mins.estClose)
  await clickRow('estGoLive')
  const goLiveMin = await page.evaluate(() =>
    document.querySelector('#ref-root [data-testid="input-estGoLive"]')?.getAttribute('min'))
  check('AND SO DOES estGoLive, which the vanilla does not (Phase 0 finding 1)',
    /^\d{4}-\d{2}-\d{2}$/.test(goLiveMin ?? ''), goLiveMin)
  await clickRow('actualClose')
  check('while an actual date carries none', await page.evaluate(() =>
    document.querySelector('#ref-root [data-testid="input-actualClose"]')?.getAttribute('min')) === null)
  await clickRow('summary'); check('TEXTAREA opens', await isOpen('summary'))
  await typeInto('summary', 'the exec summary, typed live')
  await clickRow('duration'); await typeInto('duration', '48')

  const b = await bar()
  check('THE BAR COUNTS ACROSS ROWS, which the vanilla does not',
    b.hidden === false && /\d/.test(b.count ?? ''), JSON.stringify(b))

  // ── THE BATCHED SAVE: ONLY-DIRTY KEYS ─────────────────────────────────
  const before = await rec()
  await scrollTo('#ref-root [data-testid="save-all"]')
  await page.click('#ref-root [data-testid="save-all"]')
  for (let i = 0; i < 40; i++) {
    if (String((await rec()).payload.country ?? '') === 'Malaysia') break
    await new Promise((r) => setTimeout(r, 500))
  }
  const after = await rec()
  check('THE SAVE ROUND-TRIPPED: country reached the record', String(after.payload.country) === 'Malaysia',
    after.payload.country)
  check('and duration was sent as a NUMBER, not a string',
    after.payload.duration === 48, JSON.stringify(after.payload.duration))
  check('and the summary reached it', String(after.payload.summary).includes('typed live'))
  check('ONLY DIRTY KEYS MOVED: an untouched key is unchanged',
    String(after.payload.commCity ?? '') === String(before.payload.commCity ?? ''))
  check('the display shows the suffix after the save', await page.evaluate(() =>
    document.querySelector('#ref-root [data-testid="display-duration"]')?.textContent) === '48 months',
    await page.evaluate(() => document.querySelector('#ref-root [data-testid="display-duration"]')?.textContent))

  // ── THE 409 PATH ──────────────────────────────────────────────────────
  await clickRow('customerLead'); await typeInto('customerLead', 'a stale write')
  // A CONCURRENT WRITE FROM ELSEWHERE, which is what the 409 is about. Only
  // one allowed key: echoing the whole payload back sends fields this endpoint
  // refuses, and a 400 there would have been the probe failing rather than the
  // stale-write path firing.
  const bump = await api('PATCH', `/opportunities/${oppId}`, { payload: { region: 'APAC' } })
  check('the concurrent write landed, or the 409 below tests nothing', bump.ok, String(bump.status))
  await scrollTo('#ref-root [data-testid="save-all"]')
  await page.click('#ref-root [data-testid="save-all"]')
  await new Promise((r) => setTimeout(r, 2500))
  const fb = await page.evaluate(() =>
    document.querySelector('[data-testid="ref-save-feedback"]')?.textContent ?? '')
  const afterStale = await rec()
  // oppPatch owns the precondition AND the retry (app.js:7897-7918): on a 409
  // it refetches the revision and retries, returning the retry's answer. So the
  // surface inherits absorption rather than refusal, and the thing to assert is
  // that BOTH writes survived - the concurrent one and the person's.
  check('THE STALE-WRITE PATH IS ABSORBED BY oppPatch, and the edit still lands',
    /Saved/.test(fb) && String(afterStale.payload.customerLead) === 'a stale write',
    `"${fb.slice(0, 40)}" customerLead=${afterStale.payload.customerLead}`)
  check('and the concurrent write was NOT lost by the retry',
    String(afterStale.payload.region) === 'APAC', String(afterStale.payload.region))

  // ── SAME-AS-ACCOUNT, BOTH DIRECTIONS ──────────────────────────────────
  await open(oppId, { fresh: true })
  const roBefore = await page.evaluate(() =>
    document.querySelectorAll('#ref-root [data-readonly="true"]').length)
  await scrollTo(`#ref-root [data-testid="input-${SAA}"]`)
  await page.click(`#ref-root [data-testid="input-${SAA}"]`)
  await settle()
  const roOn = await page.evaluate(() =>
    document.querySelectorAll('#ref-root [data-readonly="true"]').length)
  check('FLIP ON: the six address rows go read-only', roOn === roBefore + 6, `${roBefore} -> ${roOn}`)
  await page.click(`#ref-root [data-testid="input-${SAA}"]`)
  await settle()
  const roOff = await page.evaluate(() =>
    document.querySelectorAll('#ref-root [data-readonly="true"]').length)
  check('FLIP OFF: they are editable again', roOff === roBefore, `${roOn} -> ${roOff}`)
  const dirtyNow = await page.evaluate(() => [...document.querySelectorAll('#ref-root [data-dirty="true"]')]
    .map((e) => e.getAttribute('data-field')))
  check('and flipping back to the original left NO draft (dirty by comparison)',
    (await bar()).hidden === true,
    `${JSON.stringify(await bar())} dirty rows: ${dirtyNow.join(',') || 'none'}`)
  // Round-trip the payload semantics: a stored FLAG, never copied values.
  await page.click(`#ref-root [data-testid="input-${SAA}"]`)
  await settle()
  await scrollTo('#ref-root [data-testid="save-all"]')
  await page.click('#ref-root [data-testid="save-all"]')
  for (let i = 0; i < 40; i++) {
    if ((await rec()).payload[SAA] === true) break
    await new Promise((r) => setTimeout(r, 500))
  }
  const saved = await rec()
  check('PAYLOAD SEMANTICS: a boolean FLAG is stored', saved.payload[SAA] === true,
    JSON.stringify(saved.payload[SAA]))
  check('and NO account address was copied into the payload',
    saved.payload.commAddress === before.payload.commAddress,
    `${JSON.stringify(saved.payload.commAddress)} vs ${JSON.stringify(before.payload.commAddress)}`)

  // ── KEY CONTACTS: IMMEDIATE ───────────────────────────────────────────
  await open(oppId, { fresh: true })
  const kcPresent = await page.evaluate(() => !!document.querySelector('#ref-root [data-testid="key-contacts"]'))
  check('the key-contacts sub-panel rendered', kcPresent)
  check('and it contains no field rows', await page.evaluate(() =>
    document.querySelectorAll('#ref-root [data-testid="key-contacts"] [data-dirty]').length) === 0)

  // THE IDEMPOTENCE, ASSERTED. Re-entering the same record must not rebuild
  // the tree, which is what keeps a half-typed row from vanishing.
  await clickRow('country')
  await page.evaluate((x) => navigate('opportunity-detail', x), oppId)
  await settle()
  check('RE-ENTERING THE SAME RECORD KEEPS AN OPEN ROW OPEN, rather than rebuilding it',
    await isOpen('country'))

  // ── ITEM 3: THE DOOR ON REAL OWNERSHIP ────────────────────────────────
  const db = admin()
  // A REAL auth.users id, not a fabricated one: owner_id carries a foreign key,
  // so an invented uuid is refused by the database rather than producing a
  // not-owned record. Read from the estate rather than hardcoded.
  const meNow = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const others = await db.from('records').select('owner_id')
    .not('owner_id', 'is', null).neq('owner_id', meNow).limit(1)
  const OTHER = others.data?.[0]?.owner_id
  check('a real second owner exists to hand the record to', !!OTHER, String(OTHER))
  const { error: reown } = await db.from('records').update({ owner_id: OTHER }).eq('id', oppId)
  check('the not-owned fixture was created by admin write', !reown, reown?.message ?? 'ok')
  await open(oppId, { fresh: true })
  check('the view carries is-not-mine on a record the user does not own',
    await page.evaluate(() =>
      document.getElementById('view-opportunity-detail')?.classList.contains('is-not-mine')) === true)

  let refusedClick = 0, refusedKey = 0
  const unclickable = []
  for (const n of EDITABLE) {
    const c = await clickRow(n)
    if (!c.clicked) unclickable.push(`${n}: ${c.why}`)
    if (!(await isOpen(n))) refusedClick++
    for (const k of ['Enter', ' ', 'a']) {
      await page.evaluate(([x, key]) => {
        document.querySelector(`#ref-root [data-testid="display-${x}"]`)
          ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      }, [n, k])
    }
    await settle()
    if (!(await isOpen(n))) refusedKey++
  }
  check('NOT MINE: every one of the 21 rows refuses a CLICK', refusedClick === 21, `${refusedClick}/21`)
  check('and every row was actually REACHABLE to be refused, not merely absent',
    unclickable.length === 0, unclickable.slice(0, 2).join(' | ') || 'all reachable')
  check('NOT MINE: and refuses Enter, Space and a seed character', refusedKey === 21, `${refusedKey}/21`)
  check('NOT MINE: the same-as-account direct input is refused too (D4)',
    await page.evaluate((s) =>
      document.querySelector(`#ref-root [data-testid="input-${s}"]`)?.disabled === true, SAA))
  check('NOT MINE: the read-only rows still carry no tab stop',
    await page.evaluate(() =>
      [...document.querySelectorAll('#ref-root [data-readonly="true"] .field-row-display')]
        .every((e) => e.getAttribute('tabindex') === null)))

  // ── AND BACK: THE OWNED RECORD OPENS EVERYTHING ───────────────────────
  const me = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  await db.from('records').update({ owner_id: me }).eq('id', oppId)
  await open(oppId, { fresh: true })
  // THE FLAG IS STILL SAVED TRUE from the payload-semantics phase, so six rows
  // are legitimately read-only and correctly have no door. Untick it first, or
  // this counts a correct refusal as a failure to open.
  const roNow = await page.evaluate(() =>
    document.querySelectorAll('#ref-root [data-readonly="true"]').length)
  if (roNow > 5) {
    await scrollTo(`#ref-root [data-testid="input-${SAA}"]`)
    await page.click(`#ref-root [data-testid="input-${SAA}"]`)
    await settle()
  }
  check('the six address rows are editable again before the owned pass',
    await page.evaluate(() =>
      document.querySelectorAll('#ref-root [data-readonly="true"]').length) === 5,
    String(await page.evaluate(() =>
      document.querySelectorAll('#ref-root [data-readonly="true"]').length)))

  let opened = 0
  const unclickable2 = []
  for (const n of EDITABLE) {
    const c = await clickRow(n)
    if (!c.clicked) unclickable2.push(`${n}: ${c.why}`)
    if (await isOpen(n)) opened++
  }
  check('MINE AGAIN: every one of the 21 rows opens', opened === 21,
    `${opened}/21${unclickable2.length ? ' unclickable: ' + unclickable2.join(' | ') : ''}`)

  check('no page errors or 5xx across the walk', errs.length === 0, errs.slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'WALK THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records owned by the test account',
    p: !q.error && q.data.length === 0, d: String(q.data?.length ?? '?') })
}
const failed = R.filter((r) => !r.p)
console.log(`\nREFERENCE WALK: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
process.exit(failed.length ? 1 : 0)
