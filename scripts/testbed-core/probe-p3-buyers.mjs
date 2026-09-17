// ── ROUND A PHASE 3: THE BUYER LINKS, LIVE ───────────────────────────────
//
// R5's acceptance, all three observable on the real screen, the door both
// ways, and 3.2's seam measured rather than assumed. Against tagged fixtures:
// a Test Bed at Qualification, its Account, a second Account, and contacts
// Alpha (own), Gone (own, deleted OUT OF BAND after load), Foreign (other).
//
//   L1  an unlinked role offers the bed's own Account's contacts only, under the
//       vanilla's label, visible and reachable.
//   L2  (door OPEN) choosing Alpha fires POST /buyer-contacts, accepted; the
//       DATABASE holds the record_contacts row; the role renders read-only with
//       Alpha's name; the Qualification exit row for that role reads met.
//   L3  a REAL refusal: Gone is deleted through its route after the page
//       loaded, so choosing it is refused 404 by the server; the message renders
//       under THAT role only; the database holds no link.
//   L4  3.2: "+ New" opens the shell's shared modal; filling it creates,
//       links, qualifies and links in the role (four real requests); the
//       DATABASE holds the link; and the screen is measured for whether the row
//       shows it WITHOUT a manual reload.
//   L5  (door CLOSED) handed to another owner: the remaining select and "+ New"
//       are inert; a forced change sends nothing; the database is unchanged.
//
// UNWIRED: builds live records and drives a browser.
// Run: TBCORE_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//        node --env-file=.env scripts/testbed-core/probe-p3-buyers.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('probe-p3-buyers.mjs')

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBCORE_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-core/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBCORE-P3-${Date.now()}`
const V = '#view-test-bed-detail'
const COMM = 'Client Commercial Buyer', TECH = 'Client Technical Buyer', LEGAL = 'Client Legal Buyer'
const LABELS = { [COMM]: 'Comm. Buyer', [TECH]: 'Tech. Buyer', [LEGAL]: 'Legal Buyer' }
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))
const linksIn = async (bedId) => must(await db.from('record_contacts').select('role,contact_id').eq('record_id', bedId), 'links')

let fx
try {
  fx = await freshTestBed(TAG)
  const industry = (await api('GET', '/industries')).data[0].id
  const other = (await api('POST', '/accounts', { name: `${TAG} Other Account`, industry_id: industry, billingCountry: 'Singapore' })).data
  const mk = async (label, accountId) => {
    const c = (await api('POST', '/contacts', {
      name: `${TAG} ${label}`, company: `${TAG} Holdings`, email: `${TAG.toLowerCase()}-${label.toLowerCase()}@example.invalid`,
      mobile: '+65 9000 0001', industry_id: industry, source: 'Direct Outreach', jobRole: 'Head of Infrastructure',
      city: 'Singapore', country: 'Singapore', region: 'Asia Pacific' })).data
    await api('POST', `/contacts/${c.id}/link-account`, { account_id: accountId })
    return c.id
  }
  const alpha = await mk('Alpha', fx.accountId)
  const gone = await mk('Gone', fx.accountId)
  const foreign = await mk('Foreign', other.id)
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}; contacts alpha ${alpha} gone ${gone} foreign ${foreign}`)

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
    const boot = async () => {
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
      await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
      await page.reload({ waitUntil: 'networkidle0' })
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-tab-btn-reference"]`), { timeout: 30000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-reference"]`)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-buyer-rows"]`), { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      await frames(page)
    }
    const row = (role) => page.evaluate((v, role) => {
      const r = document.querySelector(`${v} [data-testid="tb-buyer-${role}"]`)
      if (!r) return null
      const sel = r.querySelector('select'); const btn = r.querySelector('button')
      const rect = (sel ?? r).getBoundingClientRect()
      const at = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return { label: r.querySelector('.field-row-label')?.textContent, readonly: r.dataset.readonly === 'true',
        linked: r.querySelector(`[data-testid="tb-buyer-linked-${role}"]`)?.textContent ?? null,
        options: sel ? [...sel.options].slice(1).map((o) => o.value) : null,
        selDisabled: sel?.disabled ?? null, newDisabled: btn?.disabled ?? null,
        height: rect.height, hit: !!at && (at === sel || r.contains(at)),
        feedback: r.querySelector(`[data-testid="tb-buyer-feedback-${role}"]`)?.textContent ?? null }
    }, V, role)

    await boot()
    console.log('\n=== L1 the unlinked rows ===')
    const r1 = await row(COMM)
    check(r1 && r1.label === LABELS[COMM] && !r1.readonly, 'Commercial is unlinked, under the vanilla label', JSON.stringify(r1?.label))
    check(r1 && r1.options.includes(alpha) && r1.options.includes(gone) && !r1.options.includes(foreign), 'it offers the bed\'s own Account\'s contacts and not the other Account\'s', JSON.stringify(r1?.options))
    check(r1 && r1.height > 0 && r1.hit, 'the select is VISIBLE and a click at its centre reaches it')

    console.log('\n=== L2 door OPEN: choose Alpha ===')
    let mark = net.length
    await page.select(`${V} [data-testid="tb-buyer-select-${COMM}"]`, alpha)
    await waitFor(() => since(mark, (n) => n.method === 'POST' && n.url.endsWith('/buyer-contacts') && n.done).length === 1)
    await page.waitForFunction((v, role) => document.querySelector(`${v} [data-testid="tb-buyer-linked-${role}"]`), { timeout: 20000 }, V, COMM).catch(() => {})
    await frames(page)
    const p2 = since(mark, (n) => n.method === 'POST' && n.url.endsWith('/buyer-contacts'))
    check(p2.length === 1 && p2[0].body === JSON.stringify({ role: COMM, contact_id: alpha }) && p2[0].status === 201, 'the choice fired POST /buyer-contacts with { role, contact_id }, accepted', `${p2[0]?.body} ${p2[0]?.status}`)
    const l2 = await linksIn(fx.bedId)
    check(l2.some((l) => l.role === COMM && l.contact_id === alpha), 'the DATABASE holds the link', JSON.stringify(l2))
    const r2 = await row(COMM)
    check(r2 && r2.readonly && r2.linked === `${TAG} Alpha` && r2.options === null, 'the role is READ-ONLY with the contact\'s name, and offers no select', JSON.stringify(r2))
    await page.screenshot({ path: `${OUT}p3-linked-1920.png` })

    console.log('\n=== L3 a REAL refusal: Gone deleted after the page loaded ===')
    const del = await api('DELETE', `/contacts/${gone}`, {})
    check(del.status === 200, 'Gone deleted through its own route, out of band', `status ${del.status}`)
    const geo = (role) => page.evaluate((v, role) => {
      const r = document.querySelector(`${v} [data-testid="tb-buyer-${role}"]`)
      const c = r.querySelector('.tb-buyer-controls')?.getBoundingClientRect()
      const s = r.querySelector('select')?.getBoundingClientRect()
      const f = r.querySelector(`[data-testid="tb-buyer-feedback-${role}"]`)?.getBoundingClientRect()
      const row = r.getBoundingClientRect()
      return { selectWidth: s ? Math.round(s.width) : null, controlsBottom: c ? Math.round(c.bottom) : null,
        feedbackTop: f ? Math.round(f.top) : null, feedbackInside: f ? (f.left >= row.left - 1 && f.right <= row.right + 1) : null }
    }, V, role)
    const before3 = await geo(TECH)
    mark = net.length
    await page.select(`${V} [data-testid="tb-buyer-select-${TECH}"]`, gone)
    await waitFor(() => since(mark, (n) => n.method === 'POST' && n.url.endsWith('/buyer-contacts') && n.done).length === 1)
    await page.waitForFunction((v, role) => document.querySelector(`${v} [data-testid="tb-buyer-feedback-${role}"]`), { timeout: 20000 }, V, TECH).catch(() => {})
    const p3 = since(mark, (n) => n.method === 'POST' && n.url.endsWith('/buyer-contacts'))
    const serverError = p3[0]?.resp ? JSON.parse(p3[0].resp).error : null
    check(p3.length === 1 && p3[0].status === 404, 'the SERVER refused it', `${p3[0]?.status} ${p3[0]?.resp}`)
    const r3 = await row(TECH)
    check(r3?.feedback === serverError && !!serverError, 'the refusal renders under THAT role, in the server\'s words', JSON.stringify(r3?.feedback))
    check((await row(COMM))?.feedback === null && (await row(LEGAL))?.feedback === null, 'and under no other role')
    // A RELATIONSHIP, not a property (Verification 4): the message sits BELOW
    // the controls and the select keeps the width it had before the refusal.
    const after3 = await geo(TECH)
    check(after3.feedbackTop !== null && after3.feedbackTop >= after3.controlsBottom && after3.feedbackInside,
      'the message sits BELOW the controls, inside the row', JSON.stringify(after3))
    check(after3.selectWidth === before3.selectWidth && before3.selectWidth > 100,
      'the select keeps its width when the message appears', `${before3.selectWidth} -> ${after3.selectWidth}`)
    check(!(await linksIn(fx.bedId)).some((l) => l.role === TECH), 'the DATABASE holds no Technical link')
    await page.evaluate((v) => document.querySelector(`${v} [data-testid="tb-buyer-rows"]`).scrollIntoView({ block: 'center' }), V)
    await frames(page)
    await page.screenshot({ path: `${OUT}p3-refused-1920.png` })

    console.log('\n=== L4 3.2: "+ New" through the shell\'s shared modal ===')
    mark = net.length
    await page.click(`${V} [data-testid="tb-buyer-new-${LEGAL}"]`)
    const opened = await waitFor(() => page.evaluate(() => { const m = document.getElementById('inline-buyer-contact-modal'); return !!m && !m.classList.contains('hidden') && m.getBoundingClientRect().height > 0 }), 10000)
    check(opened, 'the shell\'s modal opened from the React row')
    if (opened) {
      const type = async (id, text) => { await page.click(`#${id}`, { clickCount: 3 }); await page.type(`#${id}`, text) }
      await page.waitForFunction(() => document.querySelectorAll('#ibc-industry option').length > 1, { timeout: 10000 })
      await type('ibc-name', `${TAG} Newbie`)
      await page.evaluate(() => { const s = document.getElementById('ibc-industry'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })) })
      await type('ibc-jobrole', 'Head of Infrastructure')
      await type('ibc-email', `${TAG.toLowerCase()}-newbie@example.invalid`)
      await type('ibc-mobile', '+65 9000 0002')
      await type('ibc-address', '1 Fixture Street')
      await type('ibc-city', 'Singapore')
      await type('ibc-postcode', '018956')
      await type('ibc-country', 'Singapore')
      await page.select('#ibc-region', 'APAC')
      await type('ibc-linkedin', 'https://example.invalid/in/newbie')
      await page.select('#ibc-source', 'Direct Outreach')
      await type('ibc-summary', `Fixture for ${TAG}.`)
      await page.click('#inline-buyer-contact-save')
      const closed = await waitFor(() => page.evaluate(() => document.getElementById('inline-buyer-contact-modal').classList.contains('hidden')), 30000)
      const modalError = await page.evaluate(() => { const e = document.getElementById('inline-buyer-contact-error'); return e.classList.contains('hidden') ? null : e.textContent })
      await page.waitForNetworkIdle({ idleTime: 1500, timeout: 30000 })
      const seq = since(mark, (n) => n.method === 'POST').map((n) => `${n.method} ${n.url.replace(/[0-9a-f-]{36}/g, ':id')} ${n.status}`)
      check(closed && !modalError, 'the modal completed and closed', JSON.stringify({ modalError }))
      check(seq.some((s) => /POST \/api\/contacts 201/.test(s)) && seq.some((s) => /link-account 20/.test(s)) && seq.some((s) => /transition 20/.test(s)) && seq.some((s) => /buyer-contacts 201/.test(s)),
        'create, link to the Account, qualify, and link in the role: four real requests, all accepted', seq.join(' | '))
      const l4 = await linksIn(fx.bedId)
      check(l4.some((l) => l.role === LEGAL), 'the DATABASE holds the Legal link', JSON.stringify(l4))
      // THE SEAM QUESTION: does the React row show the link without a manual reload?
      const t0 = Date.now()
      const shown = await waitFor(async () => (await row(LEGAL))?.linked === `${TAG} Newbie`, 10000)
      const r4 = await row(LEGAL)
      const reloadAfterModal = since(mark, (n) => n.method === 'GET' && n.url === `/api/test-beds/${fx.bedId}`).length
      console.log(`  MEASURED  after the modal: GET /test-beds/:id requests since "+ New" = ${reloadAfterModal}; Legal row = ${JSON.stringify(r4)}; waited ${Date.now() - t0}ms`)
      check(shown, 'the Legal row shows the new contact read-only WITHOUT a manual reload', JSON.stringify(r4))
      await page.screenshot({ path: `${OUT}p3-new-contact-1920.png` })
    }

    console.log('\n=== L5 door CLOSED: another owner\'s record ===')
    const otherOwner = must(await db.from('records').select('owner_id').eq('record_type', 'test_bed').is('deleted_at', null).neq('owner_id', OWNER.user.id).limit(1).single(), 'other').owner_id
    await handOver(fx.bedId, otherOwner)
    await boot()
    await page.waitForFunction((v, role) => document.querySelector(`${v} [data-testid="tb-buyer-select-${role}"]`)?.disabled === true, { timeout: 10000 }, V, TECH).catch(() => {})
    const r5 = await row(TECH)
    const before5 = await linksIn(fx.bedId)
    mark = net.length
    await page.evaluate((v, role, id) => {
      const s = document.querySelector(`${v} [data-testid="tb-buyer-select-${role}"]`)
      s.value = id; s.dispatchEvent(new Event('change', { bubbles: true }))
      document.querySelector(`${v} [data-testid="tb-buyer-new-${role}"]`).click()
    }, V, TECH, alpha)
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 })
    const modalOpen = await page.evaluate(() => !document.getElementById('inline-buyer-contact-modal').classList.contains('hidden'))
    check(r5 && r5.selDisabled === true && r5.newDisabled === true, 'the select and "+ New" are inert on an unowned record', JSON.stringify(r5))
    check(since(mark, (n) => n.method === 'POST').length === 0 && JSON.stringify(await linksIn(fx.bedId)) === JSON.stringify(before5), 'a forced change sends NOTHING and the database is unchanged')
    check(!modalOpen, 'a forced click on "+ New" does not open the modal')
    check(net.filter((n) => n.url.endsWith('/buyer-contacts')).length >= 2, 'CALIBRATION: the same listener saw the buyer POSTs earlier in this run')
  } finally {
    await browser.close()
    writeFileSync(`${OUT}p3-network.json`, JSON.stringify(net.map(({ req, ...n }) => n), null, 1))
  }
} finally {
  const r = await tearDown(TAG)
  console.log(`\nteardown: removed ${r.removed.length} (${r.removed.map((x) => x.record_type).join(',')}), remaining ${r.remaining}`)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks PASS`)
  process.exitCode = failed.length ? 1 : 0
}
