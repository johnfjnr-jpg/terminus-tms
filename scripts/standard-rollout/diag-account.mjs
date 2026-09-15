import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('diag-account.mjs')
import { readFileSync } from 'node:fs'
import { freshTestBed, tearDown } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const tb = await freshTestBed('sdiag')
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1100 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('account-detail', id), tb.accountId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-account-detail')
    return !!v && !v.classList.contains('hidden') && !!v.querySelector('[data-testid^="display-"]')
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))
  const d = await p.evaluate(() => {
    const v = document.getElementById('view-account-detail')
    const rows = [...v.querySelectorAll('.field-row')]
    const first = rows.find((r) => r.getAttribute('data-readonly') !== 'true')
    const disp = first?.querySelector('.field-row-display')
    return {
      notMine: !!v.querySelector('.is-not-mine') || /ANOTHER USER/i.test(v.textContent || ''),
      totalRows: rows.length,
      readonlyRows: rows.filter((r) => r.getAttribute('data-readonly') === 'true').length,
      firstEditable: first?.getAttribute('data-field') ?? null,
      hasDisplay: !!disp,
      editHalfPresent: !!first?.querySelector('.field-row-edit'),
      editHiddenAttr: first?.querySelector('.field-row-edit')?.hasAttribute('hidden') ?? null,
    }
  })
  console.log('  ' + JSON.stringify(d, null, 1).replace(/\n/g, '\n  '))
  // click it and re-read
  await p.evaluate(() => {
    const v = document.getElementById('view-account-detail')
    const first = [...v.querySelectorAll('.field-row')].find((r) => r.getAttribute('data-readonly') !== 'true')
    first?.querySelector('.field-row-display')?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  const after = await p.evaluate(() => {
    const v = document.getElementById('view-account-detail')
    const first = [...v.querySelectorAll('.field-row')].find((r) => r.getAttribute('data-readonly') !== 'true')
    const e = first?.querySelector('.field-row-edit')
    const inp = e?.querySelector('input,select,textarea')
    return { editHidden: e?.hasAttribute('hidden') ?? null, inputPresent: !!inp,
      inputVisible: inp ? inp.getBoundingClientRect().height > 0 : false,
      bg: inp ? getComputedStyle(inp).backgroundColor : null }
  })
  console.log('  after click: ' + JSON.stringify(after))
} finally { await b.close(); await tearDown('sdiag'); console.log('  torn down') }
