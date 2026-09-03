import { loadPuppeteer } from './lib/puppeteer.mjs'
import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'
const puppeteer = await loadPuppeteer('lay')
const session = JSON.parse(readFileSync('session-ref.json','utf8'))
const { oppId } = await freshOpportunity(process.argv[2] ?? 'R41LAY')
// FACTORING ON IN THE PAYLOAD, not by clicking. The click depends on wiring
// that is not attached at the moment the probe reaches it, and a probe that
// cannot open the panel measures 0x0 boxes and calls it a clean layout.
const rev = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { ssNew: 10, duration: 36, recoveryMonths: 24,
             factoring: { enabled: true, ratePct: 1.5, termMonths: 12, method: 'straight' } },
  expected_revision: rev })
const b = await puppeteer.launch({ headless:'new' }); const p = await b.newPage()
await p.goto('http://localhost:3000/', { waitUntil:'domcontentloaded' })
await p.evaluate((k,v)=>localStorage.setItem(k,v),'sb-anvildouaacbhsjytkii-auth-token',JSON.stringify(session))
for (const w of [1240, 1920, 3440]) {
  await p.setViewport({ width: w, height: 900 })
  await p.reload({ waitUntil:'networkidle0' })
  await p.evaluate(id => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => !!document.getElementById('deal-factoring-toggle'), { timeout:25000 })
  await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await p.waitForFunction(() => {
    const ff = document.getElementById('deal-factoring-fields')
    const r = document.getElementById('deal-factoring-ratePct')?.getBoundingClientRect()
    return ff && !ff.classList.contains('hidden') && r && r.width > 0
  }, { timeout:20000 })
  const m = await p.evaluate(() => {
    const rc = (id) => { const e = document.getElementById(id); if (!e) return null
      const r = e.getBoundingClientRect()
      return r.width === 0 && r.height === 0 ? null : { y: Math.round(r.y), w: Math.round(r.width) } }
    const row = document.getElementById('deal-top-schedule-row').getBoundingClientRect()
    const ff  = document.getElementById('deal-factoring-fields').getBoundingClientRect()
    const rate = rc('deal-factoring-ratePct'), term = rc('deal-factoring-termMonths')
    const meth = rc('deal-factoring-method-toggle')
    const items = [...document.getElementById('deal-top-schedule-row').children]
      .filter(e => e.getBoundingClientRect().width > 0)
      .map(e => ({ id: e.id || e.className.slice(0,18), w: Math.round(e.getBoundingClientRect().width),
                   y: Math.round(e.getBoundingClientRect().y) }))
    return {
      items,
      rowH: Math.round(row.height),
      span: Math.round(ff.bottom - row.top),
      // BOTH SIDES MUST EXIST before the comparison means anything.
      sameLine: !!rate && !!term && Math.abs(rate.y - term.y) < 4,
      rateY: rate?.y ?? null, termY: term?.y ?? null, methodY: meth?.y ?? null,
      rateW: rate?.w ?? null, termW: term?.w ?? null,
      overflow: document.body.scrollWidth > document.body.clientWidth,
    }
  })
  console.log('   row items:', JSON.stringify(m.items))
  console.log(`${w}: rowH=${m.rowH} span=${m.span}px  rate/term same line=${m.sameLine} (rateY=${m.rateY} termY=${m.termY}, w=${m.rateW}/${m.termW})`
    + `  methodY=${m.methodY}  overflow=${m.overflow}`)
}
await b.close(); await tearDown()
