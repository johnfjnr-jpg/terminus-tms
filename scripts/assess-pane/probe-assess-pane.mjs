// ASSESSMENT PANE FIXES Phase 2: the proof for F1, F2 and F3.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/assess-pane/probe-assess-pane.mjs
//
//   AP_ONLY=frozen,withdraw,f2,f3,census   run only these sections (default all)
//   AP_OUT=<dir>                           where screenshots and the census go
//   AP_LABEL=<run>                         artefacts are named after the run
//
// UNWIRED, deliberately: a round proof that builds its own fixtures through the
// real API, freezes one with a real transition request, and reads two named
// live records it does not own. Recorded here as unwired with that reason.
//
// What each section asserts, every read taken after a SETTLED wait (750ms with
// no mutation, then two frames), so a door sweep that ran after the pane and
// undid its `disabled` would fail the read rather than slip past it:
//
//   frozen    John's own record, frozen by an open request to Proposal. All
//             five lenses by mouse: the sub-tab switches the pane, a level click
//             drafts nothing, a reason click and keystroke change nothing. By
//             keyboard: Tab from the sub-tab never lands on a pane input. 0
//             writes. The bar's frozen line is in the viewport beside the pane at
//             1240, 1440 and 1920, and Save and Cancel are disabled. A draft
//             made BEFORE the freeze shows its figure and currency disabled.
//   withdraw  The banner's own Withdraw, in the page: the pane becomes editable
//             with no navigation by the probe, and a score saves with 201.
//   f2        Three drafts, one owing a reason. Two POST with 201, the third is
//             not sent, stays a draft, and the bar names it.
//   f3        Two not-mine records. Neither panel is marked inert; every lens
//             sub-tab switches its pane; Reference navigation is reachable; 0
//             enabled inputs, 0 enabled non-navigation buttons; 0 writes.
//   census    An owned record: every control's door-relevant state in both
//             panels, written to a file a calibration run compares.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { enumerateControlsInPage, classifyControl } from '../lib/enumerate-controls.mjs'

const puppeteer = await loadPuppeteer('assess-pane/probe-assess-pane.mjs')
const ONLY = new Set((process.env.AP_ONLY ?? 'frozen,withdraw,f2,f3,census').split(','))
const OUT = process.env.AP_OUT ?? '.verify/assess-pane'
const LABEL = process.env.AP_LABEL ?? 'run'
mkdirSync(OUT, { recursive: true })
const TAG = 'APANE' + Date.now().toString(36).toUpperCase()
const NOT_MINE = ['32f608a9-f90b-4144-9f07-71adb1c43c40', '5e5ca23d-bfe5-4383-828f-726aeaeb6146']
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
let pass = 0, fail = 0
const check = (ok, what) => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`) }
const fixtures = []

const b = await puppeteer.launch({ headless: 'new' })

const settle = (p) => p.evaluate(() => new Promise((res) => {
  let t; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 750) })
  const done = () => { mo.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => res(true))) }
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); t = setTimeout(done, 750)
}))

// QUIESCED, not merely settled. One in-page reopen or withdraw loads the record
// MORE THAN ONCE (the navigation, then a pulse-driven reload), and every load
// nulls oppOpenRequest before awaiting it, so a mount from one load can render
// while the next has nulled the value. Measured: reads taken at the first
// rebuild passed on one run and failed on the next with the code unchanged.
// The claim is about where the screen comes to rest, so the read waits for the
// network to go quiet and then for the DOM to settle.
const quiesce = async (p) => {
  await p.waitForNetworkIdle({ idleTime: 1500, timeout: 30000 }).catch(() => {})
  await settle(p)
}

const open = async (id, W = 1440) => {
  const p = await b.newPage()
  const writes = []
  let navigations = 0
  p.on('request', (rq) => { if (rq.method() !== 'GET' && rq.url().includes('/api/')) writes.push(`${rq.method()} ${rq.url().replace(/^.*\/api/, '')}`) })
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navigations++ })
  const scores = []
  p.on('response', (rs) => { if (rs.request().method() === 'POST' && /\/scores(\?|$)/.test(rs.url())) scores.push({ status: rs.status(), sent: rs.request().postData() }) })
  await p.setViewport({ width: W, height: 1100 })
  await p.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  const go = async () => {
    await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
    await p.waitForFunction((rid) => currentOppDetailId === rid && Array.isArray(oppCriteria) && Array.isArray(oppLenses), { timeout: 30000 }, id)
    await p.click('#view-opportunity-detail [data-opp-tab="assessment"]')
    await p.waitForFunction(() => document.querySelectorAll('#opp-assessment-mount .sub-tab-panel').length > 0
      && document.getElementById('opp-assess-savebar'), { timeout: 20000 })
    await settle(p)
  }
  await go()
  return { p, writes, scores, nav: () => navigations, go }
}

const lensKeys = (p) => p.evaluate(() => [...document.querySelectorAll('#opp-assessment-mount-strip [data-sub-tab]')].map((t) => t.dataset.subTab))

// A REAL mouse click on the strip, then a wait on the pane that click must
// reveal. Counterfactual: the first lens is selected on mount, so its own
// switch is asserted from a different lens first.
const switchLens = async (p, key) => {
  await p.click(`#opp-assessment-mount-strip [data-sub-tab="${key}"]`)
  return p.waitForFunction((k) => {
    const t = document.querySelector(`#opp-assessment-mount-strip [data-sub-tab="${k}"]`)
    const pane = document.getElementById(`opp-assessment-mount-pane-${k}`)
    return t?.getAttribute('aria-selected') === 'true' && pane && !pane.hidden && pane.getBoundingClientRect().height > 0
  }, { timeout: 3000 }, key).then(() => true).catch(() => false)
}

