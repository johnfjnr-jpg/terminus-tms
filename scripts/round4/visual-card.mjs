// ── ROUND 4 PHASE 2 ITEM 5: THE CARD AT THREE WIDTHS, EXERCISED ──────────
// The states are driven through the card's REAL data path: window.api is
// intercepted for the versions route only, so the component fetches, parses
// and renders exactly as it does live. Six of the ten version states are not
// walk-reachable (Phase 0: decide_transition_request refuses self-approval),
// and this is how they are seen at all.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.SHOTS
mkdirSync(OUT, { recursive: true })
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 420) })
const WIDTHS = [1240, 1920, 3440]
const REASON = "the hardware line was rebuilt on the March rate card, and the margin held at 32%"
const puppeteer = await loadPuppeteer('visual-card')
let browser = null
const { oppId } = await freshOpportunity('R4VIS')
{
  const db = admin()
  const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (error) throw new Error('could not stage: ' + error.message)
}

// ── THE STATES, each a distinct list the card must render ────────────────
const at = '2026-03-04T09:30:00.000Z'
const V = (o) => ({ id: o.id, major: o.major, minor: o.minor, status: o.status,
  reason: o.reason, sections: o.sections ?? ['Units Required', 'Payment Terms'],
  created_at: at, issued_at: o.status === 'issued' ? at : null,
  created_by_email: o.author ?? 'a.author@example.invalid',
  issued_by_email: o.author ?? 'b.issuer@example.invalid',
  revision_number: o.rev ?? 3, inputs: {}, approval: o.approval ?? undefined })
const approval = (state, extra = {}) => ({ state, decidedAt: at,
  revisionApproved: 3, decidedBy: 'p.approver@example.invalid', ...extra })

