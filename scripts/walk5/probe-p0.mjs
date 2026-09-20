// WALK 5, PHASE 0. Measure before build.
//
// Every measurement is taken on the LIVE surface and the three retired blocks
// are excluded by name: they render nothing and answer `querySelector` exactly
// as the live markup does, which produced a false reading in each of the last
// two rounds.
//
// W1 IS THE ONE THAT DECIDES SOMETHING. It asks for four items on the notes
// header line. Ruling A1 cleared that set deliberately and walk 4 remeasured
// it nine days ago, so this measures the REQUESTED line against the AVAILABLE
// width rather than assuming either answer.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk5/probe-p0.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk5/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w5p0'
const db = admin()
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const opp = await freshOpportunity(TAG)
console.log(`opportunity ${opp.oppId}\n`)

const rev = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'rev')
const payload = { ...(rev[0]?.payload ?? {}) }
payload.notes = [1, 2, 3].map((i) => ({
  at: new Date(Date.now() - i * 60000).toISOString(), by: 'probe', text: `seeded note ${i}`,
}))
payload.structure = 'twoPhase'
payload.duration = 36
payload.ssExisting = 40; payload.ssNew = 25; payload.aqm = 12; payload.hemir = 8
payload.installResp = 'Terminus Contractor - Lump Sum'
payload.lumpSumCost = 250000
payload.targetMargin = 30
payload.contractorMilestones = [
  { month: 1, label: 'Contract start', pct: 40, usd: 100000 },
  { month: 4, label: 'Installation complete', pct: 60, usd: 150000 },
]
// UPDATED, not inserted: `record_revisions.created_by` is not-null and a
// fresh insert has no actor to name. Walk 4's notes probe seeds the same way.
must(await db.from('record_revisions').update({ payload })
  .eq('record_id', opp.oppId).eq('revision_number', rev[0].revision_number), 'seed')

// ── A SECOND FIXTURE, BECAUSE ONE PAYLOAD CANNOT SHOW BOTH ─────────────
//
// The first run measured 0px for the customer milestone grid and for four of
// the five installation fields, and reported it. Those zeros are NOT widths:
// the customer grid renders only under `hybrid`, and the per-unit install
// fields only under `Terminus Contractor - Per Unit`, so the first fixture's
// own choices had hidden both. A hidden element measures zero and reads
// exactly like a narrow one.
const opp2 = await freshOpportunity(TAG)
const rev2 = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', opp2.oppId).order('revision_number', { ascending: false }).limit(1), 'rev2')
const payload2 = { ...(rev2[0]?.payload ?? {}) }
Object.assign(payload2, {
  structure: 'hybrid', invoicing: 'annual', duration: 36, targetMargin: 30,
  ssExisting: 40, ssNew: 25, aqm: 12, hemir: 8,
  installResp: 'Terminus Contractor - Per Unit',
  milestones: [
    { month: 1, label: 'Contract start', pct: 40, usd: 100000 },
    { month: 4, label: 'Installation complete', pct: 35, usd: 87500 },
    { month: 8, label: 'Go live', pct: 25, usd: 62500 },
  ],
})
must(await db.from('record_revisions').update({ payload: payload2 })
  .eq('record_id', opp2.oppId).eq('revision_number', rev2[0].revision_number), 'seed 2')
