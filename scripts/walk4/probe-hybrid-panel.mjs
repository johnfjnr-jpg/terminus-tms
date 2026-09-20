// R-O4: THE HYBRID REBUILDS TO THE PROTOTYPE, AND ITS SCHEDULE IS WIRED.
//
// TWO CLAIMS, AND THEY FAIL DIFFERENTLY.
//
// 1. LAYOUT. The prototype puts the milestone column and the hosting panel in
//    one grid (`Terminus Ops.dc.html:1632`). `#deal-hybrid-group` had no layout
//    at all, so its two children stacked. The assertion is a RELATIONSHIP -
//    the panels share a top and the left one ends before the right one starts -
//    never `display: grid`, which is true of a grid laid out wrongly.
//
// 2. CONTENT. `hybridSchedule` was the literal `null`. The claim is that the
//    hosting year rows, the total and the note now render, and that the total
//    is the sum of the rows rather than an independently plausible number.
//
// THE FIXTURE IS BUILT THROUGH THE APP'S OWN WRITE PATH, `window.oppPatch`,
// which owns the route, the expected_revision and the 409 retry. A payload
// poked into a revision by hand would be a state the system cannot produce
// (Verification 47), and the point of this probe is a real hybrid deal.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-hybrid-panel.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4hybrid'
const db = admin()
// Verification 8: destructure `error` and throw. A `?? []` here would turn a
// failed read into a zero that reads exactly like a measurement.
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const HYBRID = {
  structure: 'hybrid',
  invoicing: 'annual',
  duration: 36,
  targetMargin: 30,
  ssExisting: 10, ssNew: 5, aqm: 3, hemir: 2,
  inSsExisting: 10, inSsNew: 5, inAqm: 3, inHemir: 2,
  installResp: 'terminus',
  // `usd` is REQUIRED by the route, not optional: the first version of this
  // fixture sent `month` and `pct` only and was refused 400 with "milestones
  // usd must be a non-negative number". The screen derives usd from the pct
  // against the one-off price; the stored row carries both.
  milestones: [
    { month: 1, pct: 40, usd: 40000 },
    { month: 4, pct: 35, usd: 35000 },
    { month: 8, pct: 25, usd: 25000 },
  ],
}

