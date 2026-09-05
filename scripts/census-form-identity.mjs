// ── THE IDENTITY CENSUS, Round 3 D2d item 1 ───────────────────────────────
//
// Every id and class on the FORM that carries a stylesheet rule, or is read by
// app.js or opportunity-deal-versions.js. That list is what the React render
// must adopt.
//
// TWO INDEPENDENT INSTRUMENTS, because a single regex census is exactly what
// missed `clearDealFeedback` in D2c: it was declared `export function` and no
// scan of that file had ever matched it.
//
//   A. the SOURCE, index.html parsed with comments stripped
//   B. the LIVE DOM, queried in the browser
//
// B cannot miss markup that renders; A cannot be fooled by JS that injects.
// A disagreement is a finding, not something to reconcile quietly.
import { readFileSync, writeFileSync } from 'node:fs'
import { readCode } from '/Users/johnfryatt/terminus-tms/scripts/lib/strip-comments.mjs'
import { freshOpportunity, tearDown } from '/Users/johnfryatt/terminus-tms/scripts/fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms/'
const SP = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/1b6522fb-c25d-40e2-84dc-a70cd31d0e6f/scratchpad/'
const { loadPuppeteer } = await import('/Users/johnfryatt/terminus-tms/scripts/lib/puppeteer.mjs')
const puppeteer = await loadPuppeteer('identity-census')

// ── INSTRUMENT A: the source ─────────────────────────────────────────────
const html = readCode(new URL('frontend/index.html', 'file://' + ROOT))
const VOID = new Set(['br','hr','img','input','meta','link','source','col','area','base','embed','param','track','wbr'])
function subtree(src, startAttr) {
  const start = src.indexOf(startAttr)
  if (start < 0) throw new Error('anchor not found: ' + startAttr)
  const open = src.lastIndexOf('<', start)
  let i = src.indexOf('>', start) + 1, depth = 1
  const tag = /<(\/?)(\w+)([^>]*)>/g
  tag.lastIndex = i
  let m
  while ((m = tag.exec(src))) {
    const [, slash, name, attrs] = m
    if (VOID.has(name.toLowerCase()) || attrs.trim().endsWith('/')) continue
    depth += slash ? -1 : 1
    if (depth === 0) return src.slice(open, tag.lastIndex)
  }
  throw new Error('unclosed: ' + startAttr)
}
const panelSrc = subtree(html, 'id="opp-tab-commercial"')
// The FORM is the panel minus the two regions that stay vanilla.
const versionSrc = subtree(panelSrc, 'id="deal-version-panel"')
const actionsSrc = subtree(panelSrc, 'class="form-actions"')
// DESCENDANTS ONLY, matching instrument B. React mounts INSIDE the panel, so
// the panel's own id and class are the container's and can never be adopted.
// The two instruments disagreed on exactly this and the disagreement was the
// correct answer: `opp-tab-commercial` and `detail-tab-panel` belong to the
// mount point, not to the render.
const formSrc = panelSrc.slice(panelSrc.indexOf('>') + 1)
  .replace(versionSrc, '').replace(actionsSrc, '')

