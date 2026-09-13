// LEADS CARD CLEANUP, Phase 1: the proofs.
//
// Artefacts are `lcc-p1-*` (Verification 44's lineage clause: this probe is
// copied from the Phase 0 one, so the output paths were re-pointed first).
//
// R1's VERIFICATION LIMIT IS RESTATED IN THE OUTPUT, not just the report:
// headless Chrome cannot trigger autofill, so this proves the RULE and the
// ABSENCE OF COLLATERAL, and says plainly that it cannot prove the visual.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1-lcc.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/lcc/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const FAIL = []
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`)
  if (!ok) FAIL.push(what)
}
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }

const industry = must(await db.from('industries').select('id').limit(1), 'i')[0]
const lead = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OWNER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: lead.id, revision_number: 1,
  payload: { name: 'lcc1 Summary', company: 'Cleanup Co', source: 'Referral',
    jobRole: 'Head', email: 'lcc1@example.invalid', mobile: '+65 9000 0401',
    linkedin: 'https://example.invalid/in/x', address: '1 Way', address2: 'U2',
    city: 'Singapore', postcode: '069118', country: 'Singapore', region: 'APAC' },
  created_by: OWNER.user.id }).select().single(), 'rev')
const created = [lead.id]
// The grid's save creates a REAL lead; its id is captured for teardown.
const requirements = (await api('GET', '/contacts/creation-requirements')).data
console.log(`fixture: ${lead.id}   server-mandatory at creation: ${JSON.stringify(requirements?.required)}\n`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  const go = async (id) => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`),
      { timeout: 25000 }, id)
  }
  const openGrid = async () => {
    await page.waitForSelector('#btn-new-contact', { timeout: 15000 })
    await page.click('#btn-new-contact')
    await page.waitForSelector('[data-testid="new-lead-grid"]', { timeout: 15000 })
  }

  // ══ R2 ═══════════════════════════════════════════════════════════════
  console.log('=== R2: the grid as a table ===')
  await page.evaluate(() => navigate('leads'))
  await openGrid()
  const LONG = 'Wolfeschlegelsteinhausenbergerdorff Holdings International'
  // A REALISTIC name, taken from the estate's own account list rather than
  // invented: 32 characters. "Row 1" is five and fits anything, which is why
  // the first two versions of the readability assertion passed on a column
  // that still cropped.
  const TYPICAL = 'Singapore Instutue of Technology'
  for (let i = 0; i < 10; i++) {
    const sel = `[data-testid="nlg-name-${i}"]`
    if (!await page.$(sel)) break
    await page.click(sel)
    await page.keyboard.type(i === 0 ? LONG : (i === 1 ? TYPICAL : `Row ${i}`))
  }
  // YIELD FIRST. `aria-invalid` is React state set from the typing above, and
  // a synchronous read after a synchronous dispatch measures the OLD frame -
  // Verification 6's framework clause. Two earlier runs passed on luck.
  await page.waitForFunction(() => {
    const s = document.querySelector('[data-testid="new-lead-grid"] select')
    return !!s && s.getAttribute('aria-invalid') === 'true'
  }, { timeout: 5000 }).catch(() => console.log('    (no select reached aria-invalid within 5s)'))
  const t = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="new-lead-grid"]')
    const scroll = g.querySelector('.new-lead-scroll')
    const input = g.querySelector('[data-testid="nlg-name-0"]')
    const cell = input.closest('td')
    const th = g.querySelector('th')
    const sel = g.querySelector('select')
    const bb = (e) => { const s = getComputedStyle(e); return `${s.borderBottomWidth} ${s.borderBottomColor}` }
    const w = (e) => Math.round(e.getBoundingClientRect().width)
    return {
      lines: { th: bb(th), td: bb(cell), input: bb(input), select: bb(sel) },
      inputWidth: w(input), cellWidth: w(cell), contentWidth: input.scrollWidth,
      cropped: input.scrollWidth > input.clientWidth,
      vScrolls: scroll.scrollHeight > scroll.clientHeight,
      hScrolls: scroll.scrollWidth > scroll.clientWidth,
      scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      rows: g.querySelectorAll('tbody tr').length,
    }
  })
  console.log(`  lines: th ${t.lines.th} | td ${t.lines.td} | input ${t.lines.input} | select ${t.lines.select}`)
  const rowEdge = new Set([t.lines.th, t.lines.td])
  check(t.lines.input.startsWith('0px'), 'the input has NO underline of its own inside a cell', t.lines.input)
  check(rowEdge.size === 1, 'the header and the cell share ONE row-edge treatment', [...rowEdge].join(' vs '))
  check(!t.lines.select.startsWith('0px') && t.lines.select.includes('224, 108, 108'),
    'the aria-invalid red SURVIVES on an empty required select', t.lines.select)
  check(t.vScrolls, 'the body SCROLLS vertically with rows in it',
    `scrollHeight ${t.scrollHeight} > clientHeight ${t.clientHeight}, ${t.rows} rows`)
  // NOT a pixel threshold. The first version asserted `>= 130`, a number
  // chosen AFTER the change, and it passed on an input that still cropped.
  // The claim is that a REALISTIC value is fully visible, so that is what is
  // asserted - and the 58-character monster is measured separately, because
  // a genuinely long value SHOULD still overflow rather than shrink the font.
  const typical = await page.evaluate(() => {
    const e = document.querySelector('[data-testid="nlg-name-1"]')
    return { fits: e.scrollWidth <= e.clientWidth, value: e.value,
      needs: e.scrollWidth, has: e.clientWidth }
  })
  check(typical.fits, 'a realistic value is FULLY VISIBLE in its cell',
    `"${typical.value}" needs ${typical.needs}px, cell gives ${typical.has}px`)
  console.log(`    (a 58-char value still needs ${t.contentWidth}px and overflows, correctly:`
    + ' the fix is a readable column, not an unbounded one)')
  await page.screenshot({ path: `${OUT}lcc-p1-grid.png` })

  // scroll RESETS on reopen - testable now the cap has landed
  await page.evaluate(() => { document.querySelector('.new-lead-scroll').scrollTop = 100 })
  const setTo = await page.evaluate(() => document.querySelector('.new-lead-scroll').scrollTop)
  await page.evaluate(() => { window.closeNewLeadModal?.() })
  await new Promise((r) => setTimeout(r, 400))
  await openGrid()
  const onReopen = await page.evaluate(() => document.querySelector('.new-lead-scroll').scrollTop)
  check(setTo > 0, 'the scroll could actually be moved (so the reset claim is not vacuous)', `scrollTop ${setTo}`)
  check(onReopen === 0, 'the scroll position RESETS on reopen', `was ${setTo}, now ${onReopen}`)

  // SAVE closes, with a COMPLETE row - John's note: name alone leaves Save disabled
  const req = requirements?.required ?? []
  const VALUES = { name: 'lcc1 Grid Made', company: 'Cleanup Co', jobRole: 'Head',
    email: 'lcc1grid@example.invalid', mobile: '+65 9000 0402', source: 'Referral',
    linkedin: 'https://example.invalid/in/g' }
  for (const key of req) {
    const sel = `[data-testid="nlg-${key}-0"]`
    if (!await page.$(sel)) { console.log(`    (no cell for required "${key}")`); continue }
    const tag = await page.$eval(sel, (e) => e.tagName.toLowerCase())
    if (tag === 'select') {
      const opts = await page.$eval(sel, (e) => [...e.options].map((o) => o.value).filter(Boolean))
      if (opts.length) await page.select(sel, opts[0])
    } else {
      await page.click(sel, { clickCount: 3 })
      await page.keyboard.type(VALUES[key] ?? 'x')
    }
  }
  const enabled = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="nlg-save"]'); return b ? !b.disabled : null })
  check(enabled === true, 'a COMPLETE row enables Save', `(John: name alone leaves it disabled)`)
  if (enabled) {
    // Verification 14: the failure detail carries the CAUSE. "The modal did
    // not close" and "nothing was created" are different failures, and the
    // close is CONDITIONAL on the count, so the count must be visible.
    const posts = []
    page.on('response', (res) => {
      if (res.url().includes('/api/contacts') && res.request().method() === 'POST')
        posts.push(res.status())
    })
    await page.click('[data-testid="nlg-save"]')
    await new Promise((r) => setTimeout(r, 3000))
    const resultText = await page.evaluate(() =>
      document.querySelector('[data-testid="new-lead-result"]')?.textContent ?? '(none)')
    console.log(`    [cause] POST statuses: ${JSON.stringify(posts)}   grid result: "${resultText}"`)
    const closed = await page.evaluate(() => {
      const m = document.getElementById('new-contact-form')
      return !!m && m.classList.contains('hidden') })
    const onList = await page.evaluate(() => {
      const v = document.getElementById('view-leads'); return !!v && !v.classList.contains('hidden') })
    check(closed, 'on SAVE the modal CLOSES')
    check(onList, 'and the list is what is showing')
    const made = must(await db.from('records').select('id').eq('record_type', 'contact')
      .eq('owner_id', OWNER.user.id).is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 120000).toISOString()), 'made')
    for (const m of made) if (!created.includes(m.id)) created.push(m.id)
    console.log(`    (the save created ${made.length} record(s); all captured for teardown)`)
    await page.screenshot({ path: `${OUT}lcc-p1-after-save.png` })
  }

  // ══ R3 ═══════════════════════════════════════════════════════════════
  console.log('\n=== R3: the asterisk is on the panel, and the block is gone ===')
  await page.reload({ waitUntil: 'networkidle0' })
  await go(lead.id)
  await page.click(`[data-testid="lead-qualify-${lead.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${lead.id}"]`, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 800))
  const r3 = await page.evaluate((x) => {
    const panel = document.querySelector(`[data-testid="lead-summary-${x}"]`)
    const star = document.querySelector(`[data-testid="lead-needs-summary-${x}"]`)
    const head = panel?.querySelector('[data-panel-header]')
    const title = panel?.querySelector('[data-panel-title]')
    return {
      block: !!document.querySelector(`[data-testid="lead-summary-pointer-${x}"]`),
      star: !!star,
      starInPanelTitle: !!(star && title && title.contains(star)),
      starOnHeaderLine: !!(star && head && head.contains(star)),
      titleText: title?.textContent?.trim() ?? null,
      surfaceOpen: !!document.querySelector(`[data-testid="lead-incomplete-${x}"]`),
    }
  }, lead.id)
  check(!r3.block, 'the "Summary is required. Complete it..." block is GONE')
  check(r3.surfaceOpen, 'and the completion surface is open (so the claim is not true by absence)')
  check(r3.star, 'the asterisk exists')
  check(r3.starInPanelTitle, "and it is INSIDE the Summary panel's own title", JSON.stringify(r3.titleText))
  check(r3.starOnHeaderLine, 'which is on the panel header line')
  await (await page.$(`[data-testid="lead-card-${lead.id}"]`))?.screenshot({ path: `${OUT}lcc-p1-summary-star.png` })

  // ══ R4 ═══════════════════════════════════════════════════════════════
  console.log('\n=== R4: the completion surface routes through the shell ===')
  const r4 = await page.evaluate((x) => {
    const s = document.querySelector(`[data-testid="lead-incomplete-${x}"]`)
    return {
      panels: s.querySelectorAll('[data-panel]').length,
      selfHeaders: s.querySelectorAll('.lead-card-col-title').length,
      panelHeaders: s.querySelectorAll('[data-panel-header]').length,
      testids: ['lead-missing', 'lead-fix-save', 'lead-incomplete-close']
        .filter((t) => !!document.querySelector(`[data-testid="${t}-${x}"]`)),
      groupTestids: [...s.querySelectorAll('[data-testid^="lead-complete-"]')]
        .map((e) => e.dataset.testid),
    }
  }, lead.id)
  check(r4.panels >= 2, 'the surface renders Panels', `${r4.panels}`)
  check(r4.selfHeaders === 0, 'and no self-built headers remain', `${r4.selfHeaders} found`)
  check(r4.testids.length === 3, 'the surface-level testids SURVIVED the routing', r4.testids.join(' '))
  check(r4.groupTestids.length >= 2, 'and the group testids survived', r4.groupTestids.join(' '))

  // ══ R1, THE PROVABLE HALF ════════════════════════════════════════════
  console.log('\n=== R1: what CAN be proven, and what cannot ===')
  console.log('  LIMIT: headless Chrome cannot trigger autofill, so this probe')
  console.log('         CANNOT show white-before and normal-after. It does not try.')
  const r1 = await page.evaluate((x) => {
    const card = document.querySelector(`[data-testid="lead-card-${x}"]`)
    const inputs = [...card.querySelectorAll('input, textarea, select')]
    return {
      count: inputs.length,
      odd: inputs.map((e) => ({ t: e.dataset.testid ?? e.tagName,
        bg: getComputedStyle(e).backgroundColor }))
        .filter((f) => f.bg !== 'rgb(21, 22, 28)' && f.bg !== 'rgba(0, 0, 0, 0)'),
      anyAutofilled: inputs.some((e) => { try { return e.matches(':-webkit-autofill') } catch { return false } }),
    }
  }, lead.id)
  console.log(`  card inputs measured: ${r1.count}; any actually autofilled: ${r1.anyAutofilled}`)
  check(r1.odd.length === 0,
    'NO non-autofilled field moved: every card input still on the standard ground',
    r1.odd.length ? JSON.stringify(r1.odd) : 'rgb(21,22,28) throughout, as the prior Phase 0 recorded')
  console.log('  the rule itself is asserted statically in the pure suite, not here.')

  // ── THREE WIDTHS, on the two surfaces this round changed ─────────────
  console.log('\n=== the grid and the card at three widths ===')
  for (const w of [1240, 1920, 3440]) {
    await page.setViewport({ width: w, height: 1000 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate(() => navigate('leads'))
    await openGrid()
    for (let i = 0; i < 10; i++) {
      const sel = `[data-testid="nlg-name-${i}"]`
      if (!await page.$(sel)) break
      await page.click(sel); await page.keyboard.type(`Row ${i} of a longer company name`)
    }
    const m = await page.evaluate(() => {
      const g = document.querySelector('[data-testid="new-lead-grid"]')
      const sc = g.querySelector('.new-lead-scroll')
      const inp = g.querySelector('[data-testid="nlg-name-0"]')
      return { vScrolls: sc.scrollHeight > sc.clientHeight,
        capped: getComputedStyle(sc).maxHeight,
        clientHeight: sc.clientHeight, inputWidth: Math.round(inp.getBoundingClientRect().width) }
    })
    console.log(`  ${w}px  scrolls ${m.vScrolls}  cap ${m.capped}  visible ${m.clientHeight}px  input ${m.inputWidth}px`)
    if (!m.vScrolls) FAIL.push(`${w}: the grid still does not scroll`)
    await page.screenshot({ path: `${OUT}lcc-p1-grid-${w}.png` })
    await page.evaluate(() => { window.closeNewLeadModal?.() })
    await new Promise((r) => setTimeout(r, 300))
    await go(lead.id)
    await (await page.$(`[data-testid="lead-card-${lead.id}"]`))?.screenshot({
      path: `${OUT}lcc-p1-card-${w}.png` })
  }

  console.log(`\n${FAIL.length ? `FAILURES (${FAIL.length}):\n  ` + FAIL.join('\n  ') : 'ALL CHECKS PASSED'}`)
} finally {
  await browser.close()
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').in('id', created).is('deleted_at', null), 'td')
  console.log(`\nteardown: ${created.length} soft-deleted, ${live.length} still live`)
}
process.exit(FAIL.length ? 1 : 0)
