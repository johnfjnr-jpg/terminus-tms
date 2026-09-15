// R1 proof: OPEN an editor on every surface the one rule reaches, and measure
// the dress. The white shows only when editing, so a resting screenshot proves
// nothing - that is what made this defect invisible for so long.
//
// FIVE SURFACES, because the rule reaches five: the three in scope and the two
// that merely share the code. Verifying only the intended three is the exact
// mistake the Create bug was.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p1.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, freshTestBed, tearDown, admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/standard-rollout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'srol1'
const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }

const opp = await freshOpportunity(TAG)
const tb = await freshTestBed(TAG)
const db = admin()
console.log(`opportunity ${opp.oppId}\ntest bed ${tb.bedId}\ncontact ${opp.contactId}\naccount ${tb.accountId}\n`)

const light = (bg) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg || ''); return m ? (+m[1] + +m[2] + +m[3]) / 3 > 140 : false }

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  const openAndMeasure = async (label, view, recId, shot) => {
    await p.evaluate((v, r) => navigate(v, r), view, recId)
    const ready = await p.waitForFunction((vid) => {
      const v = document.getElementById(vid)
      return !!v && !v.classList.contains('hidden')
        && !/Loading/.test(v.textContent || '')
        && !!v.querySelector('.field-row-display')
    }, { timeout: 30000 }, view.startsWith('view-') ? view : `view-${view}`).then(() => true).catch(() => false)
    if (!ready) { check(false, `${label}: the surface did not render a field row`); return }
    await new Promise((r) => setTimeout(r, 900))
    const opened = await p.evaluate((vid) => {
      const v = document.getElementById(vid)
      // NOT a readonly row. Some surfaces render display-only rows
      // (`data-readonly="true"`) that have no editor at all, and clicking one
      // does nothing - which reads exactly like the editor being broken.
      // BY CLASS, not by testid prefix. Not every surface's display half
      // carries a `display-` testid - the Account's first editable row does
      // not - and a probe that only knows the testid reads "no editor" on a
      // surface that is working.
      const d = [...v.querySelectorAll('.field-row-display')]
        .find((e) => e.getBoundingClientRect().height > 0
          && e.closest('.field-row')?.getAttribute('data-readonly') !== 'true')
      if (!d) return null
      d.click()
      return d.getAttribute('data-testid') ?? d.closest('.field-row')?.getAttribute('data-field')
    }, `view-${view}`)
    await new Promise((r) => setTimeout(r, 700))
    const m = await p.evaluate((vid) => {
      const v = document.getElementById(vid)
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const el = [...v.querySelectorAll('.field-row-edit input, .field-row-edit select, .field-row-edit textarea')].filter(vis)[0]
      if (!el) return null
      const cs = getComputedStyle(el)
      // ITS OWN row's display half. The first version took the first
      // `.field-row-display` in the whole view, which is a different row and a
      // different size - a comparison between two unrelated things.
      const disp = el.closest('.field-row')?.querySelector('.field-row-display')
      return {
        id: el.getAttribute('data-testid'), bg: cs.backgroundColor, color: cs.color,
        fontSize: cs.fontSize, borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomStyle,
        displayFontSize: disp ? getComputedStyle(disp).fontSize : null,
      }
    }, `view-${view}`)
    if (!m) { check(false, `${label}: no editor opened`); return }
    console.log(`  ${label}: opened ${opened} -> ${JSON.stringify(m)}`)
    check(!light(m.bg), `${label}: the open editor is NOT white (${m.bg})`)
    check(m.fontSize === m.displayFontSize,
      `${label}: the editor matches the display half (${m.fontSize} vs ${m.displayFontSize})`)
    await p.screenshot({ path: `${OUT}${shot}` })
  }

  await openAndMeasure('OPPORTUNITY', 'opportunity-detail', opp.oppId, 'after-opportunity.png')
  await openAndMeasure('TEST BED', 'test-bed-detail', tb.bedId, 'after-testbed.png')
  await openAndMeasure('CONTACT (summary row, shares the code)', 'contact-detail', opp.contactId, 'after-contact.png')
  await openAndMeasure('ACCOUNT', 'account-detail', tb.accountId, 'after-account.png')
} finally {
  await b.close()
  await tearDown(TAG)
  console.log('\nteardown done')
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