console.log(`second opportunity (hybrid, per-unit): ${opp2.oppId}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const open = async (width, id = opp.oppId) => {
    await p.setViewport({ width, height: 1200 })
    // A FULL RELOAD: `DealPanel` seeds its UI state once, so navigating
    // between the two fixtures would leave the form holding the first one's
    // structure and installation choice.
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      const c = document.getElementById('detail-company')
      return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  for (const width of [1440, 1240]) {
    await open(width)
    console.log(`\n${'='.repeat(62)}\n=== ${width}px\n${'='.repeat(62)}`)

    const w1 = await p.evaluate(() => {
      // SCOPED TO THE OPPORTUNITY'S OWN BAND. The document holds a
      // `cd-notes` card per LEAD CARD as well, on the leads list, and that
      // view is hidden so those measure 0px wide. A document-wide query took
      // the first of them and reported the notes card as zero pixels, which
      // reads as "the card is not there" rather than "I asked the wrong
      // element". Verification 25's too-wide population.
      const band = document.getElementById('opp-band-root')
      const card = band?.querySelector('[data-testid="cd-notes"]') ?? null
      if (!card) return { present: false }
      const r = (e) => e.getBoundingClientRect()
      const cs = getComputedStyle(card)
      const inner = r(card).width - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
      const head = card.querySelector('[data-testid="cd-notes-header-row"]')
      const parts = [...(head?.children ?? [])].filter((e) => r(e).width > 0)
      const shown = card.querySelector('[data-testid="cd-notes-shown"]')
      const probeSpan = document.createElement('span')
      probeSpan.className = 'label'
      probeSpan.textContent = 'Latest first'
      probeSpan.style.position = 'absolute'
      probeSpan.style.visibility = 'hidden'
      head?.appendChild(probeSpan)
      const secondaryW = Math.round(r(probeSpan).width)
      probeSpan.remove()
      return {
        present: true,
        cardWidth: Math.round(r(card).width),
        innerWidth: Math.round(inner),
        headHeight: Math.round(r(head).height),
        parts: parts.map((e) => ({
          what: e.className || e.tagName.toLowerCase(),
          w: Math.round(r(e).width),
          text: (e.textContent ?? '').trim().slice(0, 26),
        })),
        usedNow: Math.round(parts.reduce((s, e) => s + r(e).width, 0)),
        secondaryW,
        shownW: shown ? Math.round(r(shown).width) : null,
        shownText: shown ? (shown.textContent ?? '').trim() : null,
      }
    })
    console.log(`\n--- W1: the Notes header line ---`)
    if (!w1.present) { console.log('  no notes card') } else {
      console.log(`  card ${w1.cardWidth}px, content box ${w1.innerWidth}px, header row ${w1.headHeight}px high`)
      for (const x of w1.parts) console.log(`    on the line now: ${String(x.w).padStart(4)}px  ${x.what}  ${JSON.stringify(x.text)}`)
      console.log(`    "Latest first"   ${String(w1.secondaryW).padStart(4)}px  (measured by building it, not carried forward)`)
      console.log(`    ${JSON.stringify(w1.shownText)}  ${w1.shownW}px  (currently BELOW the line)`)
      const GAP = 8
      const need = w1.usedNow + GAP + w1.secondaryW + GAP + (w1.shownW ?? 0)
      console.log(`  W1 ASKS FOR: ${w1.usedNow} + ${w1.secondaryW} + ${w1.shownW} + 2 gaps = ${need}px`)
      console.log(`  AVAILABLE:   ${w1.innerWidth}px`)
      console.log(`  VERDICT:     ${need <= w1.innerWidth ? 'FITS' : `does NOT fit, over by ${need - w1.innerWidth}px`}`)
    }

    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      return !!panel && panel.querySelectorAll('.deal-section, .section-title').length > 2
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const grids = await p.evaluate(() => {
      const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
      const panel = document.getElementById('opp-tab-commercial')
      const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
      const r = (e) => e.getBoundingClientRect()
      const box = (e) => e ? { w: Math.round(r(e).width), left: Math.round(r(e).left), align: getComputedStyle(e).textAlign } : null

      const cg = pick('[data-testid="contractor-grid"]')
      const cgTable = cg?.querySelector('table')
      const cgRow = cgTable?.querySelector('tbody tr')
      const cgCells = cgRow ? [...cgRow.children].map((td) => {
        const ctl = td.querySelector('input, select')
        return { tag: ctl?.tagName.toLowerCase() ?? '-', ...box(ctl) }
      }) : []

      const msHead = pick('[data-testid="ms-grid-head"]')
      const msRow = pick('.ms-grid-row')
      const msCells = msRow ? [...msRow.children].map((el) => ({ tag: el.tagName.toLowerCase(), ...box(el) })) : []

      const lump = [...(panel?.querySelectorAll('*') ?? [])].filter(LIVE)
        .filter((e) => e.children.length === 0 && /lump sum contractor price/i.test(e.textContent ?? ''))[0]

      const install = ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir', 'deal-lumpCost']
        .map((id) => ({ id, ...box(pick(`[data-testid="${id}"]`)) }))

      const taxCard = [...(panel?.querySelectorAll('.pg-card') ?? [])].filter(LIVE)
        .find((c) => /tax adjustments/i.test(c.querySelector('.pg-card-title')?.textContent ?? ''))
      const taxOrder = taxCard ? [...taxCard.children].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)) : []

      return {
        contractor: {
          present: !!cg,
          hasHeaderRow: !!cgTable?.querySelector('thead'),
          cells: cgCells,
        },
        msHeadTemplate: msHead ? getComputedStyle(msHead).gridTemplateColumns : null,
        msRowTemplate: msRow ? getComputedStyle(msRow).gridTemplateColumns : null,
        msCells,
        lump: lump ? { text: (lump.textContent ?? '').trim().slice(0, 40), ...box(lump) } : null,
        install,
        taxOrder,
        whtBox: box(pick('[data-testid="deal-whtPct"]')),
        gstBox: box(pick('[data-testid="deal-gstPct"]')),
      }
    })

    console.log(`\n--- W6-W9: the INSTALLATION (contractor) milestone grid ---`)
    console.log(`  present: ${grids.contractor.present}`)
    console.log(`  HAS a <thead> with column labels: ${grids.contractor.hasHeaderRow}`)
    grids.contractor.cells.forEach((c, i) => console.log(`    col ${i + 1}  <${c.tag}>  ${String(c.w).padStart(4)}px  left=${c.left}  text-align=${c.align}`))

    console.log(`\n--- W13: the payment-terms (customer) milestone grid ---`)
    console.log(`  head template: ${grids.msHeadTemplate}`)
    console.log(`  row  template: ${grids.msRowTemplate}`)
    grids.msCells.forEach((c, i) => console.log(`    col ${i + 1}  <${c.tag}>  ${String(c.w).padStart(4)}px  left=${c.left}  text-align=${c.align}`))

    console.log(`\n--- W10: the lump sum line ---`)
    console.log(`  ${grids.lump ? `${JSON.stringify(grids.lump.text)} left=${grids.lump.left} width=${grids.lump.w} align=${grids.lump.align}` : 'not found'}`)

    console.log(`\n--- W5: the installation fields ---`)
    for (const f of grids.install) console.log(`    ${f.id.padEnd(22)} ${f.w === undefined ? 'absent' : `${String(f.w).padStart(4)}px  align=${f.align}`}`)

    console.log(`\n--- W4: the Tax Adjustments card, in DOM order ---`)
    grids.taxOrder.forEach((t, i) => console.log(`    ${i + 1}. ${JSON.stringify(t)}`))
    console.log(`    WHT box: ${grids.whtBox ? grids.whtBox.w + 'px' : 'absent'}   GST box: ${grids.gstBox ? grids.gstBox.w + 'px' : 'absent'}`)

    await p.screenshot({ path: `${OUT}p0-lump-${width}.png` })
    console.log(`\n  captured p0-lump-${width}.png`)

    // ── FIXTURE B: hybrid and per-unit, where W13 and W5 actually render ──
    await open(width, opp2.oppId)
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
        .find((x) => !x.closest('#deal-form-vanilla'))
      return !!g && !g.classList.contains('hidden')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const b2 = await p.evaluate(() => {
      const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
      const panel = document.getElementById('opp-tab-commercial')
      const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
      const r = (e) => e.getBoundingClientRect()
      const box = (e) => e ? { w: Math.round(r(e).width), left: Math.round(r(e).left), right: Math.round(r(e).right), align: getComputedStyle(e).textAlign } : null
      const msHead = pick('[data-testid="ms-grid-head"]')
      const msRow = pick('.ms-grid-row')
      const headCells = msHead ? [...msHead.children].map((e) => ({ t: (e.textContent ?? '').trim(), ...box(e) })) : []
      const msCells = msRow ? [...msRow.children].map((el) => ({ tag: el.tagName.toLowerCase(), ...box(el) })) : []
      const group = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])].find(LIVE)
      const panels = group ? [...group.children].map((c) => box(c)) : []
      const install = ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir']
        .map((id) => ({ id, ...box(pick(`[data-testid="${id}"]`)) }))
      return { headCells, msCells, panels, install,
        gap: group ? getComputedStyle(group).gap : null,
        template: group ? getComputedStyle(group).gridTemplateColumns : null }
    })
    console.log(`\n--- W13: the payment-terms grid, IN ITS OWN STATE (hybrid) ---`)
    b2.headCells.forEach((c, i) => console.log(`    head ${i + 1}  ${JSON.stringify(c.t).padEnd(20)} ${String(c.w).padStart(4)}px  align=${c.align}`))
    b2.msCells.forEach((c, i) => console.log(`    cell ${i + 1}  <${c.tag}>  ${String(c.w).padStart(4)}px  left=${c.left}  align=${c.align}`))
    console.log(`  the hybrid group: template ${b2.template}, gap ${b2.gap}`)
    b2.panels.forEach((x, i) => console.log(`    panel ${i + 1}  left=${x.left} right=${x.right} width=${x.w}`))

    console.log(`\n--- W5: the per-unit installation fields, IN THEIR OWN STATE ---`)
    for (const f of b2.install) console.log(`    ${f.id.padEnd(22)} ${f.w === undefined ? 'absent' : `${String(f.w).padStart(4)}px  align=${f.align}`}`)

    await p.screenshot({ path: `${OUT}p0-hybrid-${width}.png` })
    console.log(`  captured p0-hybrid-${width}.png`)
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
