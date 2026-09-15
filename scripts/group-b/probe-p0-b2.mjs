// B2: locate the white, on an OWNED opportunity's Commercials tab.
//
// Two earlier readings were void and are recorded as such: one photographed
// "Loading the record..." behind a fixed delay (V6), and one measured a
// NON-OWNER read-only record, which has no editable inputs at all and so can
// never show this defect (V25's population clause).
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-b2.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/group-b/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'b2look'
const f = await freshOpportunity(TAG)
console.log(`owned opportunity: ${f.oppId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1300 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), f.oppId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return !!v && !v.classList.contains('hidden') && !/Loading the record/.test(v.textContent || '')
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1500))
  const owned = await p.evaluate(() =>
    !/ANOTHER USER'S RECORD/i.test(document.getElementById('view-opportunity-detail')?.textContent || ''))
  console.log(`  owned by the viewer (door open): ${owned}`)

  await p.click('[data-opp-tab="commercial"]')
  await p.waitForFunction(() => {
    const el = document.getElementById('deal-ssExisting')
    return !!el && el.getBoundingClientRect().height > 0
  }, { timeout: 25000 }).catch(() => console.log('  commercials still did not settle'))
  await new Promise((r) => setTimeout(r, 1500))

  const m = await p.evaluate(() => {
    const light = (c) => {
      const x = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '')
      return x ? (+x[1] + +x[2] + +x[3]) / 3 > 140 : false
    }
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const ctrls = [...document.querySelectorAll('input,select,textarea')].filter(vis)
    const white = ctrls.filter((e) => light(getComputedStyle(e).backgroundColor))
    const byCls = {}
    for (const e of white) { const k = e.className || '(no class)'; byCls[k] = (byCls[k] || 0) + 1 }
    return {
      activeTab: document.querySelector('.detail-tab.active')?.textContent ?? null,
      visibleControls: ctrls.length,
      whiteControls: white.length,
      byClass: byCls,
      sample: white.slice(0, 5).map((e) => ({ id: e.id || null, cls: e.className || '(none)' })),
    }
  })
  console.log(`  ${JSON.stringify(m, null, 1).replace(/\n/g, '\n  ')}`)
  await p.screenshot({ path: `${OUT}p0-b2-commercials-owned.png` })
} finally {
  await b.close()
  await tearDown(TAG)
  const db = admin()
  const left = await db.from('records').select('id').eq('id', f.oppId).is('deleted_at', null)
  console.log(`\nteardown: ${left.data?.length ?? '?'} still live`)
}
