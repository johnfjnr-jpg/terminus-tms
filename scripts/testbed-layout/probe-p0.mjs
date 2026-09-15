import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/testbed-layout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const tb = await freshTestBed('tbl0')
console.log(`test bed ${tb.bedId}\naccount ${tb.accountId}\n`)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1300 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return !!v && !v.classList.contains('hidden') && !!v.querySelector('.field-row-display')
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1500))
  const cards = () => p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    return {
      activeTab: v.querySelector('.detail-tab.active')?.textContent?.trim() ?? null,
      cards: [...v.querySelectorAll('.pg-card-title, .panel-title')].filter(vis).map((e) => e.textContent.trim()).slice(0, 20),
    }
  })
  const ref = await cards()
  console.log(`  REFERENCE (${ref.activeTab}): ${JSON.stringify(ref.cards)}`)
  await p.screenshot({ path: `${OUT}p0-reference.png` })
  // R4 MEASURED FIRST. The previous version clicked the Commercials tab
  // before this, so it censused the screen AFTER navigating away from the
  // panel holding the buyer rows - and reported them absent when a
  // screenshot taken moments earlier shows all three on screen.
  await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const d = [...v.querySelectorAll('.field-row')].find((r) => (r.getAttribute('data-field') || '').startsWith('buyer-'))
    d?.querySelector('.field-row-display')?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  const r4 = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const row = [...v.querySelectorAll('.field-row')].find((r) => (r.getAttribute('data-field') || '').startsWith('buyer-'))
    const sel = row?.querySelector('select')
    return { rowFound: !!row, field: row?.getAttribute('data-field') ?? null,
      isSelect: !!sel, optionCount: sel ? sel.options.length : null }
  })
  console.log(`  R4 buyer row: ${JSON.stringify(r4)}`)
  const census = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    return {
      dataFields: [...v.querySelectorAll('[data-field]')].map((e) => e.getAttribute('data-field')),
      dataKeys: [...v.querySelectorAll('[data-key]')].map((e) => e.getAttribute('data-key')).filter((k) => k.startsWith('buyer')),
      customerCardText: v.querySelector('[data-testid="tb-card-customer"]')?.textContent?.slice(0, 120) ?? null,
    }
  })
  console.log(`  data-field values: ${JSON.stringify(census.dataFields)}`)
  console.log(`  buyer data-keys  : ${JSON.stringify(census.dataKeys)}`)
  console.log(`  Customer card    : ${JSON.stringify(census.customerCardText)}`)

  await p.click('[data-tb-tab="commercials"]')
  await new Promise((r) => setTimeout(r, 1500))
  const com = await cards()
  console.log(`  COMMERCIALS (${com.activeTab}): ${JSON.stringify(com.cards)}`)
  await p.screenshot({ path: `${OUT}p0-commercials.png` })
} finally { await b.close(); await tearDown('tbl0'); console.log('\nteardown done') }