const latestRevision = async (id) => must(await db.from('record_revisions').select('revision_number')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'revision')[0].revision_number

// Built the way the system builds it: reviewed, moved to Solution Alignment by
// a real raise (no approval track there, so it executes), its exit criteria
// ticked through the real PATCH, then a raise to Proposal that opens and waits.
const toSolutionAlignment = async (tag) => {
  const fx = await freshOpportunity(tag)
  fixtures.push(tag)
  await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
  await api('POST', `/records/${fx.oppId}/transition-requests`, { to_stage: 'Solution Alignment', kind: 'transition' })
  const iso = new Date().toISOString()
  await api('PATCH', `/opportunities/${fx.oppId}`, {
    payload: { exitSolKeyStakeholders: iso, exitSolBuyersKnown: iso, exitSolTechnicalSolution: iso, exitSolTermsReviewed: iso },
    expected_revision: await latestRevision(fx.oppId),
  })
  await api('POST', `/opportunities/${fx.oppId}/assessment-reviewed`, {})
  return fx
}
const freeze = async (oppId) => {
  await api('POST', `/records/${oppId}/transition-requests`, { to_stage: 'Proposal', kind: 'transition' })
  const open = must(await db.from('transition_requests').select('id, to_stage, status').eq('record_id', oppId).eq('status', 'open'), 'open request')
  return open[0] ?? null
}

// Every field the person could type into or choose in the pane, and whether
// it is enabled. Read across ALL five panes, not only the visible one.
const paneFields = (p) => p.evaluate(() => {
  const all = [...document.querySelectorAll('#opp-assessment-mount input, #opp-assessment-mount textarea, #opp-assessment-mount select')]
  return { total: all.length, enabled: all.filter((x) => !x.disabled).map((x) => x.id || x.name) }
})

