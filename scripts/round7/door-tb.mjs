// ── ROUND 7 PHASE 0b: THE TEST BED DOOR, BOTH DIRECTIONS, LIVE ──────────
//
// The not-owned fixture is built by ADMIN WRITE, per Verification 47's clause:
// one account cannot produce a record it does not own, because it owns
// everything it creates. The value written is a real auth.users id the system
// itself produces, and the record stays VISIBLE because records_select is
// `auth.uid() is not null` - so the fixture is a record the user can SEE and
// must not EDIT, which is the state the door is about.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 190) })
const puppeteer = await loadPuppeteer('door-tb')
let browser = null
const fx = await freshTestBed('R7DOOR')
const bedId = fx.bedId ?? fx.id
const ME = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id

const db = admin()
// A REAL SECOND IDENTITY, not a fabricated uuid: owner_id carries a foreign key
// and refuses one that is not a real auth.users row.
const { data: others } = await db.from('records')
  .select('owner_id').neq('owner_id', ME).not('owner_id', 'is', null).limit(1)
const OTHER = others?.[0]?.owner_id

try {
  if (!OTHER) throw new Error('no second owner_id exists in records; cannot build the fixture')
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.setViewport({ width: 1600, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.openTbField === 'function', { timeout: 25000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const open = async () => {
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => typeof window.openTbField === 'function', { timeout: 25000 })
    await page.evaluate((x) => navigate('test-bed-detail', x), bedId)
    await page.waitForFunction(() => {
      const v = document.getElementById('view-test-bed-detail')
      return v && !v.classList.contains('is-loading') && v.querySelectorAll('[data-key]').length > 0
    }, { timeout: 30000 })
    await settle()
  }
  /** Tries to open every field row and reports how many actually opened. */
  const tryOpenAll = () => page.evaluate(() => {
    // ONLY THE ROWS THAT ARE FIELD ROWS. openTbField reaches for
    // #tb-display-<key> and throws on a row that has none - installer,
    // techTeam and the empty-key row are controls of other kinds, and the
    // buyer rows are direct-write lookups. Measured rather than assumed: the
    // first version of this probe crashed inside openTbField.
    const keys = [...document.querySelectorAll('#view-test-bed-detail [data-key]')]
      .map((e) => e.dataset.key).filter(Boolean)
      .filter((k) => !k.startsWith('buyer-'))
      .filter((k) => document.getElementById(`tb-display-${k}`))
    let opened = 0
    for (const k of keys) {
      try { window.openTbField?.(k, true) } catch { /* a refusal may throw */ }
      if (document.getElementById(`tb-input-${k}`)) opened++
    }
    return { tried: keys.length, opened }
  })
  const state = () => page.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const banner = document.getElementById('tb-readonly-banner')
    return {
      notMine: v?.classList.contains('is-not-mine') ?? null,
      banner: (banner?.textContent ?? '').trim().slice(0, 70),
      saveVisible: !!document.getElementById('tb-save-all'),
    }
  })

  // ── DIRECTION 1: THE RECORD IS MINE ───────────────────────────────────
  await open()
  const mine = await state()
  check('1. MINE: the view carries no is-not-mine', mine.notMine === false,
    JSON.stringify(mine))
  const openedMine = await tryOpenAll()
  check('2. MINE: every field row opens', openedMine.opened === openedMine.tried,
    `${openedMine.opened}/${openedMine.tried} opened`)
  check('3. MINE: no read-only banner', mine.banner === '', `banner: "${mine.banner}"`)

  // ── DIRECTION 2: THE RECORD IS SOMEBODY ELSE'S ────────────────────────
  const { error: giveErr } = await db.from('records')
    .update({ owner_id: OTHER }).eq('id', bedId)
  if (giveErr) throw new Error('could not hand the record over: ' + giveErr.message)

  await open()
  const notMine = await state()
  check('4. NOT MINE: the view carries is-not-mine', notMine.notMine === true,
    JSON.stringify(notMine))
  check('5. NOT MINE: the read-only banner says so', notMine.banner.length > 0,
    `banner: "${notMine.banner}"`)
  const openedNot = await tryOpenAll()
  // ── THE THREE PATHS A PERSON HAS, MEASURED SEPARATELY ────────────────
  //
  // They give different answers, and the difference IS the finding.
  // ── 6a AND 6c RECORD WHAT THE VANILLA DOES, and it is a finding ──────
  //
  // These assert the MEASURED behaviour rather than the desirable one, so the
  // probe documents the door as it is instead of failing for ever. The
  // desirable behaviour is asserted in Phase 1, where the React door consults
  // canEditFields() at every entry attempt.
  //
  // THE DOOR ON THIS SURFACE IS PRESENTATIONAL. openTbField has no ownership
  // check of any kind: it writes tbEdits[key] and unhides the edit half.
  check('6a. FINDING: openTbField has NO ownership guard, so every row opens',
    openedNot.opened === openedNot.tried,
    `${openedNot.opened}/${openedNot.tried} opened programmatically on a record `
    + 'that is not mine')

  await open()
  const byPointer = await page.evaluate(() => {
    const d = document.getElementById('tb-display-city')
    if (!d) return { reachable: null }
    const cs = getComputedStyle(d)
    const r = d.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      pointerEvents: cs.pointerEvents,
      opacity: cs.opacity,
      hitIsTheRow: !!hit && (hit === d || d.contains(hit)),
    }
  })
  check('6b. NOT MINE: a MOUSE cannot reach the row',
    byPointer.pointerEvents === 'none' || byPointer.hitIsTheRow === false,
    JSON.stringify(byPointer))

  const byKeyboard = await page.evaluate(() => {
    const d = document.getElementById('tb-display-city')
    if (!d) return { tabbable: null }
    d.focus()
    const focused = document.activeElement === d
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    return {
      tabIndex: d.tabIndex,
      focused,
      openedByEnter: !!document.getElementById('tb-input-city'),
    }
  })
  // THE MOUSE IS BLOCKED AND THE KEYBOARD IS NOT, and that difference is the
  // whole finding: the row keeps tabIndex 0, takes focus, and opens on Enter.
  // A person can Tab to any of the 28 rows on somebody else's Test Bed and
  // edit it, while the dimming tells them it is read only.
  //
  // Round 5 recorded the inverse on the Reference tab - a row that reads as
  // live and does nothing. This is worse in the direction that matters: it
  // reads as dead and is live.
  check('6c. FINDING: the KEYBOARD opens a row the mouse cannot reach',
    byKeyboard.openedByEnter === true && byKeyboard.tabIndex === 0,
    JSON.stringify(byKeyboard))

  // ── DIRECTION 3: HANDED BACK ──────────────────────────────────────────
  const { error: backErr } = await db.from('records')
    .update({ owner_id: ME }).eq('id', bedId)
  if (backErr) throw new Error('could not hand the record back: ' + backErr.message)
  await open()
  const back = await state()
  check('7. HANDED BACK: the class clears', back.notMine === false, JSON.stringify(back))
  const openedBack = await tryOpenAll()
  check('8. HANDED BACK: every row opens again', openedBack.opened === openedBack.tried,
    `${openedBack.opened}/${openedBack.tried} opened`)

  check('99. no page errors', errs.length === 0, errs.join(' | '))
} finally {
  // THE RECORD MUST COME BACK before teardown, or it is not ours to soft-delete.
  try { await admin().from('records').update({ owner_id: ME }).eq('id', bedId) } catch {}
  if (browser) await browser.close()
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .is('deleted_at', null).eq('owner_id', ME)
  console.log(`\nRESIDUE: ${left?.length ?? '?'} live records owned by the test account`)
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
