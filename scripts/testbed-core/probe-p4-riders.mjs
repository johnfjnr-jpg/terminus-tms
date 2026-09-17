// ── ROUND A PHASE 4: THE RIDERS, LIVE, AND THE BUYER ROWS' WIDTHS ────────
//
// Against a tagged fixture Test Bed at Qualification, its Account and three
// contacts (Alpha linked as Commercial before load; Gone deleted out of band so
// its link is refused for real; Beta plain):
//
//   F  4.1: Next Stage on a blocked record renders the itemised blocking list in
//      #tb-next-stage-feedback, every item, visible, below the tab row; per R8
//      it SURVIVES a tab switch; a second attempt re-renders the fresh answer.
//   I  4.3: the six identity rows show what GET /test-beds/:id carries, in the
//      vanilla's positions, read-only; Age is Today for a record made minutes ago.
//   W  the buyer rows at 1240, 1920 and 3440 with a linked row, a refused row
//      and a plain row on screen: inside the card, usable selects, "+ New"
//      inside, the message below the controls, no overflow. SELF-CALIBRATED by a
//      browser-only style that makes a select wider than the card.
//   B  4.2: Back to test beds is visible above the title and navigates to the
//      list; on a record handed to another owner it is still live and still works.
//
// UNWIRED: builds live records and drives a browser.
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p4-riders.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p4-riders.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P4-${Date.now()}`
const V = '#view-test-bed-detail'
const COMM = 'Client Commercial Buyer', TECH = 'Client Technical Buyer', LEGAL = 'Client Legal Buyer'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

let fx
try {
  fx = await freshTestBed(TAG)
  const industry = (await api('GET', '/industries')).data[0].id
  const mk = async (label) => {
    const c = (await api('POST', '/contacts', {
      name: `${TAG} ${label}`, company: `${TAG} Holdings`, email: `${TAG.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
      mobile: '+65 9000 0001', industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
      city: 'Singapore', country: 'Singapore', region: 'Asia Pacific' })).data
    await api('POST', `/contacts/${c.id}/link-account`, { account_id: fx.accountId })
    return c.id
  }
  const alpha = await mk('Alpha'); const gone = await mk('Gone'); await mk('Beta')
  await api('POST', `/test-beds/${fx.bedId}/buyer-contacts`, { role: COMM, contact_id: alpha })
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  const net = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1200 })
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => {
      const e = net.find((n) => n.req === r); if (!e) return
      e.status = r.response()?.status() ?? null
      try { e.resp = await r.response()?.text() } catch { e.resp = null }
      e.done = true
    })
    const since = (i, pred) => net.slice(i).filter(pred)
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    const open = async () => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v) => { const e = document.querySelector(v); return e && !e.classList.contains('hidden') && e.querySelector('[data-testid="tb-tab-btn-reference"]') }, { timeout: 30000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
    }
    const tab = async (key, ready) => {
      await page.click(`${V} [data-testid="tb-tab-btn-${key}"]`)
      await page.waitForFunction(ready, { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 })
      await frames(page)
    }
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    await open()

    console.log('\n=== F 4.1: the blocked transition renders ===')
    await tab('stage-Qualification', (v) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"][data-stage="Qualification"]`))
    const feedback = () => page.evaluate((v) => {
      const byId = document.querySelectorAll('#tb-next-stage-feedback')
      const el = byId[0]
      const tabs = document.querySelector(`${v} [data-testid="tb-detail-tabs"]`)?.getBoundingClientRect()
      const r = el?.getBoundingClientRect()
      return { byId: byId.length, sameAsTestid: el === document.querySelector(`${v} [data-testid="tb-next-stage-feedback"]`),
        blocked: !!el && el.textContent.includes('Transition blocked.'), items: el ? el.querySelectorAll('.blocking-list li').length : 0,
        height: r ? Math.round(r.height) : 0, belowTabs: !!(r && tabs && r.top >= tabs.bottom - 1) }
    }, V)
    let mark = net.length
    await page.click(`${V} [data-testid="tb-next-stage-btn"]`)
    await waitFor(() => since(mark, (n) => n.url.endsWith('/transition') && n.done).length === 1)
    await page.waitForFunction(() => document.getElementById('tb-next-stage-feedback')?.querySelector('.blocking-list li'), { timeout: 10000 }).catch(() => {})
    const t1 = since(mark, (n) => n.url.endsWith('/transition'))[0]
    const blocking1 = t1?.resp ? (JSON.parse(t1.resp).blocking ?? []).length : -1
    const f1 = await feedback()
    check(t1?.status === 422 && blocking1 > 0, 'Next Stage was refused 422 with a blocking list', `${t1?.status}, ${blocking1} items`)
    check(f1.byId === 1 && f1.sameAsTestid, 'exactly one #tb-next-stage-feedback, and it is the rendered feedback element')
    check(f1.blocked && f1.items === blocking1, 'the itemised blocking list RENDERS, every item', JSON.stringify(f1))
    check(f1.height > 0 && f1.belowTabs, 'it is visible, below the tab row')
    await page.screenshot({ path: `${OUT}p4-blocked-1920.png` })
    await tab('reference', (v) => document.querySelector(`${v} [data-testid="tb-buyer-rows"]`))
    await tab('stage-Qualification', (v) => document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"][data-stage="Qualification"]`))
    const f2 = await feedback()
    check(f2.blocked && f2.items === blocking1, 'R8: the list SURVIVES a switch to Reference and back', JSON.stringify(f2))
    mark = net.length
    await page.click(`${V} [data-testid="tb-next-stage-btn"]`)
    await waitFor(() => since(mark, (n) => n.url.endsWith('/transition') && n.done).length === 1)
    await frames(page)
    const t2 = since(mark, (n) => n.url.endsWith('/transition'))[0]
    const f3 = await feedback()
    check(t2?.status === 422 && f3.items === (JSON.parse(t2.resp).blocking ?? []).length, 'a second attempt renders its own answer, once (the shell clears at the top of an attempt)', JSON.stringify(f3))

    console.log('\n=== I 4.3: the six identity rows ===')
    await tab('reference', (v) => document.querySelector(`${v} [data-testid="tb-buyer-rows"]`))
    const getBed = JSON.parse([...net].reverse().find((n) => n.done && n.url === `/api/test-beds/${fx.bedId}`).resp)
    const rec = must(await db.from('records').select('reference_code,status,created_at').eq('id', fx.bedId).single(), 'rec')
    const ident = await page.evaluate((v) => {
      const val = (k) => document.querySelector(`${v} [data-testid="display-${k}"]`)?.textContent ?? null
      const keys = (card) => [...document.querySelector(`${v} [data-testid="${card}"]`).querySelectorAll('[data-key]')].map((e) => e.getAttribute('data-key'))
      const ro = ['tb-id-reference', 'tb-id-industry', 'tb-id-stage', 'tb-id-account', 'tb-id-created', 'tb-id-age']
        .every((k) => { const d = document.querySelector(`${v} [data-testid="display-${k}"]`); return d && d.closest('.field-row').getAttribute('data-readonly') === 'true' && d.getAttribute('tabindex') === null && d.getBoundingClientRect().height > 0 })
      return { reference: val('tb-id-reference'), industry: val('tb-id-industry'), stage: val('tb-id-stage'), account: val('tb-id-account'),
        created: val('tb-id-created'), age: val('tb-id-age'), terminus: keys('tb-card-terminus'), customer: keys('tb-card-customer'), dates: keys('tb-card-dates'), readonlyVisible: ro }
    }, V)
    const ddmmyy = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` }
    const daysOld = Math.floor((Date.now() - new Date(rec.created_at).getTime()) / 86400000)
    check(ident.reference === rec.reference_code && ident.stage === rec.status, 'Reference and Stage are the DATABASE\'s', `${ident.reference} / ${ident.stage}`)
    check(ident.industry === getBed.industry?.name && ident.account === getBed.account?.name, 'Industry and Account are what the route returns', `${ident.industry} / ${ident.account}`)
    check(ident.created === ddmmyy(rec.created_at), 'Date Created is created_at as DD/MM/YY', `${ident.created}`)
    check(daysOld === 0 && ident.age === 'Today', 'Age is computed from created_at: minutes old reads Today', `${ident.age}, ${daysOld} whole days`)
    check(ident.terminus[1] === 'tb-id-reference' && ident.terminus.slice(-2).join() === 'tb-id-industry,tb-id-stage'
      && ident.customer[0] === 'tb-id-account' && ident.dates.slice(0, 2).join() === 'tb-id-created,tb-id-age', 'all six sit in the vanilla\'s positions', JSON.stringify({ t: ident.terminus, c: ident.customer[0], d: ident.dates.slice(0, 2) }))
    check(ident.readonlyVisible, 'all six are visible, read-only, and out of the tab order')

    console.log('\n=== W the buyer rows at three widths ===')
    await api('DELETE', `/contacts/${gone}`, {})
    mark = net.length
    await page.select(`${V} [data-testid="tb-buyer-select-${TECH}"]`, gone)
    await waitFor(() => since(mark, (n) => n.url.endsWith('/buyer-contacts') && n.done).length === 1)
    await page.waitForFunction((v, r) => document.querySelector(`${v} [data-testid="tb-buyer-feedback-${r}"]`), { timeout: 10000 }, V, TECH).catch(() => {})
    const measure = () => page.evaluate((v, roles) => {
      const card = document.querySelector(`${v} [data-testid="tb-card-customer"]`).getBoundingClientRect()
      const rows = roles.map((role) => {
        const r = document.querySelector(`${v} [data-testid="tb-buyer-${role}"]`)
        const rr = r.getBoundingClientRect()
        const sel = r.querySelector('select')?.getBoundingClientRect()
        const btn = r.querySelector('button')?.getBoundingClientRect()
        const ctl = r.querySelector('.tb-buyer-controls')?.getBoundingClientRect()
        const fb = r.querySelector(`[data-testid="tb-buyer-feedback-${role}"]`)?.getBoundingClientRect()
        const inCard = (b) => !b || (b.left >= card.left - 1 && b.right <= card.right + 1)
        return { role, linked: !!r.querySelector(`[data-testid="tb-buyer-linked-${role}"]`), inside: inCard(rr) && inCard(sel) && inCard(btn) && inCard(fb),
          selectWidth: sel ? Math.round(sel.width) : null, messageBelow: fb ? fb.top >= ctl.bottom - 1 : null }
      })
      return { cardWidth: Math.round(card.width), rows, docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
    }, V, [COMM, TECH, LEGAL])
    const good = (m) => m.rows.every((r) => r.inside && (r.linked || r.selectWidth >= 100) && r.messageBelow !== false) && !m.docOverflowX
      && m.rows.some((r) => r.linked) && m.rows.some((r) => r.messageBelow === true) && m.rows.some((r) => !r.linked && r.messageBelow === null)
    for (const w of [1240, 1920, 3440]) {
      await page.setViewport({ width: w, height: 1200 })
      await frames(page)
      const m = await measure()
      check(good(m), `${w}: a linked, a refused and a plain buyer row, all inside the card, selects usable, message below, no overflow`, JSON.stringify(m))
      if (w === 1240) {
        await page.evaluate(() => { const s = document.createElement('style'); s.id = 'p4-cal'; s.textContent = '.tb-buyer-controls select { min-width: 2000px }'; document.head.appendChild(s) })
        await frames(page)
        check(!good(await measure()), 'CALIBRATION: a select forced wider than the card makes the width check FIRE')
        await page.evaluate(() => document.getElementById('p4-cal').remove())
        await frames(page)
        check(good(await measure()), 'CALIBRATION: removing it makes it pass again')
      }
      await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-card-customer"]`).scrollIntoView({ block: 'center' }), V)
      await frames(page)
      await page.screenshot({ path: `${OUT}p4-buyers-${w}.png` })
    }
    await page.setViewport({ width: 1920, height: 1200 })
    await frames(page)

    console.log('\n=== B 4.2: Back to test beds ===')
    const back = () => page.evaluate((v) => {
      const b = document.querySelector(`${v} [data-testid="tb-back"]`)
      const t = document.querySelector(`${v} [data-testid="tb-detail-name"]`)
      if (!b) return null
      b.scrollIntoView({ block: 'center' })
      const r = b.getBoundingClientRect()
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { id: b.id, text: b.textContent, disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'),
        pointerEvents: getComputedStyle(b).pointerEvents, height: Math.round(r.height), hit: at === b, aboveTitle: r.bottom <= t.getBoundingClientRect().top + 1 }
    }, V)
    const listShown = () => page.evaluate(() => { const l = document.getElementById('view-test-beds'); const d = document.getElementById('view-test-bed-detail'); return !!l && !l.classList.contains('hidden') && d.classList.contains('hidden') })
    const b1 = await back()
    check(b1 && b1.id === 'btn-back-testbeds' && b1.height > 0 && b1.hit && b1.aboveTitle && !b1.disabled, 'Back to test beds is visible above the title and reachable', JSON.stringify(b1))
    await page.click(`${V} [data-testid="tb-back"]`)
    check(await waitFor(listShown, 10000), 'clicking it shows the test bed list and hides the detail view')

    const otherOwner = must(await db.from('records').select('owner_id').eq('record_type', 'test_bed').is('deleted_at', null).neq('owner_id', OWNER.user.id).limit(1).single(), 'other').owner_id
    await handOver(fx.bedId, otherOwner)
    await open()
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-next-stage-btn"]`)?.disabled === true || document.querySelector(`${v}.is-not-mine`), { timeout: 10000 }, V).catch(() => {})
    const b2 = await back()
    const notMine = await page.evaluate((v) => document.querySelector(v).classList.contains('is-not-mine'), V)
    check(notMine && b2 && !b2.disabled && b2.ariaDisabled !== 'true' && b2.pointerEvents !== 'none' && b2.hit, 'on an UNOWNED record the door leaves Back live', JSON.stringify({ notMine, ...b2 }))
    await page.click(`${V} [data-testid="tb-back"]`)
    check(await waitFor(listShown, 10000), 'and it still navigates to the list')
  } finally {
    await browser.close()
    writeFileSync(`${OUT}p4-network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
  }
} finally {
  const r = await tearDown(TAG)
  console.log(`\nteardown: removed ${r.removed.length} (${r.removed.map((x) => x.record_type).join(',')}), remaining ${r.remaining}`)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks PASS`)
  process.exitCode = failed.length ? 1 : 0
}