try {
  // ── FROZEN ─────────────────────────────────────────────────────────────
  let frozenFx = null, request = null
  if (ONLY.has('frozen') || ONLY.has('withdraw')) {
    frozenFx = await toSolutionAlignment(TAG + 'F')
    const status = must(await db.from('records').select('status').eq('id', frozenFx.oppId).single(), 'status').status
    check(status === 'Solution Alignment', `the fixture reached Solution Alignment through the real raise (${status})`)

    // A DRAFT MADE BEFORE THE FREEZE, so the figure and currency render at all:
    // they exist only for a figure-bearing Budget draft. Drafted by a real click
    // while unfrozen, then the request is raised, then the same page reopens the
    // record, which is the path a person takes.
    {
      const s = await open(frozenFx.oppId)
      const budgetLens = await s.p.evaluate(() => document.querySelector('label[for="opp-assess-lv-assessCommBudgetConfirmed-4"]')
        ?.closest('.sub-tab-panel')?.id.replace('opp-assessment-mount-pane-', ''))
      if (budgetLens) await switchLens(s.p, budgetLens)
      await s.p.click('label[for="opp-assess-lv-assessCommBudgetConfirmed-4"]')
      await settle(s.p)
      const before = await s.p.evaluate(() => ({ draft: oppAssessDraft.assessCommBudgetConfirmed ?? null,
        amount: document.getElementById('opp-assess-amount-assessCommBudgetConfirmed')?.disabled ?? 'absent' }))
      check(before.draft === '4' && before.amount === false, `unfrozen: a Budget draft opens an enabled figure box (draft ${before.draft}, figure disabled ${before.amount})`)
      request = await freeze(frozenFx.oppId)
      check(!!request && request.to_stage === 'Proposal', `a request to Proposal is open (${request?.to_stage} ${request?.status})`)
      // Counterfactual: `go()` waits on the record id and the criteria, which
      // the page ALREADY satisfies before the reload lands. The frozen class is
      // the one thing only the new load can produce.
      // And the frozen class lands about 1.3s BEFORE the panes are re-rendered,
      // measured, so the old enabled panes satisfy that wait too. Only the new
      // mount replaces the bar node.
      await s.p.evaluate(() => { window.__barBefore = document.getElementById('opp-assess-savebar') })
      await s.go()
      await s.p.waitForFunction(() => document.getElementById('view-opportunity-detail').classList.contains('is-frozen')
        && document.getElementById('opp-assess-savebar') !== window.__barBefore, { timeout: 20000 }).catch(() => {})
      await quiesce(s.p)
      const after = await s.p.evaluate(() => {
        const st = (id) => { const e = document.getElementById(id); return e ? e.disabled : 'absent' }
        return { frozen: document.getElementById('view-opportunity-detail').classList.contains('is-frozen'),
          draft: oppAssessDraft.assessCommBudgetConfirmed ?? null,
          radio: st('opp-assess-lv-assessCommBudgetConfirmed-4'), amount: st('opp-assess-amount-assessCommBudgetConfirmed'),
          currency: st('opp-assess-currency-assessCommBudgetConfirmed'), reason: st('opp-assess-reason-assessCommBudgetConfirmed'),
          save: st('opp-assess-savebar-record'), cancel: st('opp-assess-savebar-cancel'),
          count: document.getElementById('opp-assess-savebar-count')?.textContent.trim() }
      })
      check(after.frozen && after.draft === '4', `reopened frozen, the earlier draft survives (frozen ${after.frozen}, draft ${after.draft})`)
      check(after.radio === true && after.amount === true && after.currency === true && after.reason === true,
        `level, figure, currency and reason are all disabled (${after.radio}, ${after.amount}, ${after.currency}, ${after.reason})`)
      // Departure 4 as amended at the Phase 2 sign-off: Save disabled while
      // frozen, Cancel LIVE while there is a draft, because it writes nothing.
      check(after.save === true && after.cancel === false, `with a draft: Save disabled, Cancel enabled (${after.save}, ${after.cancel})`)
      // A REAL click on the real Cancel, not a call to its handler.
      //
      // MEASURED: the reopen's second, pulse-driven load lands the record on
      // Reference, so the Assessment panel is display:none and Cancel has no
      // box. That landing is older than this round (queued with finding B), and
      // a person would open Assessment again, so the probe does the same.
      const landed = await s.p.evaluate(() => document.querySelector('#view-opportunity-detail [data-opp-tab].active')?.dataset.oppTab)
      if (landed !== 'assessment') { await s.p.click('#view-opportunity-detail [data-opp-tab="assessment"]'); await settle(s.p) }
      console.log(`  (after the reopen the record had landed on the ${landed} tab)`)
      await s.p.evaluate(() => document.getElementById('opp-assess-savebar-cancel').scrollIntoView({ block: 'center' }))
      // The click's own failure is recorded rather than thrown, so a dead
      // Cancel reaches the clear check below and fails THERE, by name.
      const atCancel = await s.p.evaluate(() => { const c = document.getElementById('opp-assess-savebar-cancel'); const r = c.getBoundingClientRect()
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        let hid = null; for (let e = c; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') { hid = `${e.tagName}#${e.id}.${String(e.className).split(' ')[0]}${e.hidden ? '[hidden]' : ''}`; break }
        return `rect ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} vh ${innerHeight}, pe ${getComputedStyle(c).pointerEvents}, at ${at === c ? 'self' : `${at?.tagName}#${at?.id}.${String(at?.className).split(' ')[0]}`}, bars ${document.querySelectorAll('#opp-assess-savebar').length}, hidden by ${hid}, active tab ${document.querySelector('#view-opportunity-detail [data-opp-tab].active')?.dataset.oppTab}, view shown ${getComputedStyle(document.getElementById('view-opportunity-detail')).display}` })
      const clickErr = await s.p.click('#opp-assess-savebar-cancel').then(() => null).catch((e) => `${e.message} [${atCancel}]`)
      await settle(s.p)
      const cleared = await s.p.evaluate(() => {
        const all = [...document.querySelectorAll('#opp-assessment-mount input, #opp-assessment-mount textarea, #opp-assessment-mount select')]
        const line = document.getElementById('opp-assess-savebar-frozen')
        return { drafts: Object.keys(oppAssessDraft).length, dirty: oppAssessDirtyKeys().length,
          fields: all.length, enabled: all.filter((x) => !x.disabled).length,
          line: line.getBoundingClientRect().height > 0 && line.textContent.startsWith('Frozen: a move to Proposal'),
          bar: document.getElementById('opp-assess-savebar').getBoundingClientRect().height > 0,
          save: document.getElementById('opp-assess-savebar-record').disabled, cancel: document.getElementById('opp-assess-savebar-cancel').disabled }
      })
      check(cleared.drafts === 0 && cleared.dirty === 0, `Cancel clears the draft (${cleared.drafts} drafts, ${cleared.dirty} dirty${clickErr ? `; the click: ${clickErr}` : ''})`)
      check(cleared.fields > 0 && cleared.enabled === 0, `the fields stay disabled (${cleared.fields} fields, ${cleared.enabled} enabled)`)
      check(cleared.line && cleared.bar, `the frozen line stays (${cleared.line}, bar shown ${cleared.bar})`)
      check(cleared.save && cleared.cancel, `with no draft left: Save and Cancel disabled (${cleared.save}, ${cleared.cancel})`)
      check(s.writes.length === 0, `no write was sent, Cancel included (${s.writes.join(', ') || 'none'})`)
      await s.p.close()
    }
  }

  if (ONLY.has('frozen')) {
    console.log('\n== frozen: mouse and keyboard on every lens, 0 writes')
    const s = await open(frozenFx.oppId)
    const keys = await lensKeys(s.p)
    check(keys.length === 5, `five lens sub-tabs (${keys.join(', ')})`)
    const f = await paneFields(s.p)
    check(f.total > 0 && f.enabled.length === 0, `settled: ${f.total} pane fields, ${f.enabled.length} enabled (${f.enabled.slice(0, 4).join(', ')})`)
    const order = [...keys.slice(1), keys[0]]
    let switched = 0, drafted = 0, typed = 0, rows = 0
    for (const k of order) {
      if (await switchLens(s.p, k)) switched++
      await settle(s.p)
      const labels = await s.p.evaluate((k) => [...document.querySelectorAll(`#opp-assessment-mount-pane-${k} label.opp-assess-level`)]
        .filter((l) => !document.getElementById(l.htmlFor)?.checked).map((l) => l.htmlFor), k)
      const seenRows = new Set()
      for (const id of labels) {
        const crit = id.replace(/^opp-assess-lv-/, '').replace(/-[^-]+$/, '')
        if (seenRows.has(crit)) continue
        seenRows.add(crit); rows++
        await s.p.evaluate((id) => document.querySelector(`label[for="${id}"]`).scrollIntoView({ block: 'center' }), id)
        await s.p.click(`label[for="${id}"]`)
        await s.p.click(`#opp-assess-reason-${crit}`).catch(() => {})
        const v0 = await s.p.evaluate((c) => document.getElementById(`opp-assess-reason-${c}`)?.value, crit)
        await s.p.keyboard.type('x')
        const r = await s.p.evaluate((c, v0) => ({ draft: Object.keys(oppAssessDraft).length, reason: Object.keys(oppAssessReason).length,
          changed: document.getElementById(`opp-assess-reason-${c}`)?.value !== v0 }), crit, v0)
        if (r.draft) drafted++
        if (r.reason || r.changed) typed++
      }
    }
    check(switched === 5, `every lens sub-tab switched its pane by mouse (${switched} of 5)`)
    check(rows > 0 && drafted === 0 && typed === 0, `${rows} rows clicked: ${drafted} drafted a level, ${typed} took a keystroke in the reason`)

    // KEYBOARD: from the first lens sub-tab, Tab forward and record every stop.
    await switchLens(s.p, keys[0])
    await s.p.focus(`#opp-assessment-mount-strip [data-sub-tab="${keys[0]}"]`)
    const stops = []
    for (let i = 0; i < 80; i++) {
      await s.p.keyboard.press('Tab')
      stops.push(await s.p.evaluate(() => { const a = document.activeElement
        return { inMount: !!a?.closest('#opp-assessment-mount'), field: /^(INPUT|TEXTAREA|SELECT)$/.test(a?.tagName ?? ''), id: a?.id || a?.className } }))
    }
    const inMount = stops.filter((x) => x.inMount)
    const fields = inMount.filter((x) => x.field)
    check(inMount.length > 0, `Tab reached the pane at all (${inMount.length} stops inside it), so the next line is not vacuous`)
    check(fields.length === 0, `Tab landed on ${fields.length} pane fields (${fields.slice(0, 3).map((x) => x.id).join(', ')})`)
    await settle(s.p)
    const after = await s.p.evaluate(() => ({ draft: Object.keys(oppAssessDraft).length, reason: Object.keys(oppAssessReason).length }))
    check(after.draft === 0 && after.reason === 0, `no draft or reason was recorded by the whole session (${after.draft}, ${after.reason})`)
    check(s.writes.length === 0, `0 writes (${s.writes.join(', ') || 'none'})`)

    // THE BAR, beside the pane, at three widths. Measured first, captured last.
    const want = `Frozen: a move to ${request.to_stage} is awaiting approval. Withdraw the request to edit it.`
    for (const W of [1240, 1440, 1920]) {
      await s.p.setViewport({ width: W, height: 1100 })
      await settle(s.p)
      const m = await s.p.evaluate((k, want) => {
        const pane = document.getElementById(`opp-assessment-mount-pane-${k}`)
        const rows = pane.querySelectorAll('.opp-assess-reason-cell')
        const line = document.getElementById('opp-assess-savebar-frozen')
        const read = () => { const r = line.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return { inView: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight, onTop: at === line || line.contains(at), top: Math.round(r.top) } }
        rows[0].scrollIntoView({ block: 'center' }); const first = read()
        rows[rows.length - 1].scrollIntoView({ block: 'center' }); const last = read()
        rows[0].scrollIntoView({ block: 'center' })
        const save = document.getElementById('opp-assess-savebar-record'), cancel = document.getElementById('opp-assess-savebar-cancel')
        const banner = document.getElementById('opp-freeze-banner').getBoundingClientRect()
        return { text: line.textContent.trim(), match: line.textContent.trim() === want, first, last,
          save: save.disabled, cancel: cancel.disabled, bannerBottom: Math.round(banner.bottom) }
      }, keys[0], want)
      check(m.match, `${W}: the line reads "${m.text}"`)
      check(m.first.inView && m.first.onTop && m.last.inView && m.last.onTop,
        `${W}: it is in the viewport and on top beside the first and the last row (top ${m.first.top} and ${m.last.top}; banner bottom ${m.bannerBottom})`)
      check(m.save && m.cancel, `${W}: Save and Cancel are disabled`)
      await s.p.screenshot({ path: `${OUT}/${LABEL}-frozen-${W}.png` })
    }
    await s.p.setViewport({ width: 1440, height: 1100 })
    await s.p.close()
  }

  // ── WITHDRAW ───────────────────────────────────────────────────────────
  if (ONLY.has('withdraw') && request) {
    console.log('\n== withdraw: the pane becomes editable, a score saves')
    const s = await open(frozenFx.oppId)
    const nav0 = s.nav()
    await s.p.evaluate(() => document.getElementById('opp-freeze-banner').scrollIntoView({ block: 'center' }))
    await s.p.click('#opp-freeze-banner button[onclick^="withdrawRequest"]')
    await s.p.waitForFunction(() => { const i = document.getElementById('change-reason-input'); return i && i.getBoundingClientRect().width > 0 }, { timeout: 5000 })
    await s.p.type('#change-reason-input', 'Probe: withdrawn to prove the pane unfreezes')
    await s.p.click('#change-reason-confirm')
    const thawed = await s.p.waitForFunction(() => !document.getElementById('view-opportunity-detail').classList.contains('is-frozen')
      && !document.querySelector('#opp-assessment-mount .opp-assess-level-input')?.disabled, { timeout: 20000 }).then(() => true).catch(() => false)
    await quiesce(s.p)
    const req = must(await db.from('transition_requests').select('status').eq('id', request.id).single(), 'request')
    check(req.status === 'withdrawn', `the request is withdrawn at the authority (${req.status})`)
    check(thawed, 'the pane became editable')
    check(s.nav() === nav0, `with no navigation or reload (${s.nav() - nav0}); the withdraw itself reloads the record in the page`)
    const st = await s.p.evaluate(() => ({ line: document.getElementById('opp-assess-savebar-frozen')?.classList.contains('hidden'),
      bar: document.getElementById('opp-assess-savebar')?.classList.contains('hidden') }))
    check(st.line && st.bar, `the frozen line and the empty bar are hidden again (${st.line}, ${st.bar})`)
    const f = await paneFields(s.p)
    check(f.enabled.length > 0, `settled: ${f.enabled.length} of ${f.total} pane fields enabled`)
    const lens = await s.p.evaluate(() => document.querySelector('label[for="opp-assess-lv-assessOrgPainOwner-2"]')?.closest('.sub-tab-panel')?.id.replace('opp-assessment-mount-pane-', ''))
    await switchLens(s.p, lens)
    await s.p.click('label[for="opp-assess-lv-assessOrgPainOwner-2"]')
    await s.p.click('#opp-assess-reason-assessOrgPainOwner', { clickCount: 3 })
    await s.p.keyboard.type('Owner unclear after withdrawal')
    await s.p.click('#opp-assess-savebar-record')
    await s.p.waitForFunction(() => /^Saved /.test(document.getElementById('opp-assess-savebar-feedback')?.textContent ?? ''), { timeout: 20000 }).catch(() => {})
    const fb = await s.p.evaluate(() => document.getElementById('opp-assess-savebar-feedback')?.textContent.trim())
    const cur = (await api('GET', `/opportunities/${frozenFx.oppId}`)).data.payload?.assessOrgPainOwner
    check(s.scores.length === 1 && s.scores[0].status === 201, `the score POST answered ${s.scores.map((x) => x.status).join(',') || 'nothing'}`)
    check(Array.isArray(cur) && cur.at(-1)?.reason === 'Owner unclear after withdrawal', `the authority holds it (${JSON.stringify(cur?.at(-1)?.reason)}); bar "${fb}"`)
    await s.p.close()
  }

  // ── F2 and the owned census, on one fresh record at Qualification ──────
  let ownedFx = null
  if (ONLY.has('f2') || ONLY.has('census')) ownedFx = await freshOpportunity(TAG + 'Q').then((x) => { fixtures.push(TAG + 'Q'); return x })

  if (ONLY.has('census')) {
    console.log('\n== census: an owned record, both panels')
    const s = await open(ownedFx.oppId)
    const read = () => s.p.evaluate(() => {
      const out = {}
      for (const pid of ['opp-tab-assessment', 'opp-tab-reference']) {
        const panel = document.getElementById(pid)
        const rows = [panel, ...panel.querySelectorAll('input, textarea, select, button, a[href], [tabindex], [data-door-ti], [aria-disabled]')]
        out[pid] = rows.map((e) => [e.id || `${e.tagName}.${String(e.className).split(' ')[0]}:${e.getAttribute('data-sub-tab') ?? e.getAttribute('name') ?? ''}`,
          e.disabled ?? null, e.getAttribute('tabindex'), e.getAttribute('aria-disabled'), e.classList.contains('is-inert-action')].join('|')).sort()
      }
      return out
    })
    const a = await read()
    await s.p.click('#view-opportunity-detail [data-opp-tab="reference"]'); await settle(s.p)
    const r = await read()
    const census = { assessment: a['opp-tab-assessment'], reference: r['opp-tab-reference'] }
    writeFileSync(`${OUT}/${LABEL}-census.json`, JSON.stringify(census, null, 1))
    check(census.assessment.length > 1 && census.reference.length > 1, `census written: ${census.assessment.length} assessment rows, ${census.reference.length} reference rows`)
    check(s.writes.length === 0, `0 writes (${s.writes.join(', ') || 'none'})`)
    await s.p.close()
  }

  if (ONLY.has('f2')) {
    console.log('\n== f2: one draft owes a reason, the others save')
    const s = await open(ownedFx.oppId)
    const drafts = [['assessOrgChampion', '2', ''], ['assessTechNeedDefinition', '2', 'Need not described'], ['assessLegalProcurementRoute', '2', 'Route not stated']]
    for (const [key, lv, reason] of drafts) {
      const lens = await s.p.evaluate((x) => document.querySelector(`label[for="${x}"]`)?.closest('.sub-tab-panel')?.id.replace('opp-assessment-mount-pane-', ''), `opp-assess-lv-${key}-${lv}`)
      await switchLens(s.p, lens)
      await s.p.click(`label[for="opp-assess-lv-${key}-${lv}"]`)
      if (reason) { await s.p.click(`#opp-assess-reason-${key}`, { clickCount: 3 }); await s.p.keyboard.type(reason) }
    }
    const dirty = await s.p.evaluate(() => oppAssessDirtyKeys())
    check(dirty.length === 3, `three drafts are pending (${dirty.join(', ')})`)
    // The expected sentence is built from the page's own names, not typed.
    const want = await s.p.evaluate(() => {
      const c = oppCriteria.find((x) => x.criterion_key === 'assessOrgChampion')
      return `Saved 2 of 3. Not saved: ${c.name} (${oppLenses.find((l) => l.id === c.lens_id).name}), reason required.`
    })
    // The saves advance the record and the pulse then RELOADS it, which
    // rebuilds the bar. Reading before that reload measures a sentence the
    // person sees for two seconds, so the read waits for the bar node to be
    // replaced and says whether it was.
    await s.p.evaluate(() => { window.__barBefore = document.getElementById('opp-assess-savebar') })
    await s.p.click('#opp-assess-savebar-record')
    await s.p.waitForFunction(() => /^Saved /.test(document.getElementById('opp-assess-savebar-feedback')?.textContent ?? ''), { timeout: 20000 }).catch(() => {})
    const reloaded = await s.p.waitForFunction(() => document.getElementById('opp-assess-savebar') !== window.__barBefore
      && !window.__barBefore.isConnected, { timeout: 10000 }).then(() => true).catch(() => false)
    await quiesce(s.p)
    check(reloaded, `the record's own reload rebuilt the bar after the save (${reloaded}), so the reads below are after it`)
    const m = await s.p.evaluate(() => ({ bar: document.getElementById('opp-assess-savebar-feedback')?.textContent.trim(),
      left: oppAssessDirtyKeys(), row: document.getElementById('opp-assess-feedback-assessOrgChampion')?.textContent.trim() }))
    check(m.bar === want, `the bar reads "${m.bar}"`)
    check(s.scores.length === 2 && s.scores.every((x) => x.status === 201) && !s.scores.some((x) => x.sent.includes('assessOrgChampion')),
      `two POSTs, both 201, none for the skipped draft (${s.scores.map((x) => `${JSON.parse(x.sent).criterion} ${x.status}`).join(', ')})`)
    check(m.left.length === 1 && m.left[0] === 'assessOrgChampion', `the skipped draft stays a draft (${m.left.join(', ')})`)
    check(/reason is required/i.test(m.row ?? ''), `its row says why ("${m.row}")`)
    const pay = (await api('GET', `/opportunities/${ownedFx.oppId}`)).data.payload ?? {}
    check(pay.assessTechNeedDefinition?.length === 1 && pay.assessLegalProcurementRoute?.length === 1 && !pay.assessOrgChampion,
      `the authority holds the two and not the third (${pay.assessTechNeedDefinition?.length}, ${pay.assessLegalProcurementRoute?.length}, ${pay.assessOrgChampion?.length ?? 'none'})`)
    await s.p.evaluate(() => document.getElementById('opp-assess-savebar').scrollIntoView({ block: 'center' }))
    await s.p.screenshot({ path: `${OUT}/${LABEL}-f2.png` })
    await s.p.close()
  }

  // ── F3: reader navigation on not-mine records ──────────────────────────
  if (ONLY.has('f3')) {
    for (const id of NOT_MINE) {
      console.log(`\n== f3: not-mine ${id.slice(0, 8)}`)
      const s = await open(id)
      const notMine = await s.p.evaluate(() => document.getElementById('view-opportunity-detail').classList.contains('is-not-mine'))
      check(notMine, 'the record is not mine (is-not-mine on the view)')
      const panelState = (pid) => s.p.evaluate((pid) => { const e = document.getElementById(pid)
        return { inert: e.classList.contains('is-inert-action'), ariaDisabled: e.getAttribute('aria-disabled'), pe: getComputedStyle(e).pointerEvents } }, pid)
      // A point over the panel's own text, not over a control: an ANCESTOR
      // answering elementFromPoint is what pointer-events none produces.
      const panelReach = (pid) => s.p.evaluate((pid) => {
        const e = document.getElementById(pid)
        const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim() ? 1 : 2 })
        let hit = null, mouseInside = false
        for (let n = w.nextNode(), i = 0; n && i < 400; n = w.nextNode(), i++) {
          const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect()
          if (!b.width || b.top < 0 || b.bottom > innerHeight) continue
          const at = document.elementFromPoint(b.left + 2, b.top + b.height / 2)
          if (!at || at.closest('input,textarea,select,button')) continue
          hit = `${at.tagName}.${String(at.className).split(' ')[0]}`; mouseInside = e.contains(at); break
        }
        // focus() succeeds on tabindex -1 too, so a TAB STOP is required as well.
        e.focus()
        return { hit, mouseInside, focused: document.activeElement === e && Number(e.getAttribute('tabindex')) >= 0, ti: e.getAttribute('tabindex') }
      }, pid)
      const pa = await panelState('opp-tab-assessment')
      check(!pa.inert && pa.ariaDisabled === null && pa.pe !== 'none', `#opp-tab-assessment is not marked (inert ${pa.inert}, aria-disabled ${pa.ariaDisabled}, pointer-events ${pa.pe})`)
      const keys = await lensKeys(s.p)
      let switched = 0
      for (const k of [...keys.slice(1), keys[0]]) if (await switchLens(s.p, k)) switched++
      check(keys.length === 5 && switched === 5, `every lens sub-tab switches its pane (${switched} of ${keys.length})`)
      const ar = await panelReach('opp-tab-assessment')
      check(ar.mouseInside && ar.focused, `assessment: the mouse lands inside the panel (${ar.hit}) and it takes keyboard focus (${ar.focused}, tabindex ${ar.ti})`)
      if (keys[1]) { await switchLens(s.p, keys[1]); await settle(s.p); await s.p.screenshot({ path: `${OUT}/${LABEL}-f3-${id.slice(0, 8)}-assessment.png` }) }
      const census = async (pid) => {
        await settle(s.p)
        const rows = await s.p.evaluate(enumerateControlsInPage, pid)
        const fields = await s.p.evaluate((pid) => { const all = [...document.getElementById(pid).querySelectorAll('input, textarea, select')]
          return { total: all.length, enabled: all.filter((x) => !x.disabled).map((x) => x.id || x.name) } }, pid)
        const buttons = await s.p.evaluate((pid) => [...document.getElementById(pid).querySelectorAll('button, a[href]')]
          .filter((x) => !x.disabled && !x.matches(NON_ACTION_SELECTOR) && !x.closest(NON_ACTION_SELECTOR))
          .filter((x) => !(x.tagName === 'A' && x.getAttribute('tabindex') === '-1'))
          .map((x) => x.id || x.textContent.trim().slice(0, 30)), pid)
        const writes = rows.filter((r) => { const c = classifyControl(r); return c.write && c.reachable && !r.disabled })
        return { rows, fields, buttons, writes }
      }
      const ca = await census('opp-tab-assessment')
      check(ca.fields.total > 0 && ca.fields.enabled.length === 0, `assessment: ${ca.fields.total} fields, ${ca.fields.enabled.length} enabled`)
      check(ca.buttons.length === 0, `assessment: 0 enabled non-navigation buttons (${ca.buttons.join(', ') || 'none'})`)
      check(ca.writes.length === 0, `assessment: 0 reachable write controls by the shared classifier (${ca.writes.map((r) => r.id || r.cls).slice(0, 4).join(', ') || 'none'})`)

      await s.p.click('#view-opportunity-detail [data-opp-tab="reference"]')
      await settle(s.p)
      const pr = await panelState('opp-tab-reference')
      check(!pr.inert && pr.ariaDisabled === null && pr.pe !== 'none', `#opp-tab-reference is not marked (inert ${pr.inert}, aria-disabled ${pr.ariaDisabled}, pointer-events ${pr.pe})`)
      const cr = await census('opp-tab-reference')
      // REFERENCE HOLDS NO NAVIGATION CONTROL on these records: measured, every
      // control in it is a write opener the door correctly kills. What a reader
      // does there is read, focus and select, so "navigation works" is the
      // panel's own reach: the mouse lands INSIDE it, and it takes focus.
      const nr = await panelReach('opp-tab-reference')
      check(nr.mouseInside && nr.focused, `reference: the mouse lands inside the panel (${nr.hit}) and it takes keyboard focus (${nr.focused}, tabindex ${nr.ti})`)
      check(cr.fields.enabled.length === 0, `reference: ${cr.fields.total} fields, ${cr.fields.enabled.length} enabled`)
      check(cr.buttons.length === 0, `reference: 0 enabled non-navigation buttons (${cr.buttons.join(', ') || 'none'})`)
      check(cr.writes.length === 0, `reference: 0 reachable write controls by the shared classifier (${cr.writes.map((r) => r.id || r.cls).slice(0, 4).join(', ') || 'none'})`)
      await s.p.screenshot({ path: `${OUT}/${LABEL}-f3-${id.slice(0, 8)}-reference.png` })
      check(s.writes.length === 0, `0 writes (${s.writes.join(', ') || 'none'})`)
      await s.p.close()
    }
  }
} finally {
  await b.close()
  // Open requests are withdrawn FIRST: a frozen record refuses its own teardown.
  // Enumerated from the DATABASE by the tag every fixture name carries, never
  // from what this run remembers creating (Verification 11).
  const byTag = async (tag) => [...new Set(must(await db.from('record_revisions').select('record_id')
    .like('payload->>name', `${tag}%`), 'fixture revisions').map((r) => r.record_id))]
  for (const tag of fixtures) {
    const ids = await byTag(tag)
    const open = ids.length ? must(await db.from('transition_requests').select('id').in('record_id', ids).eq('status', 'open'), 'open requests') : []
    for (const q of open) await api('POST', `/transition-requests/${q.id}/withdraw`, { reason: 'probe teardown' })
    if (open.length) console.log(`teardown: withdrew ${open.length} open request(s) first`)
    await tearDown(tag)
    const left = ids.length ? must(await db.from('records').select('reference_code, record_type, deleted_at').in('id', ids), 'teardown') : []
    for (const x of left) console.log(`teardown: ${x.record_type} ${x.reference_code ?? ''} deleted_at ${x.deleted_at}`)
    check(left.length > 0 && left.every((x) => !!x.deleted_at), `${tag}: every fixture record is soft-deleted (${left.length})`)
  }
}
console.log(`${pass} of ${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)
