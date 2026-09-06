// ── THE REVERT REHEARSAL ─────────────────────────────────────────────────
// The vanilla script tag is restored. Everything below asks whether the
// application is the pre-swap one, and whether the surfaces the swap did NOT
// touch are still React.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '/Users/johnfryatt/terminus-tms/scripts/lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '/Users/johnfryatt/terminus-tms/scripts/fixtures.mjs'
import { api } from '/Users/johnfryatt/terminus-tms/scripts/api-client.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms/'
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 120) })
const puppeteer = await loadPuppeteer('rehearse')
const { oppId } = await freshOpportunity('R3REV')
try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + (m.location()?.url ?? '')) })
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const p = document.getElementById('opp-tab-commercial')
    return p && p.offsetParent !== null && (p.innerText ?? '').trim().length > 500
  }, { timeout: 30000 })

  const state = await page.evaluate(() => ({
    reactMounted: !!document.querySelector('#deal-form-root [data-testid="deal-panel"]'),
    vanillaHidden: !!document.getElementById('deal-form-vanilla')?.classList.contains('hidden'),
    rootEmpty: (document.getElementById('deal-form-root')?.innerHTML ?? '') === '',
    seam: typeof window.dealFormSeam,
    seamKeys: Object.keys(window.dealFormSeam ?? {}).sort().join(','),
  }))
  check('THE VANILLA FORM IS LIVE: React did not mount and the markup is not hidden',
    !state.reactMounted && !state.vanillaHidden && state.rootEmpty,
    `mounted ${state.reactMounted}, hidden ${state.vanillaHidden}, root empty ${state.rootEmpty}`)
  check('and the seam on the page is the VANILLA adapter, five members',
    state.seam === 'object'
      && state.seamKeys === 'freezeCurrentState,hasUnsavedChanges,populateForm,readContractorMilestones,recompute',
    state.seamKeys)

  // The vanilla COMPUTES: a figure that is -- until something runs.
  await page.evaluate(() => {
    const e = document.getElementById('deal-ssExisting')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(e, '40')
    e.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 800))
  const computed = await page.evaluate(() => ({
    total: document.getElementById('deal-total-cost')?.textContent,
    matrix: document.querySelectorAll('#deal-panel .dm-row').length,
  }))
  check('THE VANILLA COMPUTES: the matrix renders and the total is a figure',
    computed.matrix > 3 && computed.total !== '--', `${computed.matrix} rows, total ${computed.total}`)

  // The version machinery, against the vanilla adapter.
  await page.evaluate(() => {
    const t = document.getElementById('deal-version-reason')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(t, 'rehearsal')
    t.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const vBefore = ((await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []).length
  await page.evaluate(() => document.getElementById('btn-save-version')?.click())
  let vAfter = vBefore
  for (let i = 0; i < 30 && vAfter === vBefore; i++) {
    await new Promise((r) => setTimeout(r, 500))
    vAfter = ((await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []).length
  }
  check('THE VERSION MACHINERY WORKS AGAINST THE VANILLA ADAPTER',
    vAfter > vBefore, `${vBefore} -> ${vAfter}`)

  // The surfaces the swap did not touch are still React.
  check('the APPROVAL surface is still registered by the bundle',
    await page.evaluate(() => typeof window.loadApprovalPage === 'function'))
  check('and the ACCOUNT surface is too',
    await page.evaluate(() => typeof window.loadAccountDetail === 'function'))
  check('no page errors on the reverted application',
    errs.filter((e) => !e.includes('favicon') && !e.includes('404')).length === 0,
    errs.filter((e) => !e.includes('favicon') && !e.includes('404')).slice(0, 3).join(' | ') || 'none')
  await browser.close()
} catch (err) {
  R.push({ n: 'REHEARSAL THREW: ' + String(err.message).slice(0, 110), p: false, d: '' })
} finally { await tearDown() }
const failed = R.filter((r) => !r.p)
console.log(`\nREHEARSAL: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
