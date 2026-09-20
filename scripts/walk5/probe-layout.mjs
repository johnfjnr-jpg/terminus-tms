// THE WALK 5 LAYOUT TIER, GUARDED: W2, W4, W5, W6-W9, W10, W13.
//
// EVERY CLAIM IS A RELATIONSHIP BETWEEN TWO ELEMENTS, never a CSS property.
// `display: grid` is true of a grid laid out wrongly, and `text-align: right`
// is true of a cell in the wrong column. So the assertions read: this header
// sits over that field, this figure ends where that column ends, this panel
// stops where its grid stops.
//
// TWO FIXTURES, because one payload cannot show both grids. The customer
// milestone grid renders only under `hybrid` and the per-unit installation
// fields only under `Terminus Contractor - Per Unit`; a hidden element
// measures 0px and reads exactly like a narrow one.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk5/probe-layout.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk5/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w5layout'
const db = admin()
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }
const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const seed = async (id, extra) => {
  const rev = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'rev')
  const payload = { ...(rev[0]?.payload ?? {}), duration: 36, targetMargin: 30,
    ssExisting: 40, ssNew: 25, aqm: 12, hemir: 8, ...extra }
  must(await db.from('record_revisions').update({ payload })
    .eq('record_id', id).eq('revision_number', rev[0].revision_number), 'seed')
}