const idsA = new Set(), clsA = new Set()
for (const m of formSrc.matchAll(/\sid="([^"]+)"/g)) idsA.add(m[1])
for (const m of formSrc.matchAll(/\sclass="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) clsA.add(c)

// ── INSTRUMENT B: the live DOM ───────────────────────────────────────────
const { oppId } = await freshOpportunity('D2DCEN')
let B = null
try {
  const SESSION = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + (m.location()?.url ?? '')) })
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(SESSION))
  await page.reload({ waitUntil: 'networkidle0' })
  // ── THE MODULE MUST HAVE REGISTERED BEFORE WE NAVIGATE ────────────────
  //
  // `opportunity-deal.js` is an ES module, so it executes AFTER app.js. The
  // detail load calls `window.initOpportunityDealPanel?.(opp)` - an OPTIONAL
  // call - so navigating before the module registers silently does nothing,
  // and the form then sits there fully rendered and completely inert.
  //
  // That is what the first census measured: 143 ids and 71 classes of static
  // markup, agreeing perfectly with the source, on a form that had never run.
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 20000 })
  const authVisible = await page.evaluate(() =>
    !document.getElementById('view-auth')?.classList.contains('hidden'))
  if (authVisible) throw new Error('NOT SIGNED IN: the app is showing view-auth, so nothing below measures the app')
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.waitForFunction(() => !!document.getElementById('deal-ssExisting'), { timeout: 25000 })
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial'); return p && !p.classList.contains('hidden')
  }, { timeout: 20000 })
  try {
    await page.waitForFunction(() => typeof window.initOpportunityDealVersions === 'function'
      && (document.getElementById('deal-version-list')?.textContent ?? '').trim().length > 0, { timeout: 20000 })
  } catch {
    const d = await page.evaluate(() => ({
      init: typeof window.initOpportunityDealVersions,
      list: document.getElementById('deal-version-list')?.textContent ?? '<no element>',
      panelHidden: document.getElementById('opp-tab-commercial')?.classList.contains('hidden'),
      sections: [...document.querySelectorAll('#opp-tab-commercial .deal-section')].length,
    }))
    console.log('VERSION WAIT TIMED OUT. state:', JSON.stringify(d))
    console.log('page errors:', errs.join(' | ') || '<none>')
  }
  // ── THE POPULATION, and it is the whole point of this pass ─────────────
  //
  // The first run of this census sampled ONE fresh, empty deal and reported 71
  // classes. Every class the vanilla renders DYNAMICALLY - the cash-flow rows,
  // the deal matrix cells, the year schedule lines - was absent, because there
  // was no data to render and no branch had been switched on. A census taken on
  // an empty form is a census of the empty form.
  //
  // Verification 25's clause: the instrument must produce its reading on the
  // SAME POPULATION the claim covers. So the form is filled and then driven
  // through the branch combinations, and every variant's contribution is
  // reported so the coverage is visible rather than asserted.
  const setNum = async (pairs) => page.evaluate((ps) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    for (const [id, v] of ps) {
      const el = document.getElementById(id)
      if (!el) continue
      set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, pairs)
  const pick = async (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel)
  const choose = async (id, value) => page.evaluate(([i, v]) => {
    const el = document.getElementById(i)
    if (!el) return
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [id, value])

  await setNum([['deal-ssExisting', 40], ['deal-ssNew', 25], ['deal-aqm', 12], ['deal-hemir', 8],
    ['deal-ssUnitCost', 1200], ['deal-aqUnitCost', 900], ['deal-hemirUnitCost', 1500],
    ['deal-duration', 36], ['deal-targetMargin', 30], ['deal-warrantyPct', 12],
    ['deal-lumpCost', 250000], ['deal-recoveryMonths', 24], ['deal-gstPct', 9],
    ['deal-whtPct', 10], ['deal-fxContingency', 3], ['deal-factoring-ratePct', 6],
    ['deal-factoring-termMonths', 12]])

  const sample = () => page.evaluate(() => {
    const panel = document.getElementById('opp-tab-commercial')
    const skip = [document.getElementById('deal-version-panel'), panel.querySelector('.form-actions')]
    const ids = [], cls = []
    for (const el of panel.querySelectorAll('*')) {
      if (skip.some((s) => s && (s === el || s.contains(el)))) continue
      if (el.id) ids.push(el.id)
      for (const c of el.classList) cls.push(c)
    }
    return { ids: [...new Set(ids)], cls: [...new Set(cls)] }
  })

  const VARIANTS = [
    { n: 'twoPhase / annual / no factoring / client own',
      go: async () => { await pick('[data-structure="twoPhase"]'); await pick('[data-invoicing="annual"]')
                        await choose('deal-installResp', 'Client Own Installation Team') } },
    { n: 'single / monthly / factoring straight / per unit',
      go: async () => { await pick('[data-structure="single"]'); await pick('[data-invoicing="monthly"]')
                        await pick('#deal-factoring-toggle button'); await pick('[data-method="straight"]')
                        await choose('deal-installResp', 'Terminus Contractor - Per Unit') } },
    { n: 'hybrid / factoring declining / lump sum',
      go: async () => { await pick('[data-structure="hybrid"]'); await pick('[data-method="declining"]')
                        await choose('deal-installResp', 'Terminus Contractor - Lump Sum') } },
    { n: 'twoPhase / gross-up / reseller / detail unfolded',
      go: async () => { await pick('[data-structure="twoPhase"]'); await pick('#deal-grossUp-toggle button')
                        await choose('deal-installResp', 'Terminus - Reseller Installation')
                        await pick('#btn-toggle-detail') } },
  ]

  const ids = new Set(), cls = new Set()
  for (const v of VARIANTS) {
    await v.go()
    await new Promise((r) => setTimeout(r, 400))
    const s = await sample()
    const newIds = s.ids.filter((x) => !ids.has(x)), newCls = s.cls.filter((x) => !cls.has(x))
    s.ids.forEach((x) => ids.add(x)); s.cls.forEach((x) => cls.add(x))
    console.log(`  variant: ${v.n}`)
    console.log(`    +${newIds.length} ids, +${newCls.length} classes` +
      (newCls.length ? '  new: ' + newCls.slice(0, 12).join(' ') + (newCls.length > 12 ? ' ...' : '') : ''))
  }
  B = { ids: [...ids].sort(), cls: [...cls].sort() }
  await browser.close()
} finally { await tearDown() }

// ── THE COMPARISON. A disagreement is a finding. ─────────────────────────
const onlyA = { ids: [...idsA].filter(x => !B.ids.includes(x)), cls: [...clsA].filter(x => !B.cls.includes(x)) }
const onlyB = { ids: B.ids.filter(x => !idsA.has(x)), cls: B.cls.filter(x => !clsA.has(x)) }
console.log(`A (source): ${idsA.size} ids, ${clsA.size} classes`)
console.log(`B (DOM):    ${B.ids.length} ids, ${B.cls.length} classes`)
console.log(`only in A (source, not rendered): ids ${onlyA.ids.join(', ') || '-'} | classes ${onlyA.cls.join(', ') || '-'}`)
console.log(`only in B (rendered, not source): ids ${onlyB.ids.join(', ') || '-'} | classes ${onlyB.cls.join(', ') || '-'}`)

const ids = [...new Set([...idsA, ...B.ids])].sort()
const cls = [...new Set([...clsA, ...B.cls])].sort()
writeFileSync(SP + 'census-raw.json', JSON.stringify({ ids, cls, onlyA, onlyB }, null, 1))
console.log(`\nunion: ${ids.length} ids, ${cls.length} classes -> census-raw.json`)
