// ── ROUND 4 PHASE 3: THE REASON BOX SURVIVES A SAVE ─────────────────────
//
// Finding 1's assertion form. The mechanism, established by instrument in
// Phase 3 item 1a: `onSave` runs a refusal check, a freeze that SAVES the
// deal, a POST and a full refetch, and the card cleared the box only after
// all of it. The box stayed editable and the button stayed live for that
// whole chain, so a person starting their next reason had it wiped by a
// clear belonging to the save before it.
//
// TYPING IS DELIBERATELY SLOW. At `delay: 1` the probe types 52 characters
// in about 52ms and mostly misses the window; at `delay: 60` it types for
// about three seconds, which is what a person does and is the configuration
// the defect was measured in. The pre-fix rate under this configuration was
// 4 corrupted saves in 6 (box lengths 44, 38, 46, 46 against 52 typed), so
// a clean run of 18 saves has a chance of about (1/3)^18, near 4e-9, of
// happening by luck. Three runs of six is the basis for the count.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const RUNS = Number(process.env.RUNS ?? 3)
const SAVES = 6
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 200) })
const puppeteer = await loadPuppeteer('reason-survives')
let browser = null
const { oppId } = await freshOpportunity('R4REASON')
{
  const db = admin()
  const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (error) throw new Error('could not stage: ' + error.message)
}

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  // The init counter intercepts the ASSIGNMENT, so it needs no bundle change
  // and is installed before the document exists (Verification 45).
  await page.evaluateOnNewDocument(() => {
    window.__inits = 0
    let real = null
    Object.defineProperty(window, 'initOpportunityDealVersions', {
      configurable: true,
      get: () => real,
      set: (fn) => { real = (...a) => { window.__inits++; return fn(...a) } },
    })
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const r = document.getElementById('deal-version-root')
    return r?.querySelector('#deal-version-panel') && (r.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const retype = async (sel, text, delay) => {
    await page.click(sel)
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      el.setSelectionRange(0, el.value.length)
    }, sel)
    await page.keyboard.press('Backspace')
    await settle()
    await page.type(sel, text, { delay })
    await settle()
  }

  let clean = 0, total = 0
  for (let run = 1; run <= RUNS; run++) {
    for (let n = 1; n <= SAVES; n++) {
      total++
      // An expando React never touches. If the tree is rebuilt the node is
      // replaced and the stamp is gone, which is what "the tree was not
      // re-rendered" means in a form a probe can read.
      await page.evaluate((s) => {
        const el = document.querySelector('#deal-version-root #deal-version-reason')
        el.__stamp = s
      }, `${run}.${n}`)
      const initsBefore = await page.evaluate(() => window.__inits)

      // A BOUNDED value that differs every save: the deal must be genuinely
      // dirty, and a number that grows without limit is refused by the server.
      await retype('#deal-ssExisting', String(20 + total), 1)
      const ss = await page.evaluate(() => document.getElementById('deal-ssExisting')?.value)
      check(`run ${run} save ${n}: the deal is dirty, by a bounded amount`,
        ss === String(20 + total)
          && await page.evaluate(() => window.dealFormSeam?.hasUnsavedChanges?.() === true),
        `ssExisting = ${ss}`)

      const REASON = `run ${run} save ${n}: the rate card moved and margin held`
      await retype('#deal-version-reason', REASON, 60)

      const at = await page.evaluate(() => {
        const el = document.querySelector('#deal-version-root #deal-version-reason')
        return { len: el?.value.length ?? -1, stamp: el?.__stamp ?? null,
          disabled: el?.disabled ?? null, inits: window.__inits }
      })
      const ok = at.len === REASON.length
      if (ok) clean++
      check(`run ${run} save ${n}: the box holds every character typed`,
        ok, `${at.len} of ${REASON.length}`)
      check(`run ${run} save ${n}: THE TREE WAS NOT REBUILT while typing`,
        at.stamp === `${run}.${n}`, `stamp ${at.stamp}, inits ${initsBefore} -> ${at.inits}`)

      await page.evaluate(() => document.querySelector('#deal-version-root #btn-save-version')?.click())
      const inflight = await page.evaluate(() => {
        const b = document.querySelector('#deal-version-root #btn-save-version')
        return { btnDisabled: b?.disabled, label: b?.textContent }
      })
      check(`run ${run} save ${n}: the button is held during the save`,
        inflight.btnDisabled === true,
        `btn "${inflight.label}" disabled=${inflight.btnDisabled}`)

      // ── THE REPRODUCTION ───────────────────────────────────────────────
      //
      // The box must be EMPTY the instant the save is submitted: it belongs to
      // the next version now, and a person who starts typing must not be
      // typing on top of the reason that was just sent.
      const atSubmit = await page.evaluate(() =>
        document.querySelector('#deal-version-root #deal-version-reason')?.value ?? '<none>')
      check(`run ${run} save ${n}: THE BOX IS EMPTY THE MOMENT THE SAVE IS SUBMITTED`,
        atSubmit === '', `box held "${String(atSubmit).slice(0, 50)}" (${String(atSubmit).length} chars)`)

      // And this is the defect itself: type the NEXT reason while the save is
      // still running. Before the fix the trailing clear wiped exactly this.
      const NEXT = `the next reason, typed during save ${n}`
      await page.type('#deal-version-reason', NEXT, { delay: 25 })

      // Now let the chain finish, and see what survived it.
      await page.waitForFunction(() => {
        const b = document.querySelector('#deal-version-root #btn-save-version')
        return b && b.disabled === false
      }, { timeout: 30000 }).catch(() => {})
      await settle()
      const survived = await page.evaluate(() =>
        document.querySelector('#deal-version-root #deal-version-reason')?.value ?? '<none>')
      check(`run ${run} save ${n}: TEXT TYPED DURING THE SAVE SURVIVES IT`,
        survived === NEXT,
        `kept "${String(survived).slice(0, 60)}" (${String(survived).length} of ${NEXT.length})`)
      // Put the box back for the next cycle's own typing.
      await page.evaluate(() => {
        const el = document.querySelector('#deal-version-root #deal-version-reason')
        el.setSelectionRange(0, el.value.length)
      })
      await page.keyboard.press('Backspace')
      await settle()

      const after = await page.evaluate(() => {
        const p = document.querySelector('#deal-version-root #deal-version-feedback')
        const t = document.querySelector('#deal-version-root #deal-version-reason')
        return { text: p?.textContent ?? '', cls: p?.className ?? '', box: t?.value ?? '' }
      })
      check(`run ${run} save ${n}: the save succeeded`,
        after.cls.includes('msg-success'), `${after.cls}: ${after.text.slice(0, 90)}`)
      // THE REFUSAL-WITH-TEXT-ON-SCREEN CASE, ASSERTED IMPOSSIBLE.
      check(`run ${run} save ${n}: NO refusal while the box still holds text`,
        !(/A reason is required/.test(after.text) && after.box.length > 0),
        `box ${after.box.length}, said "${after.text.slice(0, 60)}"`)
    }
  }
  check(`EVERY SAVE KEPT EVERY CHARACTER (${clean}/${total})`, clean === total, `${clean}/${total}`)
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'THREW: ' + String(err.message).slice(0, 140), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0,
    d: q.error ? q.error.message : String(q.data.length) })
}
const failed = R.filter((r) => !r.p)
console.log(`\nREASON SURVIVES: ${R.length - failed.length}/${R.length}`)
for (const r of failed) console.log(`  FAIL ${r.n}  | ${r.d}`)
if (!failed.length) console.log('  all checks passed')
process.exit(failed.length ? 1 : 0)
