// WHERE DOES THE CARRIED TEST BED COST ACTUALLY RENDER?
//
// The R15 walk asserted it on the Opportunity's landing surface and did not
// find it. That is a finding about the WALK or about the SCREEN and the two
// need different answers, so this measures rather than infers.
//
// Verification 4's refinement: "open the screenshot" assumes the screenshot
// contains the thing. A check that reads document.body.innerText of one tab
// cannot see a value on another, and reports the same "absent" either way.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const ROOT = new URL('../../', import.meta.url).pathname
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = 'costwhere'
const puppeteer = await loadPuppeteer('walk-cost-where')
let browser
try {
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account Ltd`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  const bed = await body('POST', '/test-beds', {
    name: `${TAG} bed`, account_id: account.id, industry_id: industry.id, country_code: 'SG',
    client_organisation: `${TAG} Client Org`, accumulated_cost: 12345.67,
  })
  const conv = await body('POST', `/test-beds/${bed.id}/convert`, { opportunity_name: `${TAG} deal` })
  console.log(`opportunity ${conv.id}, stored test_bed_cost = ${conv.test_bed_cost}`)

  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.setViewport({ width: 1600, height: 1100 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.navigate === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), conv.id)
  await page.waitForFunction((c) => document.body.innerText.includes(c), { timeout: 30000 }, bed.reference_code)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const state = await page.evaluate(() => {
    const el = document.getElementById('detail-testbed-cost')
    const vis = (n) => {
      if (!n) return null
      const r = n.getBoundingClientRect()
      const cs = getComputedStyle(n)
      return { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visibility: cs.visibility }
    }
    // Which ancestors are hidden, if any?
    const chain = []
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n)
      chain.push({ id: n.id || null, cls: n.className || null, display: cs.display, hidden: n.hasAttribute('hidden') })
    }
    // Which tab is showing?
    const tabs = [...document.querySelectorAll('[role="tab"], .tab, [data-tab]')]
      .map((t) => ({ text: t.innerText.trim().slice(0, 24), active: t.className.includes('active') || t.getAttribute('aria-selected') === 'true' }))
      .filter((t) => t.text)
    return {
      exists: !!el,
      text: el ? el.textContent : null,
      box: vis(el),
      chain: chain.slice(0, 6),
      tabs,
      bodyHasNumber: /12,345\.67|12345\.67/.test(document.body.innerText),
      // The whole strip, not only the cost: if the container is hidden then
      // every stat in it is, and the claim is about the strip.
      strip: ['detail-probability', 'detail-close-date', 'detail-testbed-cost', 'detail-age']
        .map((id) => {
          const n = document.getElementById(id)
          const r = n?.getBoundingClientRect()
          return { id, text: n?.textContent ?? null, w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null }
        }),
      // Does anything else on the page show these values?
      refRootHtmlLen: document.getElementById('ref-root')?.innerHTML.length ?? null,
      refVanillaClass: document.getElementById('ref-vanilla')?.className ?? null,
      bodyHasProbability: /\b10%/.test(document.body.innerText),
    }
  })
  console.log('\n#detail-testbed-cost:')
  console.log('  exists          ', state.exists)
  console.log('  textContent     ', JSON.stringify(state.text))
  console.log('  box             ', JSON.stringify(state.box))
  console.log('  the number is anywhere in the rendered text:', state.bodyHasNumber)
  console.log('  ancestor chain (nearest first):')
  for (const c of state.chain) console.log('    ' + JSON.stringify(c))
  console.log('  THE WHOLE STATS STRIP:')
  for (const st of state.strip) console.log('    ' + JSON.stringify(st))
  console.log('  #ref-root innerHTML length:', state.refRootHtmlLen)
  console.log('  #ref-vanilla class        :', JSON.stringify(state.refVanillaClass))
  console.log('  the probability appears in the rendered text:', state.bodyHasProbability)
  console.log('  tabs on screen:')
  for (const t of state.tabs) console.log('    ' + JSON.stringify(t))
  // AND THE OTHER TAB. rows.ts renders "Test Bed cost, carried from conversion"
  // in the Deal Sheet, which lives on Commercials. If it is there, the finding
  // is that the REFERENCE strip lost a cell, not that the value is lost.
  await page.screenshot({ path: ROOT + '.verify/cost-where-landing.png' })
  // THE FIRST ATTEMPT AT THIS CLICKED INSIDE page.evaluate AND READ THE RESULT
  // IN THE SAME SYNCHRONOUS EVALUATION. Verification 6: a synchronous read
  // after a synchronous dispatch is not a fast measurement, it is a
  // measurement of the old state, and it reported the tab had not changed when
  // what it had actually measured was the previous frame. Real click, then
  // yield, then wait on state only the new tab can satisfy.
  const tabInfo = await page.evaluate(() => {
    const t = [...document.querySelectorAll('button, a, [role="tab"], .detail-tab')]
      .find((e) => e.innerText.trim().toUpperCase() === 'COMMERCIALS')
    if (!t) return null
    t.setAttribute('data-probe-commercials', '1')
    return { tag: t.tagName, cls: t.className, id: t.id || null }
  })
  console.log('\n  the COMMERCIALS control:', JSON.stringify(tabInfo))
  let comm = { clicked: false }
  if (tabInfo) {
    // "Node is either not clickable" on the first attempt: the control was out
    // of the viewport. Scroll it in, then click. The CLICK is dispatched by
    // puppeteer; only the READ is moved outside the evaluation, which is the
    // distinction Verification 6 draws.
    await page.evaluate(() => document.querySelector('[data-probe-commercials="1"]')
      ?.scrollIntoView({ block: 'center' }))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)))
    await page.click('[data-probe-commercials="1"]')
    // Wait on the panel actually being shown, not on a fixed delay.
    await page.waitForFunction(() => {
      const p = document.getElementById('opp-tab-commercials')
      return p && getComputedStyle(p).display !== 'none' && p.innerText.trim().length > 40
    }, { timeout: 30000 }).catch(() => {})
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    comm = await page.evaluate(() => {
      const txt = document.body.innerText
      const panel = document.getElementById('opp-tab-commercials')
      return {
        clicked: true,
        panelShown: panel ? getComputedStyle(panel).display !== 'none' : null,
        panelTextLen: panel ? panel.innerText.trim().length : null,
        hasCostLabel: /Test Bed cost, carried from conversion/i.test(txt),
        hasNumber: /12,345\.67|12345\.67/.test(txt),
        near: (txt.match(/.{0,50}Test Bed cost[^\n]{0,70}/i) ?? [null])[0],
      }
    })
  }
  console.log('  COMMERCIALS tab:', JSON.stringify(comm, null, 2))
  await page.screenshot({ path: ROOT + '.verify/cost-where-commercials.png' })
  console.log(`\n  screenshot: ${ROOT}.verify/cost-where-landing.png`)
} finally {
  if (browser) await browser.close()
  await tearDown()
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', S.user.id).is('deleted_at', null)
  console.log(`RESIDUE live: ${left?.length ?? '?'}`)
}