const opp = await freshOpportunity(TAG)
console.log(`opportunity ${opp.oppId}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  const openOpp = async () => {
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      const c = document.getElementById('detail-company')
      return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
  }
  await openOpp()

  // ── THE DEAL IS WRITTEN THROUGH THE APP'S OWN ROUTE ──────────────────
  const wrote = await p.evaluate(async (id, payload) => {
    const r = await window.oppPatch(id, { payload })
    // THE ROUTE'S OWN ANSWER TRAVELS WITH THE FAILURE. Without it a refusal
    // reads as "the write did not land" and says nothing about why, which is
    // the difference between a wrong payload and a broken route.
    return { ok: r.ok, status: r.status, revision: r.data?.revision_number ?? null,
      error: r.data?.error ?? null, body: JSON.stringify(r.data ?? {}).slice(0, 400) }
  }, opp.oppId, HYBRID)
  console.log(`\nwrote the hybrid deal: ok=${wrote.ok} status=${wrote.status} revision=${wrote.revision}`)
  if (!wrote.ok) throw new Error(`the fixture write was refused with ${wrote.status}: ${wrote.error ?? wrote.body}`)

  // ── READ BACK FROM THE DATABASE, before anything on screen is believed ──
  const rev = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'revision')
  const stored = rev[0]?.payload ?? {}
  console.log(`\n=== read back from the database, revision ${rev[0]?.revision_number} ===`)
  for (const k of ['structure', 'invoicing', 'duration', 'ssExisting', 'ssNew', 'aqm', 'hemir']) {
    console.log(`  ${k.padEnd(12)} ${JSON.stringify(stored[k])}`)
  }
  check(stored.structure === 'hybrid',
    'R-O4 the record is a HYBRID deal in the database, not only on screen',
    `structure=${JSON.stringify(stored.structure)}`)
  check(Number(stored.duration) === 36 && Number(stored.ssExisting) === 10,
    'R-O4 and it carries the hosting figures the panel will price',
    `duration=${stored.duration} ssExisting=${stored.ssExisting}`)

  const openCommercials = async () => {
    // A FULL RELOAD, NOT A RE-NAVIGATE. `DealPanel` seeds its UI state with
    // `useState(initialUi)`, which seeds ONCE: navigating back to the same
    // record re-renders the component with a new `initialUi` and the state
    // keeps the value it was first given. Measured - after writing a hybrid
    // deal and re-navigating, the live structure radios still read `twoPhase`
    // as active, so the hybrid group stayed hidden and the wait for it could
    // never be satisfied. This is CLAUDE.md's own recorded `useState(prop)`
    // finding, met from the probe side.
    await p.reload({ waitUntil: 'networkidle0' })
    await openOpp()
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    // WAITING ON THE HYBRID GROUP BEING SHOWN, which only the stored structure
    // can produce. "The panel exists" is satisfied by the hidden non-hybrid
    // state too, so it is the counterfactual this wait must not accept.
    // `getElementById` RETURNS THE RETIRED BLOCK'S COPY. `#deal-hybrid-group`
    // exists twice: once in `#deal-form-vanilla`, which renders nothing, and
    // once where React builds it. The id is duplicated in the document, so the
    // first match is the dead one and this wait could never be satisfied - it
    // timed out at 25s and read as "the hybrid group never appeared".
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
        .find((x) => !x.closest('#deal-form-vanilla'))
      return !!g && !g.classList.contains('hidden')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  const readHybrid = () => p.evaluate(() => {
    // SCOPED THROUGH THE LIVE PANEL. `#deal-hybrid-group` also exists inside
    // the retired `#deal-form-vanilla` block, which renders nothing and
    // answers `querySelector` exactly as the live one does.
    const panel = document.getElementById('opp-tab-commercial')
    const group = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
      .find((g) => !g.closest('#deal-form-vanilla'))
    if (!group) return { present: false }
    const r = (e) => e.getBoundingClientRect()
    const kids = [...group.children].filter((c) => r(c).width > 0)
    const sched = group.querySelector('[data-testid="hybrid-schedule"]')
    const rows = sched ? [...sched.querySelectorAll('.ds-row')] : []
    const txt = (e) => (e?.textContent ?? '').trim()
    const num = (s) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0
    // The last .ds-row is the Total; the ones before it are the years.
    const yearRows = rows.slice(0, -1).map((x) => ({
      label: txt(x.querySelector('.ds-label')), value: num(txt(x.querySelector('.ds-value'))),
    }))
    const totalRow = rows.length ? rows[rows.length - 1] : null
    return {
      present: true,
      panelCount: kids.length,
      panels: kids.map((c) => ({
        top: Math.round(r(c).top), left: Math.round(r(c).left),
        right: Math.round(r(c).right), width: Math.round(r(c).width),
        text: txt(c).slice(0, 40).replace(/\s+/g, ' '),
      })),
      groupRight: Math.round(r(group).right),
      schedulePresent: !!sched,
      label: sched ? txt(sched.querySelector('.label')) : null,
      yearRows,
      totalLabel: totalRow ? txt(totalRow.querySelector('.ds-label')) : null,
      total: totalRow ? num(txt(totalRow.querySelector('.ds-value'))) : null,
      note: sched ? txt([...sched.querySelectorAll('p')].pop()) : null,
    }
  })

  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await openCommercials()
    const h = await readHybrid()
    console.log(`\n=== ${width}px ===`)
    if (!h.present) { check(false, `R-O4 the hybrid group renders at ${width}`); continue }
    h.panels.forEach((x, i) => console.log(`  panel ${i + 1}  top=${x.top} left=${x.left} right=${x.right} width=${x.width}  ${JSON.stringify(x.text)}`))
    console.log(`  schedule: label=${JSON.stringify(h.label)} rows=${h.yearRows.length} total=${h.total}`)
    for (const y of h.yearRows) console.log(`    ${y.label.padEnd(10)} ${y.value}`)
    console.log(`  note: ${JSON.stringify(h.note)}`)

    // ── 1. SIDE BY SIDE, AS A RELATIONSHIP ──────────────────────────────
    const [a, c] = h.panels
    check(h.panelCount === 2, `R-O4 the hybrid group has its two panels at ${width}`, `count=${h.panelCount}`)
    if (a && c) {
      check(Math.abs(a.top - c.top) <= 2,
        `R-O4 the two panels START ON THE SAME LINE at ${width}, so they are side by side and not stacked`,
        `tops ${a.top} and ${c.top}`)
      check(a.right <= c.left + 1,
        `R-O4 and the milestone column ENDS BEFORE the hosting panel begins at ${width}`,
        `left panel right=${a.right}, right panel left=${c.left}`)
      check(c.right <= h.groupRight + 1,
        `R-O4 and the hosting panel stays inside the group at ${width}`,
        `panel right=${c.right}, group right=${h.groupRight}`)
    }

    // ── 2. THE SCHEDULE RENDERS, AND ITS TOTAL IS ITS OWN ROWS ──────────
    check(h.schedulePresent, `R-O4 the hosting schedule renders at ${width}, where it used to be null`)
    check(h.yearRows.length > 0,
      `R-O4 and it has hosting YEAR ROWS at ${width}`, `${h.yearRows.length} rows`)
    check(h.yearRows.every((y) => y.value > 0),
      `R-O4 and every year carries a figure at ${width}, so the rows are priced rather than empty`,
      JSON.stringify(h.yearRows.map((y) => y.value)))
    // A RELATIONSHIP, not a hardcoded expectation: the total is the rows.
    const summed = h.yearRows.reduce((s, y) => s + y.value, 0)
    check(h.total !== null && Math.abs(summed - h.total) <= 1,
      `R-O4 and the TOTAL is the sum of its own year rows at ${width}`,
      `rows sum to ${summed}, total reads ${h.total}`)
    check(/hosting/i.test(h.label ?? ''),
      `R-O4 the schedule is labelled as HOSTING at ${width}, hardware being milestone-driven here`,
      JSON.stringify(h.label))
    check(/outside the milestones/i.test(h.note ?? ''),
      `R-O4 and the note explaining why is present at ${width}`)

    // MEASURED ABOVE, CAPTURED HERE, AND SCROLLED ONLY NOW. The hybrid group
    // sits around y=2147, so a viewport capture taken where the page loads is
    // a picture of the record band: every assertion passes on it and the image
    // shows nothing of the claim. CLAUDE.md's own clause - confirm the element
    // is inside the captured region before treating the image as evidence -
    // and its companion, that a capture can perturb what it photographs, which
    // is why every measurement above is already taken.
    await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
        .find((x) => !x.closest('#deal-form-vanilla'))
      g?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
        .find((x) => !x.closest('#deal-form-vanilla'))
      if (!g) return false
      const r = g.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    check(inView, `R-O4 the hybrid group is INSIDE the captured region at ${width}, so the screenshot is evidence`)
    await p.screenshot({ path: `${OUT}o4-hybrid-${width}.png` })
    console.log(`  captured o4-hybrid-${width}.png`)
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