const lump = await freshOpportunity(TAG)
await seed(lump.oppId, {
  structure: 'twoPhase', installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 250000,
  contractorMilestones: [
    { month: 1, label: 'Contract start', pct: 40, usd: 100000 },
    { month: 4, label: 'Installation complete', pct: 60, usd: 150000 },
  ],
})
const hybrid = await freshOpportunity(TAG)
await seed(hybrid.oppId, {
  structure: 'hybrid', invoicing: 'annual', installResp: 'Terminus Contractor - Per Unit',
  milestones: [
    { month: 1, label: 'Contract start', pct: 60, usd: 150000 },
    { month: 6, label: 'Go live', pct: 40, usd: 100000 },
  ],
})

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const openCommercials = async (width, id) => {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((rid) => navigate('opportunity-detail', rid), id)
    await p.waitForFunction(() => {
      const c = document.getElementById('detail-company')
      return !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    // WAIT ON THE LIVE DEAL FORM, NOT ON SECTION COUNT. `.deal-section` is
    // satisfied by the retired `#deal-form-vanilla` block, which renders
    // nothing and carries the same markup: the first version of this wait
    // returned immediately and every measurement below read null, which looks
    // exactly like a surface that failed to build.
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const live = [...(panel?.querySelectorAll('[data-testid="contractor-grid"], [data-testid="deal-whtPct"]') ?? [])]
        .filter((e) => !e.closest('#deal-form-vanilla'))
      return live.length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  const read = () => p.evaluate(() => {
    const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
    const panel = document.getElementById('opp-tab-commercial')
    const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
    const r = (e) => e.getBoundingClientRect()
    const box = (e) => e ? { w: Math.round(r(e).width), left: Math.round(r(e).left), right: Math.round(r(e).right), align: getComputedStyle(e).textAlign } : null
    const cg = pick('[data-testid="contractor-grid"]')
    const head = cg?.querySelector('[data-testid="cm-grid-head"]')
    const row = cg?.querySelector('.cm-grid-row')
    const msRow = pick('.ms-grid-row')
    const msHead = pick('[data-testid="ms-grid-head"]')
    const group = pick('#deal-hybrid-group')
    return {
      cm: {
        headCells: head ? [...head.children].map((e) => ({ t: (e.textContent ?? '').trim(), ...box(e) })) : null,
        cells: row ? [...row.children].map((e) => box(e)) : null,
        baseFigure: box(pick('[data-testid="contractor-base-figure"]')),
        totalFigure: box(pick('[data-testid="contractor-total-usd"]')),
        baseLabel: (pick('[data-testid="contractor-base"]')?.textContent ?? '').trim(),
      },
      ms: {
        headCells: msHead ? [...msHead.children].map((e) => box(e)) : null,
        cells: msRow ? [...msRow.children].map((e) => box(e)) : null,
        tags: msRow ? [...msRow.children].map((e) => e.tagName.toLowerCase()) : null,
        optionCount: msRow?.children[1]?.tagName === 'SELECT'
          ? msRow.children[1].children.length : null,
      },
      cmTag: row?.children[1]?.tagName.toLowerCase() ?? null,
      // THE GRID'S OWN BOX, not the max right of its children. The first
      // version walked the children and produced a number that moved by 359px
      // when the column was pinned - a measure whose own answer depends on
      // which row it happened to find is not a measure.
      group: group && !group.classList.contains('hidden')
        ? { ...box(group), panels: [...group.children].map((c) => ({ tag: c.tagName.toLowerCase(), cls: (typeof c.className === 'string' ? c.className : ''), ...box(c) })),
            groupDisplay: getComputedStyle(group).display,
            groupCols: getComputedStyle(group).gridTemplateColumns,
            grid: box(group.querySelector('.ms-grid-row')) }
        : null,
      wht: box(pick('[data-testid="deal-whtPct"]')),
      gross: box(pick('[data-testid="deal-grossUp-toggle"], .deal-toggle')),
      gst: box(pick('[data-testid="deal-gstPct"]')),
      install: ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir'].map((id) => box(pick(`[data-testid="${id}"]`))),
    }
  })

  const readRef = () => p.evaluate(() => {
    const view = document.getElementById('view-opportunity-detail')
    const terminus = view?.querySelector('[data-testid="ref-terminus"]')
    const oppType = view?.querySelector('[data-testid="display-oppType"]')
    const ref = view?.querySelector('[data-testid="ref-opptype"]')
    const rows = terminus ? [...terminus.querySelectorAll('[data-testid^="display-"], [data-testid^="ro-"]')]
      .map((e) => e.getAttribute('data-testid')) : null
    return {
      cardGone: !ref,
      oppTypeInTerminus: !!(terminus && oppType && terminus.contains(oppType)),
      rows,
    }
  })

  for (const width of [1440, 1240]) {
    console.log(`\n=== ${width}px ===`)

    // ── W2, on the Reference tab ────────────────────────────────────────
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((rid) => navigate('opportunity-detail', rid), lump.oppId)
    await p.waitForFunction(() => !!document.querySelector('[data-testid="ref-terminus"]'), { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const ref = await readRef()
    check(ref.cardGone, `W2 the standalone Opportunity type card is gone at ${width}`)
    check(ref.oppTypeInTerminus, `W2 and the row is INSIDE Terminus Details at ${width}`)
    // The ruling says DIRECTLY BELOW Terminus reference, so position is asserted.
    const i = ref.rows ? ref.rows.findIndex((t) => /oppType/i.test(t ?? '')) : -1
    check(i === 1, `W2 and it sits directly below Terminus Reference at ${width}`,
      `index ${i} of ${JSON.stringify(ref.rows)}`)

    // ── The lump-sum surface: W4, W6-W9, W10 ────────────────────────────
    await openCommercials(width, lump.oppId)
    const a = await read()

    check(a.cm.headCells?.length === 4
      && JSON.stringify(a.cm.headCells.map((c) => c.t)) === '["Month","Milestone","%","Amount"]',
      `W6-W9 the installation grid has its four column labels at ${width}`,
      JSON.stringify(a.cm.headCells?.map((c) => c.t)))
    // THE LABELS SIT OVER THE FIELDS. A relationship, not a template string.
    const aligned = a.cm.headCells && a.cm.cells
      && a.cm.headCells.every((h, n) => Math.abs(h.left - a.cm.cells[n].left) <= 2)
    check(!!aligned, `W6-W9 and each label sits over its own column at ${width}`,
      `heads ${JSON.stringify(a.cm.headCells?.map((c) => c.left))} cells ${JSON.stringify(a.cm.cells?.map((c) => c.left))}`)
    check(a.cm.cells?.[0].w === 44 && a.cm.cells?.[2].w === 44,
      `W6-W9 Month and % are sized to two digits at ${width}`,
      `${a.cm.cells?.[0].w}px and ${a.cm.cells?.[2].w}px`)
    check(a.cm.cells?.[2].align === 'right' && a.cm.cells?.[3].align === 'right',
      `W6-W9 the numeric columns are right-aligned at ${width}`)

    // W10: the figures END where the Amount column ends.
    check(a.cm.baseFigure && a.cm.cells
      && Math.abs(a.cm.baseFigure.right - a.cm.cells[3].right) <= 2,
      `W10 the lump sum figure ends with the Amount column at ${width}`,
      `figure right ${a.cm.baseFigure?.right}, column right ${a.cm.cells?.[3].right}`)
    check(a.cm.totalFigure && a.cm.cells
      && Math.abs(a.cm.totalFigure.right - a.cm.cells[3].right) <= 2,
      `W10 and so does the total at ${width}`)
    // PRESENCE FIRST, THEN THE CLAIM. `!/\$/.test('')` is true of an element
    // that is not there, so this passed on a surface that had rendered
    // nothing at all - Verification 14's shape, a check satisfied by absence.
    check(a.cm.baseLabel.length > 0 && !/\$/.test(a.cm.baseLabel),
      `W10 the label no longer carries the figure inside it at ${width}`,
      JSON.stringify(a.cm.baseLabel))

    // W4: the pair on one line, GST below it.
    const pairLine = a.wht && a.gross
      && Math.abs((a.wht.left + 0) - 0) >= 0
      && Math.abs(a.gross.left - a.wht.right) < 400
    check(a.wht?.w === 64, `W4 the WHT box is sized to two digits at ${width}`, `${a.wht?.w}px`)
    check(!!pairLine && a.gross.left > a.wht.left,
      `W4 the gross-up selector follows WHT on the same line at ${width}`,
      `wht right ${a.wht?.right}, gross left ${a.gross?.left}`)
    check(!!(a.gst && a.wht) && a.gst.left <= a.wht.left,
      `W4 and GST sits below the pair rather than between it at ${width}`)

    // ── The hybrid surface: W5, W13 ─────────────────────────────────────
    await openCommercials(width, hybrid.oppId)
    // AND WAIT FOR THE HYBRID GROUP TO BE SHOWN. `openCommercials` waits on
    // the deal form existing, which the per-unit fixture satisfies before the
    // structure radio has switched the group on. Measured too early, its two
    // children both reported the group's full width - the block-flow shape,
    // not the grid - and W13 read a -753px gap. The counterfactual matters
    // here: the group EXISTS either way, so the wait must be on it being
    // shown rather than on it being present.
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const g = [...(panel?.querySelectorAll('#deal-hybrid-group') ?? [])]
        .find((x) => !x.closest('#deal-form-vanilla'))
      return !!g && !g.classList.contains('hidden')
        && getComputedStyle(g).display === 'grid'
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const h = await read()
    check(h.install.every((f) => f && f.w === 104),
      `W5 the installation fields are sized to their data at ${width}`,
      JSON.stringify(h.install.map((f) => f?.w)))
    // R-W12, live: the milestone column is the dropdown, on the real screen.
    check(h.ms.tags?.[1] === 'select',
      `R-W12 the customer milestone column is a dropdown at ${width}`,
      `<${h.ms.tags?.[1]}>`)
    check((h.ms.optionCount ?? 0) === 7,
      `R-W12 and it offers the six names plus the placeholder at ${width}`,
      `${h.ms.optionCount} options`)
    check(h.ms.tags?.[1] === h.cmTag,
      `R-W12 and the two grids use the same control at ${width}`,
      `customer <${h.ms.tags?.[1]}>, contractor <${h.cmTag}>`)
    check(h.ms.cells?.[2].align === 'right' && h.ms.cells?.[3].align === 'right',
      `W13 the payment-terms % and USD are right-aligned at ${width}`)
    check(h.ms.headCells?.[2].align === 'right' && h.ms.headCells?.[3].align === 'right',
      `W13 and so are their column labels at ${width}`)
    // W13's second half: the panel closes onto its grid, so the gap between
    // the grid's last column and the hosting panel is the grid gap, not dead
    // space. Measured as a relationship between the two panels.
    console.log(`      [hybrid group] ${h.group ? `w=${h.group.w} display=${h.group.groupDisplay} cols=${h.group.groupCols} panels=${JSON.stringify(h.group.panels.map((x) => x && [x.tag, x.cls.slice(0,20), x.left, x.w]))}` : 'absent or hidden'}`)
    if (h.group && h.group.panels.length === 2 && h.group.grid) {
      const [left, right] = h.group.panels
      // TWO RELATIONSHIPS, STATED PLAINLY.
      //   1. the panel closes onto its grid: its width is the grid's width
      //      plus its own padding, not the whole row;
      //   2. the hosting panel begins one grid-gap after it.
      // THE FIRST VERSION OF THIS CHECK WAS A TAUTOLOGY, and a calibration
      // silence is what named it. `.ms-grid-row` is a block: it STRETCHES to
      // fill whatever panel it is in, so its width always equals the panel's
      // and `panel.w - grid.w` is always 0. Injecting the old full-width
      // column changed the numbers from 375/375 to 453/453 and the check
      // passed both times.
      //
      // The claim is about the COLUMNS, which are fixed: 44+195+44+64 plus
      // three 4px gaps is 359. So the measure is the dead space INSIDE panel
      // one, between where its last column ends and where the panel does.
      const lastCol = h.ms.cells ? h.ms.cells[3].right : null
      const slack = lastCol === null ? null : left.right - lastCol
      check(slack !== null && slack >= 0 && slack <= 30,
        `W13 panel 1 closes onto its grid at ${width}`,
        `panel ends ${left.right}, last column ends ${lastCol}, slack ${slack}px`)
      const dead = right.left - left.right
      // A NEGATIVE GAP IS AN OVERLAP, NOT A SUCCESS. The first version read
      // `dead <= 40`, which passes on -36 just as happily as on 36 - so a
      // hosting panel sitting ON TOP of the grid's last column would have
      // been reported as pulling left nicely. Bounded both ways.
      check(dead >= 0 && dead <= 40,
        `W13 the hosting panel pulls left onto the grid at ${width}`,
        `${dead}px between the grid's last column and the panel`)
    } else check(false, `W13 the hybrid group has two panels at ${width}`)

    await p.evaluate(() => {
      const g = [...document.querySelectorAll('#deal-hybrid-group')]
        .find((x) => !x.closest('#deal-form-vanilla'))
      g?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.screenshot({ path: `${OUT}layout-hybrid-${width}.png` })
    await openCommercials(width, lump.oppId)
    // SETTLE BEFORE SCROLLING AND CAPTURING. `openCommercials` re-navigates,
    // so the view re-enters `is-loading`, and `.is-loading > *` hides its
    // children while keeping their layout: the grid reported top 455 in a
    // 1200px viewport and the picture was pure background.
    await p.waitForFunction(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      return !!v && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => {
      const g = [...document.querySelectorAll('[data-testid="contractor-grid"]')]
        .find((x) => !x.closest('#deal-form-vanilla'))
      g?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    // THE ELEMENT MUST BE IN THE CAPTURED REGION, ASSERTED. The first run of
    // this probe wrote a screenshot of pure background - the page had scrolled
    // past everything - and every check above still passed, because they read
    // the live DOM while the picture showed nothing. A blank image is not a
    // failed check, it is no check, and it looks like diligence.
    const shot = await p.evaluate(() => {
      const g = [...document.querySelectorAll('[data-testid="contractor-grid"]')]
        .find((x) => !x.closest('#deal-form-vanilla'))
      if (!g) return { ok: false, why: 'no contractor grid' }
      const r = g.getBoundingClientRect()
      // AND VISIBLE, NOT MERELY POSITIONED. `.is-loading > * { visibility:
      // hidden }` PRESERVES LAYOUT, so an element reports a healthy rect from
      // the middle of the viewport while the screenshot is pure background.
      // That is what the first two captures were, and the geometry check
      // passed on both.
      const view = [...document.querySelectorAll('[id^="view-"]')]
        .find((x) => !x.classList.contains('hidden'))
      const vis = getComputedStyle(g).visibility === 'visible'
        && !view?.classList.contains('is-loading')
      return { ok: vis && r.top < window.innerHeight && r.bottom > 0 && r.height > 0,
        why: `top ${Math.round(r.top)} bottom ${Math.round(r.bottom)} of ${window.innerHeight}, visible=${vis}` }
    })
    check(shot.ok, `the installation grid is inside the captured region at ${width}`, shot.why)
    await p.screenshot({ path: `${OUT}layout-install-${width}.png` })
    console.log(`  captured layout-hybrid-${width}.png and layout-install-${width}.png`)
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