const STATES = {
  'empty': [],
  'draft-only': [V({ id: 'a', major: 0, minor: 1, status: 'draft', reason: 'the opening price, built on the March survey' })],
  'issued-and-draft': [
    V({ id: 'b', major: 1, minor: 1, status: 'draft', reason: 'rates moved, so the hardware line was rebuilt' }),
    V({ id: 'a', major: 1, minor: 0, status: 'issued', reason: 'the price we put in front of them on 4 March' })],
  'approved': [V({ id: 'a', major: 1, minor: 0, status: 'issued',
    reason: 'the price we put in front of them on 4 March', approval: approval('approved') })],
  'rejected': [V({ id: 'a', major: 1, minor: 0, status: 'issued',
    reason: 'the price we put in front of them on 4 March',
    approval: approval('rejected', { note: 'the margin is below the floor for this territory' }) })],
  'pending': [V({ id: 'a', major: 1, minor: 0, status: 'issued',
    reason: 'the price we put in front of them on 4 March', approval: approval('pending') })],
  'superseded': [V({ id: 'a', major: 1, minor: 0, status: 'issued',
    reason: 'the price we put in front of them on 4 March',
    approval: approval('superseded', { revisionApproved: 2 }) })],
  'long-list': Array.from({ length: 9 }, (_, i) => V({
    id: 'v' + i, major: i < 3 ? 1 : 0, minor: 9 - i,
    status: i === 0 ? 'draft' : 'issued',
    reason: `version ${9 - i}: a reason long enough to wrap on a narrow card and show how the row handles it` })),
}

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  // The interception is installed BEFORE the document, so the card's very
  // first fetch is served by it. Verification 45: a sampler attached after
  // load starts at the second state.
  await page.evaluateOnNewDocument((states) => {
    window.__STATES = states
    window.__pick = 'draft-only'
    const install = () => {
      if (typeof window.api !== 'function') return false
      const real = window.api
      window.api = (m, p, b) => (String(p).includes('deal-sheet-versions') && m === 'GET')
        ? Promise.resolve({ status: 200, ok: true, data: window.__STATES[window.__pick] })
        : real(m, p, b)
      return true
    }
    const t = setInterval(() => { if (install()) clearInterval(t) }, 10)
  }, STATES)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  check('THE INTERCEPT IS LIVE, or every capture below is of the same real data',
    await page.evaluate(() => !!window.__STATES))

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  const shoot = async (name, width) => {
    const el = await page.$('#deal-version-panel')
    if (!el) { check(`CAPTURE ${name}@${width}: the panel is on screen`, false, 'no #deal-version-panel'); return null }
    // Verification 4 as refined: confirm the element is inside the capture.
    const box = await el.boundingBox()
    if (!box || box.width < 100 || box.height < 40) {
      check(`CAPTURE ${name}@${width}: the panel has usable size`, false, JSON.stringify(box)); return null
    }
    await el.scrollIntoView()
    await settle()
    const file = `${OUT}/${name}__${width}.png`
    await el.screenshot({ path: file })
    return { file, box }
  }

  const render = async (pick) => {
    await page.evaluate((p) => { window.__pick = p }, pick)
    await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await page.waitForFunction(() => {
      const root = document.getElementById('deal-version-root')
      return root && root.querySelector('#deal-version-panel') && (root.innerText ?? '').trim().length > 10
    }, { timeout: 30000 })
    await settle()
  }

  const sizes = {}
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 1000 })
    // EACH WIDTH STARTS FROM A CLEAN PAGE. A person opens the screen at their
    // own width; they do not carry nine renders and two viewport changes into
    // it. Driving one page through all three is a state nobody reaches.
    await page.reload({ waitUntil: "networkidle0" })
    await page.waitForFunction(() => typeof window.initOpportunityDealPanel === "function", { timeout: 25000 })
    for (const name of Object.keys(STATES)) {
      await render(name)
      const got = await shoot(name, width)
      if (got) sizes[`${name}@${width}`] = got.box
    }
    // ── THE EXERCISED CONTROLS, on the list that has enough rows ──────────
    await render('long-list')
    await page.evaluate(() =>
      document.querySelector('#deal-version-range button[data-range="5"]')?.click())
    await settle()
    const rowsAt5 = await page.evaluate(() =>
      document.querySelectorAll('#deal-version-list [data-restore-version]').length)
    await page.evaluate(() =>
      document.querySelector('#deal-version-range button[data-range="all"]')?.click())
    await settle()
    const rowsAtAll = await page.evaluate(() =>
      document.querySelectorAll('#deal-version-list [data-restore-version]').length)
    await page.evaluate(() =>
      document.querySelector('#deal-version-range button[data-range="5"]')?.click())
    await settle()
    const rowsBack = await page.evaluate(() =>
      document.querySelectorAll('#deal-version-list [data-restore-version]').length)
    check(`RANGE TOGGLE CHANGES THE LIST BOTH WAYS at ${width}`,
      rowsAtAll > rowsAt5 && rowsBack === rowsAt5, `${rowsAt5} -> ${rowsAtAll} -> ${rowsBack}`)
    await page.evaluate(() =>
      document.querySelector('#deal-version-range button[data-range="all"]')?.click())
    await settle()
    await shoot('range-all', width)

    await render('issued-and-draft')
    const wasSs = await page.evaluate(() => document.getElementById('deal-ssExisting')?.value)
    await page.click('#deal-ssExisting')
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta')
    await page.type('#deal-ssExisting', String((Number(wasSs) || 0) + 7), { delay: 1 })
    await settle()
    check(`THE DEAL IS GENUINELY DIRTY at ${width}`,
      await page.evaluate(() => window.dealFormSeam?.hasUnsavedChanges?.() === true),
      `ssExisting ${wasSs} -> ${await page.evaluate(() => document.getElementById('deal-ssExisting')?.value)}`)
    await page.click('#deal-version-reason')
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta')
    await page.keyboard.press('Backspace')
    await page.type('#deal-version-reason', REASON, { delay: 1 })
    await settle()
    check(`THE REASON BOX HOLDS WHAT WAS TYPED at ${width}`,
      (await page.evaluate(() => document.getElementById('deal-version-reason')?.value)) === REASON)
    await shoot('reason-filled', width)

    const atClick = await page.evaluate(() => ({
      reason: document.getElementById('deal-version-reason')?.value,
      saveDisabled: document.getElementById('btn-save-version')?.disabled,
      dirty: window.dealFormSeam?.hasUnsavedChanges?.(),
      listRows: document.querySelectorAll("#deal-version-list [data-restore-version]").length,
      reasonBoxes: document.querySelectorAll("#deal-version-reason").length,
      panels: document.querySelectorAll("#deal-version-panel").length,
      typedInsideRoot: !!document.getElementById("deal-version-root")?.contains(document.getElementById("deal-version-reason")),
      rootBoxValue: document.querySelector("#deal-version-root #deal-version-reason")?.value ?? "<none>",
      vanillaBoxValue: document.querySelector("#deal-version-vanilla #deal-version-reason")?.value ?? "<none>",
      census: (() => {
        const where = (el) => {
          if (document.getElementById("deal-version-root")?.contains(el)) return "ROOT"
          if (document.getElementById("deal-version-vanilla")?.contains(el)) return "VANILLA"
          return "ELSEWHERE:" + (el.parentElement?.id || el.parentElement?.className || "?")
        }
        const out = []
        for (const id of ["deal-version-reason", "btn-save-version", "deal-version-feedback", "deal-version-panel"]) {
          const all = [...document.querySelectorAll("#" + id)]
          const first = document.getElementById(id)
          out.push(id + "=[" + all.map((e, i) =>
            where(e) + (e === first ? "*" : "") + (e.value !== undefined ? ":" + String(e.value).length : "")
          ).join(" ") + "]")
        }
        return out.join(" ")
      })(),
    }))
    await page.evaluate(() => document.getElementById('btn-save-version')?.click())
    await page.waitForFunction(() =>
      (document.getElementById('deal-version-feedback')?.textContent ?? '').length > 0, { timeout: 15000 })
    await settle()
    const fb = await page.evaluate(() => ({
      text: document.getElementById('deal-version-feedback')?.textContent,
      cls: document.getElementById('deal-version-feedback')?.className }))
    check(`THE SUCCESS FEEDBACK RENDERS at ${width}`, fb.cls === 'msg-success',
      `saveDisabled=${atClick.saveDisabled} dirty=${atClick.dirty} reasonLen=${(atClick.reason??'').length} `
      + `${atClick.census} || ${fb.cls}: ${fb.text}`)
    await shoot('feedback', width)

    await render('draft-only')
    await page.evaluate(() => document.getElementById('btn-save-version')?.click())
    await settle()
    const err = await page.evaluate(() => ({
      text: document.getElementById('deal-version-feedback')?.textContent,
      cls: document.getElementById('deal-version-feedback')?.className }))
    check(`FEEDBACK ERROR RENDERS at ${width}`, err.cls === 'msg-error', `${err.cls}: ${err.text}`)
    await shoot('feedback-error', width)

    await render('issued-and-draft')
    await page.evaluate(() => {
      window.__realApi2 = window.api
      window.api = (m, p, b) => (String(p).includes('transition-requests') && m === 'POST')
        ? new Promise(() => {}) : window.__realApi2(m, p, b)
    })
    await page.evaluate(() => document.getElementById('btn-request-pricing-approval')?.click())
    await settle()
    await shoot('requesting', width)
    await page.evaluate(() => { window.api = window.__realApi2 })
  }

  // ── NO PANEL MAY OVERFLOW ITS CONTAINER, at any width ────────────────
  for (const [k, box] of Object.entries(sizes)) {
    if (!k.startsWith('long-list')) continue
    check(`the long list has a usable width at ${k.split('@')[1]}`, box.width >= 300, String(box.width))
  }
  check('no page errors across the capture',
    errs.length === 0, errs.slice(0, 2).join(' | '))
  writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes, null, 2))
} catch (err) {
  R.push({ n: 'VISUAL THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
const failed = R.filter((r) => !r.p)
console.log(`\nVISUAL: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
