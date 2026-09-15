// Phase 0: prove the white LIVE, in the state it appears in. A FieldRow shows
// display TEXT at rest and renders an input only once OPENED, so a probe that
// measures the resting screen finds nothing - which is what three earlier
// readings did.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/standard-rollout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'srollout'
const f = await freshOpportunity(TAG)
console.log(`owned opportunity ${f.oppId}\n`)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), f.oppId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return !!v && !v.classList.contains('hidden')
      && !/Loading the record/.test(v.textContent || '')
      && !!v.querySelector('[data-testid^="display-"]')
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))

  const atRest = await p.evaluate(() => {
    const v = document.getElementById('view-opportunity-detail')
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    return {
      displayRows: v.querySelectorAll('[data-testid^="display-"]').length,
      visibleInputs: [...v.querySelectorAll('input,select,textarea')].filter(vis).length,
    }
  })
  console.log(`  AT REST: ${JSON.stringify(atRest)}  <- why the earlier readings found no white`)

  const opened = await p.evaluate(() => {
    const v = document.getElementById('view-opportunity-detail')
    const d = v.querySelector('[data-testid^="display-"]')
    if (!d) return null
    d.click()
    return d.getAttribute('data-testid')
  })
  await new Promise((r) => setTimeout(r, 800))
  const m = await p.evaluate(() => {
    const v = document.getElementById('view-opportunity-detail')
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    return [...v.querySelectorAll('.field-row-edit input, .field-row-edit select, .field-row-edit textarea')]
      .filter(vis).map((e) => {
        const cs = getComputedStyle(e)
        return { id: e.getAttribute('data-testid'), cls: e.className || '(NO CLASS)', bg: cs.backgroundColor }
      })
  })
  console.log(`  OPENED ${opened}: ${JSON.stringify(m)}`)
  const white = m.filter((x) => {
    const q = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(x.bg || '')
    return q ? (+q[1] + +q[2] + +q[3]) / 3 > 140 : false
  })
  console.log(`  => ${white.length ? 'WHITE CONFIRMED on the open editor' : 'no white found'}`)
  await p.screenshot({ path: `${OUT}p0-before-opportunity.png` })
} finally {
  await b.close()
  await tearDown(TAG)
  console.log('\nteardown done')
}
