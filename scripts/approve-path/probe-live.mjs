// ── LIVE PROOF: THE THREE FIXES ON THE REAL SCREEN ──────────────────────
//
// Phase 0 drove these same controls and found each defect. This drives them
// again, at both widths, and reads the record back.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('approve-path/probe-live.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/approve-path/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'apathlive'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '   ' + detail : ''}`)
}
const DEAL = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60, targetMargin: 30,
  warrantyPct: 2, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
}
const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: DEAL })
const payload = async () => (await admin().from('record_revisions').select('payload')
  .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1)).data?.[0]?.payload ?? {}
const ladder = async () => ((await admin().from('deal_sheet_versions')
  .select('major, minor, status').eq('record_id', oppId)
  .order('major', { ascending: true }).order('minor', { ascending: true })).data ?? [])

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const view = () => p.evaluate(() => [...document.querySelectorAll('[id^="view-"]')]
    .filter((v) => !v.classList.contains('hidden')).map((v) => v.id).join(','))
  const land = async (width) => {
    await p.setViewport({ width, height: 1400 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1800)))
  }
  const shot = async (n) => {
    await p.screenshot({ path: `${OUT}${n}.png` })
    const bytes = statSync(`${OUT}${n}.png`).size
    console.log(`     ${n}.png ${bytes} bytes${bytes < 20000 ? '  <-- SUSPECT' : ''}`)
  }

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    await land(width)
    const btn = await p.evaluate(() => {
      const e = document.getElementById('btn-open-approval')
      const k = Object.keys(e).find((x) => x.startsWith('__reactProps$'))
      return { label: e.textContent.trim(), visible: e.checkVisibility(),
        handlers: k ? Object.keys(e[k]).filter((n) => n.startsWith('on')).join(',') : 'none' }
    })
    check(btn.label === 'Approve pricing', 'H1 the button is renamed', `"${btn.label}"`)
    check(btn.handlers.includes('onClick'), 'H1 and it carries a handler', btn.handlers)
    const issueVisible = await p.evaluate(() =>
      document.getElementById('btn-issue-version')?.checkVisibility() ?? false)
    check(issueVisible, 'H2 the issue control is on screen', `at ${width}`)

    // H1 END TO END: the click goes somewhere.
    const before = await view()
    await p.click('#btn-open-approval')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
    const after = await view()
    check(after === 'view-opportunity-approval' && after !== before,
      'H1 clicking it reaches the approval view', `${before} -> ${after}`)
    const heading = await p.evaluate(() =>
      (document.querySelector('#view-opportunity-approval')?.innerText ?? '').split('\n').filter(Boolean)[1] ?? '')
    check(/approval/i.test(heading), 'H1 and the approval screen renders', `"${heading}"`)
    if (width === 1440) await shot('live-approval-view-1440')
  }

  // ── H2 END TO END: draft, issue, promotion visible ────────────────────
  console.log('\n══════ H2: the full journey ══════')
  await land(1440)
  await p.click('#deal-version-reason')
  await p.keyboard.type('first pricing for the approval-path round')
  await p.click('#btn-save-version')
  await p.waitForFunction(() => (document.getElementById('deal-version-feedback')?.textContent ?? '').trim(),
    { timeout: 30000 })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
  const labels = () => p.evaluate(() => [...document.querySelectorAll('#deal-version-list .ds-label')]
    .map((e) => e.textContent.trim().split('\n')[0].trim()))
  check((await ladder()).some((v) => v.major === 0 && v.minor === 1), 'a draft 0.1 exists',
    (await ladder()).map((v) => `${v.major}.${v.minor}/${v.status}`).join(' '))
  check((await labels())[0]?.startsWith('V0.1'), 'and the panel shows it', (await labels()).join(', '))
  await p.click('#btn-issue-version')
  await p.waitForFunction(() => {
    const t = [...document.querySelectorAll('#deal-version-list .ds-label')].map((e) => e.textContent)
    return t.some((x) => /issued/i.test(x ?? ''))
  }, { timeout: 30000 }).catch(() => {})
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
  const after = await ladder()
  check(after.some((v) => v.major === 1 && v.minor === 0 && v.status === 'issued'),
    'H2 the draft was PROMOTED to 1.0', after.map((v) => `${v.major}.${v.minor}/${v.status}`).join(' '))
  check((await labels()).some((l) => /issued/i.test(l)), 'H2 and the panel shows the promotion',
    (await labels()).join(', '))
  await p.evaluate(() => document.querySelector('#deal-version-panel')?.scrollIntoView({ block: 'center' }))
  await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  await shot('live-issued-1440')

  // A SECOND ISSUE WITH NO NEW DRAFT: the route refuses and the screen says so.
  await p.click('#btn-issue-version')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  const issueBtn = await p.evaluate(() => ({
    disabled: document.getElementById('btn-issue-version')?.disabled,
    title: document.getElementById('btn-issue-version')?.getAttribute('title') ?? '',
  }))
  check(issueBtn.disabled === true && issueBtn.title.length > 0,
    'H2 with nothing to issue it stays and explains', `"${issueBtn.title.slice(0, 70)}"`)

  // ── THE ROW STILL FITS, and this round is exactly the change that could
  // break it. DESIGN_PRINCIPLES records a layout defect where the state
  // sentence pushed the last button onto a second line at 1240, and H2 puts a
  // button back on that row at every stage. So the WORST CASE is constructed -
  // every control offered, and the sentence carrying text - rather than
  // measured in the empty state that already passed.
  console.log('\n══════ the action row, worst case, both widths ══════')
  for (const width of [1440, 1240]) {
    await land(width)
    await p.click('#deal-version-reason')
    await p.keyboard.type('row measurement')
    await p.click('#btn-save-version')
    await p.waitForFunction(() => (document.getElementById('deal-version-feedback')?.textContent ?? '').trim(),
      { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    const row = await p.evaluate(() => {
      const ask = document.getElementById('btn-request-pricing-approval')
      ask?.classList.remove('hidden')
      const st = document.getElementById('pricing-approval-state')
      st?.classList.remove('hidden')
      if (st) st.textContent = 'V1 is awaiting approval.'
      const r = document.querySelector('.version-actions')
      const btns = [...r.querySelectorAll('button')].filter((e) => e.checkVisibility())
      const tops = btns.map((e) => Math.round(e.getBoundingClientRect().top))
      return { n: btns.length, oneRow: new Set(tops).size === 1,
        overflow: r.scrollWidth > r.clientWidth + 1,
        fit: `${btns.reduce((a, e) => a + Math.round(e.getBoundingClientRect().width), 0)}px in ${r.clientWidth}px` }
    })
    // A COUNT OF CHILDREN CANNOT SEE A WRAP. The claim is that they share one
    // row, so the assertion is on their tops.
    check(row.n === 4 && row.oneRow && !row.overflow,
      `the four controls share ONE row at ${width}`, `${row.n} buttons, ${row.fit}`)
  }

  // ── H3 END TO END ────────────────────────────────────────────────────
  console.log('\n══════ H3: a count change clears the absolutes ══════')
  await land(1440)
  await p.evaluate(() => {
    const x = document.querySelector('[data-testid="stmt-expand-all"]')
    if (x && x.textContent.trim() === 'Expand all') x.click()
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 900)))
  const type = async (sel, text) => {
    await p.click(sel); await p.keyboard.press('End')
    for (let i = 0; i < 10; i += 1) await p.keyboard.press('Backspace')
    if (text) await p.keyboard.type(text)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
  }
  const save = async () => {
    await p.click('[data-testid="stmt-save"]')
    await p.waitForFunction(() => !document.querySelector('[data-testid="stmt-unsaved"]'), { timeout: 30000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 800)))
  }
  const amber = () => p.evaluate(() => [...document.querySelectorAll('.stmt-edit')]
    .filter((e) => e.dataset.override === 'true')
    .map((e) => e.getAttribute('data-testid').replace('stmt-edit-deal-', '')))
  await type('[data-testid="stmt-edit-deal-price-hwSs"]', '500000')
  await type('[data-testid="stmt-edit-deal-hofee-hoSs"]', '99')
  await type('[data-testid="stmt-edit-deal-margin-hwAqm"]', '44')
  await save()
  const before = await payload()
  const amberBefore = await amber()
  check(before.priceOverrides?.hwSs === 500000 && before.hostingUnitFees?.hoSs === 99
    && before.marginOverrides?.hwAqm === 44, 'three overrides stored',
    `price ${JSON.stringify(before.priceOverrides)} fee ${JSON.stringify(before.hostingUnitFees)} margin ${JSON.stringify(before.marginOverrides)}`)
  check(amberBefore.length === 3, 'and three lines are amber', amberBefore.join(', '))
  await shot('live-h3-before-1440')

  await type('[data-testid="stmt-edit-deal-ssExisting"]', '35')
  const amberOnType = await amber()
  check(!amberOnType.includes('price-hwSs') && !amberOnType.includes('hofee-hoSs'),
    'H3 the amber goes out IMMEDIATELY, before the save', amberOnType.join(', ') || 'none left')
  await save()
  const afterP = await payload()
  const amberAfter = await amber()
  check(afterP.ssExisting === 35, 'the count landed', String(afterP.ssExisting))
  check(!('hwSs' in (afterP.priceOverrides ?? {})), 'H3 the price override KEY is removed',
    JSON.stringify(afterP.priceOverrides ?? {}))
  check(!('hoSs' in (afterP.hostingUnitFees ?? {})), 'H3 the hosting fee KEY is removed',
    JSON.stringify(afterP.hostingUnitFees ?? {}))
  check(afterP.marginOverrides?.hwAqm === 44, 'H3 and the MARGIN override survives',
    JSON.stringify(afterP.marginOverrides ?? {}))
  check(amberAfter.length === 1 && amberAfter[0] === 'margin-hwAqm',
    'H3 exactly one line is still amber, the margin', amberAfter.join(', ') || 'none')
  await shot('live-h3-after-1440')

  // THE OTHER DIRECTION, on the live screen.
  await type('[data-testid="stmt-edit-deal-price-hwHemir"]', '777000')
  await save()
  const mid = await payload()
  await p.click('#deal-targetMargin').catch(() => {})
  const nonFund = await p.evaluate(() => !!document.getElementById('deal-targetMargin'))
  if (nonFund) {
    await type('#deal-targetMargin', '35')
    await save()
    const afterNF = await payload()
    check(afterNF.priceOverrides?.hwHemir === 777000,
      'H3 a NON-fundamental edit clears nothing', JSON.stringify(afterNF.priceOverrides ?? {}))
  } else {
    check(mid.priceOverrides?.hwHemir === 777000, 'H3 the second override stored (target margin box absent)',
      JSON.stringify(mid.priceOverrides ?? {}))
  }
} finally { await b.close(); await tearDown(TAG) }

const bad = checks.filter((x) => !x).length
console.log(`\n${checks.length - bad} of ${checks.length} checks passed`)
if (bad) process.exit(1)
