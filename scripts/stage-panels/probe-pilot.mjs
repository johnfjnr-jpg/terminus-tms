// ── STAGE PANELS PILOT, LIVE ────────────────────────────────────────────
//
// An owned tagged Test Bed carrying Qualification scores, so R4 has something to
// show on a stage the gate asks nothing of. At 1440 AND 1240 on Pre-Site
// Assessment: the ruled order and the measured widths, the relocated approvals
// with their approver names, a re-score recorded and read back, the NDA row
// still confirmable, an approval still grantable. Then the other six
// non-terminal stages at 1440, and Closed.
//
// UNWIRED. Run: TBSP_RUN=<label> PUPPETEER_PATH=... PUPPETEER_EXECUTABLE_PATH=... \
//   node --env-file=.env scripts/stage-panels/probe-pilot.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const puppeteer = await loadPuppeteer('stage-panels/probe-pilot.mjs')
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const RUN = process.env.TBSP_RUN ?? process.env.TBCORE_RUN
if (!RUN || !/^[a-z0-9-]+$/.test(RUN)) { console.error('TBSP_RUN is required'); process.exit(2) }
const OUT = `${ROOT}/.verify/tb-stage-panels/${RUN}/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = `TBSP-${Date.now()}`
const V = '#view-test-bed-detail'
const PRE = 'Pre-Site Assessment'
const checks = []
const check = (ok, what, detail = '') => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const payloadOf = async (id) => (must(await db.from('record_revisions').select('revision_number,payload')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'payload') ?? {}).payload ?? {}
const evidence = {}
let fx
try {
  fx = await freshTestBed(TAG)
  const staff = must(await db.from('terminus_staff').select('name').limit(3), 'staff')
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  // The approvers this Test Bed names: two set, Legal deliberately empty.
  await call('PATCH', `/test-beds/${fx.bedId}`, { payload: {
    commercialAuthority: staff[0].name, technicalAuthority: staff[1].name, terminusLegalOwner: '',
  }, expected_revision: rev })
  // Real scores at Qualification, through the route, so R4 has its material.
  for (const [criterion, score] of [['scoreRolloutPath', 4], ['scoreDataRights', 3]]) {
    // The route takes ONE FLAT entry (Round A Phase 2's contract), not a wrapper.
    const r = await call('POST', `/test-beds/${fx.bedId}/scores`, { criterion, score })
    if (r.status >= 300) throw new Error(`scoring ${criterion}: ${r.status} ${JSON.stringify(r.data)}`)
  }
  await call('POST', `/records/${fx.bedId}/transition`, { to_stage: PRE }).then(() => {})
  const beforeStage = must(await db.from('records').select('status').eq('id', fx.bedId).single(), 'status').status
  console.log(`run ${RUN}; fixture ${TAG} bed ${fx.bedId}; stage after the transition attempt: ${beforeStage}`)

  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))
    const net = []
    page.on('request', (r) => { if (r.url().includes('/api/')) net.push({ method: r.method(), url: r.url().replace('http://localhost:3000', ''), body: r.postData() ?? null, req: r, done: false }) })
    page.on('requestfinished', async (r) => { const e = net.find((n) => n.req === r); if (!e) return; e.status = r.response()?.status() ?? null; try { e.resp = await r.response()?.text() } catch { e.resp = null } e.done = true })
    const waitFor = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
    await page.setViewport({ width: 1440, height: 1100 })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
    await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
    await page.reload({ waitUntil: 'networkidle0' })
    const open = async (stage) => {
      await page.evaluate((id) => navigate('test-bed-detail', id), fx.bedId)
      await page.waitForFunction((v, t) => { const h = document.querySelector(`${v} [data-testid="tb-detail-name"]`); return h && h.textContent.includes(t) }, { timeout: 30000 }, V, TAG)
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 30000 })
      await page.click(`${V} [data-testid="tb-tab-btn-stage-${stage}"]`)
      await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-tab-stage-detail"]`), { timeout: 20000 }, V)
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      await frames()
    }
    const readRow = () => page.evaluate((v) => {
      const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
      const row = document.querySelector(`${v} [data-testid="tb-stage-panels-row"]`)
      const kids = row ? [...row.children].map((c) => ({ id: c.getAttribute('data-testid'), box: box(c), hidden: c.hidden })) : []
      const criteria = document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)
      const approvalsSection = document.querySelector(`${v} [data-testid="tb-stage-approvals-section"]`)
      return {
        rowBox: box(row),
        children: kids,
        insideCriteria: !!(criteria && approvalsSection && criteria.contains(approvalsSection)),
        approverLines: ['Commercial', 'Technical', 'Legal'].map((t) => document.querySelector(`${v} [data-testid="tb-stage-approver-${t}"]`)?.textContent.trim() ?? null),
        scoringSelects: [...document.querySelectorAll(`${v} [data-testid^="tb-score-select-"]`)].map((s) => s.getAttribute('data-testid')),
        documentsPresent: !!document.querySelector(`${v} [data-testid="tb-stage-documents-section"]`),
        trackRows: document.querySelectorAll(`${v} [data-testid="tb-stage-tracks"] *[data-track], ${v} [data-testid="tb-stage-approval-row"] .data-row`).length,
      }
    }, V)

    for (const width of [1440, 1240]) {
      await page.setViewport({ width, height: 1100 })
      await open(PRE)
      const r = await readRow()
      evidence[`preSite${width}`] = r
      console.log(`\n=== Pre-Site Assessment at ${width} ===`)
      console.log(`  row ${JSON.stringify(r.rowBox)}`)
      for (const k of r.children) console.log(`    ${String(k.id).padEnd(30)} ${JSON.stringify(k.box)}`)
      console.log(`  approver lines: ${JSON.stringify(r.approverLines)}`)
      console.log(`  scoring offers: ${JSON.stringify(r.scoringSelects)}`)
      const ids = r.children.map((c) => c.id)
      check(ids.join() === 'tb-stage-scoring-card,tb-stage-documents-section,tb-stage-exit-criteria-list',
        `${width}: the row is scoring, documents, exit criteria, in that order`, ids.join(' -> '))
      const [sc, doc, crit] = r.children.map((c) => c.box)
      check(sc.w === r.rowBox.w, `${width}: scoring spans the whole row`, `${sc.w} of ${r.rowBox.w}`)
      check(doc.y === crit.y && doc.y > sc.y, `${width}: documents and exit criteria sit BESIDE each other, below scoring`, JSON.stringify({ scoringY: sc.y, docY: doc.y, critY: crit.y }))
      const expected = width === 1440 ? [530, 530] : [430, 430]
      check(Math.abs(doc.w - expected[0]) <= 2 && Math.abs(crit.w - expected[1]) <= 2,
        `${width}: the pair measures ${expected[0]} and ${expected[1]} as the split predicts`, `${doc.w} and ${crit.w}`)
      check(doc.w >= 301 && crit.w >= 301, `${width}: both clear the documents floor of 301px`, `${doc.w}, ${crit.w}`)
      check(sc.w >= 414, `${width}: scoring clears its 414px floor`, String(sc.w))
      check(r.insideCriteria, `${width}: the approvals are inside the exit criteria panel`)
      check(r.approverLines[0]?.includes(staff[0].name) && r.approverLines[1]?.includes(staff[1].name)
        && /no approver named/i.test(r.approverLines[2] ?? ''), `${width}: each track names its approver, and an empty field says so`, JSON.stringify(r.approverLines))
      check(r.scoringSelects.join() === 'tb-score-select-scoreRolloutPath,tb-score-select-scoreDataRights'
        || r.scoringSelects.join() === 'tb-score-select-scoreDataRights,tb-score-select-scoreRolloutPath',
        `${width}: R4 offers exactly the two criteria already scored`, JSON.stringify(r.scoringSelects))
      check(r.documentsPresent, `${width}: Pre-Site Assessment has a document, so its panel renders`)
      await page.screenshot({ path: `${OUT}pilot-pre-site-${width}.png` })
      // A second capture with the PAIR in frame: the first shows the scoring
      // card spanning the row, and the pair sits below the fold at both widths.
      // Measure first, capture second (Verification 4).
      const pairShot = await page.evaluate((v) => {
        const doc = document.querySelector(`${v} [data-testid="tb-stage-documents-section"]`)
        doc?.scrollIntoView({ block: 'center' })
        const d = doc?.getBoundingClientRect()
        const c = document.querySelector(`${v} [data-testid="tb-stage-exit-criteria-list"]`)?.getBoundingClientRect()
        return d && c ? { docTop: Math.round(d.top), critTop: Math.round(c.top), vh: innerHeight } : null
      }, V)
      check(!!pairShot && pairShot.docTop >= 0 && pairShot.docTop < pairShot.vh,
        `${width}: the pair is inside the second capture`, JSON.stringify(pairShot))
      await frames()
      await page.screenshot({ path: `${OUT}pilot-pre-site-pair-${width}.png` })
    }

    console.log('\n=== the writes still work, at 1440 ===')
    await page.setViewport({ width: 1440, height: 1100 })
    await open(PRE)
    // A re-score through the real control.
    const before = await payloadOf(fx.bedId)
    let mark = net.length
    await page.select(`${V} [data-testid="tb-score-select-scoreRolloutPath"]`, '5')
    await page.waitForFunction((v) => document.querySelector(`${v} [data-testid="tb-score-reason-scoreRolloutPath"]`), { timeout: 10000 }).catch(() => {})
    const reason = await page.$(`${V} [data-testid="tb-score-reason-scoreRolloutPath"]`)
    if (reason) { await reason.click(); await page.type(`${V} [data-testid="tb-score-reason-scoreRolloutPath"]`, 'the rollout path improved after the site visit') }
    await page.click(`${V} [data-testid="tb-score-record"]`)
    await waitFor(() => net.slice(mark).some((n) => n.method === 'POST' && n.url.endsWith('/scores') && n.done))
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 20000 })
    const post = net.slice(mark).find((n) => n.method === 'POST' && n.url.endsWith('/scores'))
    const after = await payloadOf(fx.bedId)
    const series = after.scoreRolloutPath ?? []
    check(post?.status === 201 && series.length === (before.scoreRolloutPath ?? []).length + 1 && series.at(-1).value === 5,
      'a re-score is recorded through the real control and read back from the database', JSON.stringify({ status: post?.status, entries: series.length, last: series.at(-1) }))
    // The server stamps the RECORD's stage, not the tab being viewed, and the
    // gate refused this record's transition, so it is still at Qualification.
    // Asserted against the record rather than against the tab.
    const recStage = must(await db.from('records').select('status').eq('id', fx.bedId).single(), 'stage').status
    check(series.at(-1)?.stage === recStage, 'and it carries the stage the RECORD is at, which is what the server stamps', `entry ${series.at(-1)?.stage}, record ${recStage}`)
    // The NDA row still confirms.
    mark = net.length
    const confirm = await page.$(`${V} [data-testid="tb-stage-documents-section"] button`)
    check(!!confirm, 'the NDA row still offers its Confirm control')
    if (confirm) {
      await confirm.click()
      await waitFor(() => net.slice(mark).some((n) => n.method === 'POST' && n.url.includes('complete-document') && n.done))
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      const c = net.slice(mark).find((n) => n.url.includes('complete-document'))
      const docs = must(await db.from('records').select('id,status').eq('record_type', 'document').eq('parent_record_id', fx.bedId).is('deleted_at', null), 'documents')
      check(!!c && c.status >= 200 && c.status < 300 && docs.length >= 1, 'and confirming it writes a document record', `${c?.status}, ${docs.length} document row(s): ${docs.map((d) => d.status).join()}`)
    }
    // An approval, from the relocated list. The record is handed away first,
    // because the route refuses an owner approving their own record.
    const otherUser = must(await db.from('track_approvers').select('user_id').limit(1), 'another user')[0].user_id
    await handOver(fx.bedId, otherUser)
    // The track list offers an approve control only on the stage the record is
    // AT: elsewhere each track reads "Not yet at this stage". So the grant is
    // driven where it exists, which is the record's own stage.
    const currentStage = must(await db.from('records').select('status').eq('id', fx.bedId).single(), 'stage').status
    await open(currentStage)
    mark = net.length
    // The track list's control is a CLICKABLE ROW, not a button (StageTrackList).
    const approveBtn = await page.$(`${V} [data-testid="tb-stage-approvals-section"] .sa-approval-row.clickable`)
    check(!!approveBtn, 'the relocated track list still offers its approve control (a clickable track row)')
    if (approveBtn) {
      await approveBtn.click()
      await waitFor(() => net.slice(mark).some((n) => n.method === 'POST' && n.url.includes('/approvals') && n.done))
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 })
      const a = net.slice(mark).find((n) => n.method === 'POST' && n.url.includes('/approvals'))
      const rows = must(await db.from('approvals').select('track,decision,stage').eq('record_id', fx.bedId), 'approvals')
      check(a?.status === 201 && rows.length >= 1, 'and an approval granted there is in the database', `${a?.status}; ${JSON.stringify(rows)}`)
    }

    console.log('\n=== the other stages at 1440 ===')
    const stages = (await call('GET', '/stage-definitions?record_type=test_bed')).data.sort((a, b) => a.sort_order - b.sort_order).map((s) => s.stage_name)
    const expectedDocs = { Qualification: false, 'Pre-Site Assessment': true, 'Site Assessment': true, 'Installation and Commissioning': true, 'Monitoring and Analysis': true, 'Review and Completion': true, Decommissioning: true, Closed: false }
    console.log('| stage | row | order | scoring | documents | expected documents |')
    console.log('|---|---|---|---|---|---|')
    for (const stage of stages) {
      await open(stage)
      const r = await readRow()
      evidence[`stage:${stage}`] = r
      const ids = r.children.map((c) => c.id)
      const scoring = r.children.find((c) => c.id === 'tb-stage-scoring-card')
      console.log(`| ${stage} | ${r.rowBox ? 'yes' : 'none'} | ${ids.join(' -> ') || '-'} | ${scoring ? (scoring.hidden ? 'hidden' : `${r.scoringSelects.length} criteria`) : 'absent'} | ${r.documentsPresent} | ${expectedDocs[stage]} |`)
      if (stage === 'Closed') {
        check(!r.rowBox && !r.documentsPresent, 'Closed renders no panel row at all', JSON.stringify({ row: r.rowBox, docs: r.documentsPresent }))
      } else {
        check(!!r.rowBox && ids[0] === 'tb-stage-scoring-card' || ids[0] === 'tb-stage-documents-section' || ids[0] === 'tb-stage-exit-criteria-list',
          `${stage}: the panels are in the row`, ids.join(' -> '))
        check(r.documentsPresent === expectedDocs[stage], `${stage}: documents exactly per the configuration table`, `${r.documentsPresent} vs ${expectedDocs[stage]}`)
        if (stage === 'Installation and Commissioning') {
          const install = await page.evaluate((v) => {
            const el = document.querySelector(`${v} [data-testid="tb-stage-install-section"]`)
            const row = document.querySelector(`${v} [data-testid="tb-stage-panels-row"]`)
            if (!el || !row) return null
            const a = el.getBoundingClientRect(); const b = row.getBoundingClientRect()
            return { installW: Math.round(a.width), rowW: Math.round(b.width), below: a.top >= b.bottom - 1, hidden: el.hidden }
          }, V)
          check(!!install && !install.hidden && install.installW === install.rowW && install.below,
            'R5: the install section is full width BELOW the panel row', JSON.stringify(install))
          await page.screenshot({ path: `${OUT}pilot-installation-1440.png` })
        }
        if (stage === 'Qualification') await page.screenshot({ path: `${OUT}pilot-qualification-1440.png` })
      }
    }
  } finally { await browser.close() }
} catch (e) {
  console.log(`  FAIL  the probe did not complete: ${e.message}`)
  checks.push({ ok: false, what: 'the probe completed' })
} finally {
  writeFileSync(`${OUT}evidence.json`, JSON.stringify(evidence, null, 2))
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length} (${t.removed.map((r) => r.record_type).join(',')}), remaining ${t.remaining}`) }
}
const passed = checks.filter((c) => c.ok).length
console.log(`\n${passed}/${checks.length} checks PASS`)
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1)
