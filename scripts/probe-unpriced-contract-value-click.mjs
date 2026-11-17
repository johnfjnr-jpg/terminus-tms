#!/usr/bin/env node
// ── CONTRACT_VALUE ruling 2: AN UNPRICED DEAL'S CONTRACT VALUE READS "--" ──
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/probe-unpriced-contract-value-click.mjs
//
// John, Phase 0 sign-off: the Commercials stats cell and statement print "--"
// for an unpriced deal, by the SAME unpriced test the headline uses
// (src/lib/contract-value.js). "Prove it from the click on an unpriced
// fixture; calibrate."
//
//   (1) the route agrees the fixture is unpriced (total_contract_value null);
//   (2) Commercials, as opened: the stats cell, the statement's revenue total
//       and the statement strip all read "--";
//   (3) the other half, so the "--" cannot be a stuck placeholder: typing 10
//       units (NOT saved) turns all three into the same dollar figure;
//   (4) nothing is written: no PATCH, POST, PUT or DELETE leaves the browser.
//
// Every measurement precedes every capture. UNWIRED: needs a live server, a
// session and a browser.
import { loadPuppeteer } from './lib/puppeteer.mjs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { readFileSync, mkdirSync } from 'node:fs'

const TAG = process.argv[2] ?? 'cvunpriced'
const SHOT_DIR = 'prototypes/contract-value'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }

const puppeteer = await loadPuppeteer('unpriced-contract-value-click')
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const { oppId } = await freshOpportunity(TAG)
let browser
try {
  const d = (await api('GET', `/opportunities/${oppId}`)).data
  check('(1) the route reads the fixture as unpriced', d.total_contract_value === null, `${d.total_contract_value}`)

  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })
  const writes = []
  page.on('request', (q) => { if (['PATCH', 'POST', 'PUT', 'DELETE'].includes(q.method()) && q.url().includes('/api/')) writes.push(`${q.method()} ${q.url()}`) })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // Counterfactual: the cell exists only once the panel has mounted; a fresh
  // tab, so no previous record's figure is in the DOM.
  await page.waitForFunction(() => !!document.getElementById('deal-ssNew') && (document.getElementById('deal-contract-net')?.textContent ?? '').trim().length > 0
    && !document.getElementById('view-opportunity-detail')?.classList.contains('is-loading'), { timeout: 30000 })
  const read = () => page.evaluate(() => ({
    cell: document.getElementById('deal-contract-net')?.textContent?.trim() ?? null,
    total: document.querySelector('[data-testid="stmt-revenue-total"]')?.textContent?.trim() ?? null,
    strip: document.querySelector('[data-testid="stmt-strip-revenue"]')?.textContent?.trim() ?? null,
  }))
  const a = await read()
  check('(2) the stats cell reads "--"', a.cell === '--', JSON.stringify(a.cell))
  check('(2) the statement\'s revenue total reads "--"', a.total === '--', JSON.stringify(a.total))
  check('(2) the statement strip reads "--"', a.strip === '--', JSON.stringify(a.strip))
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.evaluate(() => document.getElementById('deal-contract-net')?.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${SHOT_DIR}/build-1440-unpriced-${TAG}.png` })

  // ── (3) THE OTHER HALF: a priced figure replaces the "--" ──────────────
  await page.click('#deal-ssNew')
  await page.keyboard.press('End')
  const len = await page.$eval('#deal-ssNew', (el) => el.value.length)
  for (let i = 0; i < len; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('10')
  await page.keyboard.press('Tab')
  const moved = await page.waitForFunction(() => /^\$[\d,]+$/.test(document.getElementById('deal-contract-net')?.textContent?.trim() ?? ''), { timeout: 10000 }).then(() => true, () => false)
  const b = await read()
  check('(3) priced by an unsaved edit, the cell shows a dollar figure', moved && /^\$[\d,]+$/.test(b.cell ?? ''), JSON.stringify(b.cell))
  check('(3) and the statement total and strip show the same figure', b.total === b.cell && b.strip === b.cell, JSON.stringify(b))
  check('(4) nothing was written', writes.length === 0, writes.join(' | '))
  check('no uncaught page error', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser?.close()
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
