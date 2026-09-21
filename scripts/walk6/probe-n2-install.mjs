// N2: THE INSTALLATION PANEL SPANS THE ROW. Measure before building.
//
// The finding says the panel should collapse to its content, the
// responsibility select should be sized to its longest option and the lump
// sum field to a nine-figure amount. All three are measurements, and the
// third needs the longest option MEASURED rather than guessed: the widest
// string in a select is not always the one that looks longest.
//
// THE ESTATE'S GRID PATTERN is what a fix adopts, so the measurement records
// what the surrounding sections already do rather than inventing a shape.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk6/probe-n2-install.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk6/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w6n2'
const db = admin()
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }

const opp = await freshOpportunity(TAG)
const rev = must(await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'rev')
must(await db.from('record_revisions').update({
  payload: { ...(rev[0]?.payload ?? {}), structure: 'twoPhase', duration: 36, targetMargin: 30,
    ssExisting: 40, ssNew: 25, aqm: 12, hemir: 8,
    installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 250000 },
}).eq('record_id', opp.oppId).eq('revision_number', rev[0].revision_number), 'seed')

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const sizes = []

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const c = document.getElementById('detail-company')
      return !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const view = document.getElementById('view-opportunity-detail')
      if (!view || view.classList.contains('is-loading')) return false
      const panel = document.getElementById('opp-tab-commercial')
      const el = [...(panel?.querySelectorAll('[data-testid="deal-installResp"]') ?? [])]
        .find((e) => !e.closest('#deal-form-vanilla'))
      return !!el && getComputedStyle(el).visibility === 'visible'
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const LIVE = (e) => !e.closest('#deal-form-vanilla, #deal-version-vanilla, #ref-vanilla')
      const panel = document.getElementById('opp-tab-commercial')
      const pick = (sel) => [...(panel?.querySelectorAll(sel) ?? [])].find(LIVE) ?? null
      const r = (e) => e.getBoundingClientRect()
      const box = (e) => e ? { w: Math.round(r(e).width), left: Math.round(r(e).left), right: Math.round(r(e).right) } : null

      const sel = pick('[data-testid="deal-installResp"]')
      const lump = pick('[data-testid="deal-lumpCost"]')

      // THE LONGEST OPTION, MEASURED rather than guessed: rendered off-screen
      // in the select's own font, so the answer is in pixels rather than in
      // characters.
      let longest = null
      if (sel) {
        const cs = getComputedStyle(sel)
        const probe = document.createElement('span')
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
        document.body.appendChild(probe)
        for (const o of sel.options) {
          probe.textContent = o.text
          const w = Math.ceil(probe.getBoundingClientRect().width)
          if (!longest || w > longest.w) longest = { text: o.text, w }
        }
        // And a nine-figure amount in the lump field's own font.
        const lcs = lump ? getComputedStyle(lump) : cs
        probe.style.font = lcs.font
        probe.textContent = '999999999'
        var nineFig = Math.ceil(probe.getBoundingClientRect().width)
        probe.remove()
      }

      // The panel and the section it sits in.
      const section = sel?.closest('.deal-section, section') ?? null
      const col = sel?.closest('div')?.parentElement ?? null
      const heading = [...(panel?.querySelectorAll('.section-title, p, div') ?? [])].filter(LIVE)
        .find((e) => e.children.length === 0 && /^installation$/i.test((e.textContent ?? '').trim()))
      const panelBox = heading?.parentElement ? box(heading.parentElement) : null

      return {
        select: box(sel), selectPadding: sel ? getComputedStyle(sel).padding : null,
        longestOption: longest, nineFigureWidth: typeof nineFig === 'number' ? nineFig : null,
        lump: box(lump),
        panel: panelBox,
        section: box(section),
        installColumn: box(col),
        // THE GRID AND ITS RIGHTMOST ITEM. `collapses to its content` is a
        // relationship between the content's right edge and the row's, and it
        // is the only one of N2's measures that a fixed width on a control
        // cannot satisfy on its own.
        grid: box(col),
        contentRight: col
          ? Math.max(...[...col.children].map((c) => Math.round(c.getBoundingClientRect().right)))
          : null,
        viewport: window.innerWidth,
      }
    })

    console.log(`\n=== ${width}px ===`)
    console.log(`  the responsibility select : ${m.select?.w}px  (left ${m.select?.left} -> ${m.select?.right})`)
    console.log(`    its longest option      : ${JSON.stringify(m.longestOption?.text)} needs ${m.longestOption?.w}px of text`)
    console.log(`    padding                 : ${m.selectPadding}`)
    console.log(`  the lump sum field        : ${m.lump?.w}px`)
    console.log(`    a nine-figure amount    : ${m.nineFigureWidth}px of text`)
    console.log(`  the panel around them     : ${m.panel?.w}px  (left ${m.panel?.left} -> ${m.panel?.right})`)
    console.log(`  the section               : ${m.section?.w}px`)
    const slackSel = (m.select?.w ?? 0) - (m.longestOption?.w ?? 0)
    const slackLump = (m.lump?.w ?? 0) - (m.nineFigureWidth ?? 0)
    console.log(`\n  SLACK: the select is ${slackSel}px wider than its longest option`)
    console.log(`  SLACK: the lump field is ${slackLump}px wider than a nine-figure amount`)

    // ── N2 AS A GUARD. The thresholds come from the REQUIREMENT, not from
    // what was measured after the change: a control is sized to its content
    // when the slack is the chrome it needs - a dropdown arrow, a little
    // padding - rather than a share of the row. Before the fix the slack was
    // 137px and 278px; a rule of "under 60" separates those from a fitted
    // control without being read off the result.
    check(slackSel >= 0 && slackSel < 60,
      `N2 the responsibility select is sized to its longest option at ${width}`,
      `${m.select?.w}px against ${m.longestOption?.w}px of text, slack ${slackSel}`)
    check(slackLump >= 0 && slackLump < 60,
      `N2 the lump sum field is sized to a nine-figure amount at ${width}`,
      `${m.lump?.w}px against ${m.nineFigureWidth}px, slack ${slackLump}`)
    // AND IT STOPS SPANNING: the two controls together must occupy
    // materially less than the row they sit in.
    const spanned = (m.lump?.right ?? 0) - (m.select?.left ?? 0)
    check(spanned < (m.section?.w ?? 0) * 0.75,
      `N2 the controls stop spanning the row at ${width}`,
      `${spanned}px of a ${m.section?.w}px section`)
    // ── AND THE DEAD SPACE BETWEEN THE CONTROLS ──────────────────────
    // CALIBRATION FOUND THIS GAP. Reverting the grid to `1fr 1fr` left every
    // check above green, because `#deal-installResp` carries its own width:
    // the CONTROLS kept their size while the COLUMNS went back to half the
    // row each. A property of a control cannot see that, and the dead space
    // it opens is what N2 is about.
    //
    // THE FIRST REPLACEMENT WAS ALSO WRONG and is recorded rather than
    // quietly dropped: it asserted the row's content left a quarter of the
    // row unclaimed, which the explanatory note legitimately fills. N2 does
    // not ask the note to be narrow. It asks the two CONTROLS to sit next to
    // each other.
    //
    // THE THRESHOLD IS FROM THE REQUIREMENT: two controls in adjacent
    // content-sized columns are separated by the grid's own 16px gap and
    // nothing else. Under `1fr 1fr` the same two sit 128px apart at 1440.
    const between = (m.lump?.left ?? 0) - (m.select?.right ?? 0)
    console.log(`  the two controls sit ${between}px apart`)
    check(between >= 0 && between < 40,
      `N2 the two controls sit next to each other at ${width}`,
      `select ends ${m.select?.right}, lump starts ${m.lump?.left}, ${between}px between`)

    // AND IT DOES NOT OVERFLOW THE SECTION, which content-sized columns can
    // do and `1fr 1fr` never could. Found by this probe at 1240, where the
    // note's 320px cap put the content 64px past the row's right edge; fixed
    // by letting the second column shrink, `minmax(0, max-content)`.
    check((m.contentRight ?? 0) <= (m.grid?.right ?? 0) + 1,
      `N2 and the content stays inside the row at ${width}`,
      `content ends ${m.contentRight}, row ends ${m.grid?.right}`)

    // AND THE SIZES DO NOT MOVE WITH THE VIEWPORT, which is what "sized to
    // its content" means and what `1fr 1fr` could never give.
    sizes.push({ width, sel: m.select?.w, lump: m.lump?.w })

    // MEASURED ABOVE, CAPTURED HERE, and proven visible before the shutter:
    // `.is-loading > *` hides children while preserving layout, so geometry
    // reads healthy on a blank picture.
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('[data-testid="deal-installResp"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      el?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = await p.evaluate(() => {
      const el = [...document.querySelectorAll('[data-testid="deal-installResp"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      if (!el) return { ok: false, why: 'absent' }
      const r = el.getBoundingClientRect()
      const view = document.getElementById('view-opportunity-detail')
      const vis = getComputedStyle(el).visibility === 'visible' && !view?.classList.contains('is-loading')
      return { ok: vis && r.top < window.innerHeight && r.bottom > 0, why: `visible=${vis} top=${Math.round(r.top)}` }
    })
    console.log(`  capture: in the region and visible: ${shot.ok} (${shot.why})`)
    await p.screenshot({ path: `${OUT}n2-install-${width}.png` })
  }
  check(sizes.length === 2 && sizes[0].sel === sizes[1].sel && sizes[0].lump === sizes[1].lump,
    'N2 and the controls are the same size at both widths, not a share of the row',
    JSON.stringify(sizes))
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
