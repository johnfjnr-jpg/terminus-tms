// ── R6: THE SHARED POPUP MUST DISMISS ON SELECTION, AND ONLY ONE AT A TIME ─
//
// John's finding on the live Opportunity screen: popups PARK after selections,
// two at once in his screenshot. Ruled fixed in the SHARED mechanism so both
// surfaces inherit it, and proven HERE first because here is where the
// mechanism lives.
//
// THE MECHANISM, read before driving it:
//   - clicking a level fires `setOppAssessDraft`, which re-renders the lens and
//     RESTORES FOCUS to the radio;
//   - that radio's `onfocus` calls `showOppLevelDefinition`, so the popup comes
//     straight back after a selection;
//   - and `hideOppAssessDefn`'s focus fallback re-shows the focused row's popup
//     on the next mouseleave, so a second row's popup lands beside it.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates an Opportunity.
// Run: PUPPETEER_PATH=... node scripts/scoring/probe-r6-linger.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-r6-linger.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'v9r6'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

const opp = await freshOpportunity(TAG)
console.log(`opportunity ${opp.oppId ?? opp.opportunityId ?? JSON.stringify(opp)}\n`)
const oppId = opp.oppId ?? opp.opportunityId

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => !!document.getElementById('opp-assessment-mount'), { timeout: 30000 })

  // Open the assessment tab, then wait for LEVELS to be laid out - not merely
  // present, which Phase 0 already proved is a state worth refusing.
  // ── THE TAB IS CLICKED BY ITS OWN ATTRIBUTE, not by matching text ──────
  //
  // The first version found "the first element whose text says Assessment",
  // clicked it, and the panel stayed `hidden` while seven level groups sat in
  // the DOM behind it - so the probe read "no lens" on a screen that has one.
  // A text match is a guess about which control does the job; `data-opp-tab` is
  // the control saying so.
  // An evaluate-click, not `page.click`: the tab strip sits above the fold the
  // probe opens on, so Puppeteer could find no clickable point and the panel
  // stayed hidden while seven wired level groups sat behind it.
  await p.evaluate(() => document.querySelector('[data-opp-tab="assessment"]')?.click())
  await p.waitForFunction(() =>
    !document.getElementById('opp-tab-assessment')?.classList.contains('hidden'),
    { timeout: 15000 }).catch(() => false)
  const ready = await p.waitForFunction(() => {
    const g = document.querySelector('.opp-assess-levels[data-level-hover]')
    return !!g && g.getBoundingClientRect().width > 50
  }, { timeout: 30000 }).then(() => true).catch(() => false)
  check(ready, 'the assessment lens is laid out, so what follows is a measurement')
  if (!ready) throw new Error('no laid-out assessment lens')

  // The popups are counted document-wide ON PURPOSE, because R6's claim is that
  // at most one renders ANYWHERE - a count scoped to one pane could not see a
  // popup parked in another.
  const visible = () => p.evaluate(() => [...document.querySelectorAll('.opp-assess-defn')]
    .filter((b) => !b.classList.contains('hidden') && b.getBoundingClientRect().height > 0)
    .map((b) => b.id))

  // ── THE LENS IS CHOSEN FOR HAVING TWO HOVER-WIRED ROWS ─────────────────
  //
  // Only criteria with anchors AT THEIR CURRENT VERSION are hover-wired, and
  // the lens that opens by default has exactly ONE. R6's second clause is about
  // a popup moving between two rows, so a pane with one row cannot exhibit it
  // and a probe driven there would report a pass it never tested.
  const lens = await p.evaluate(() => {
    const panes = [...document.querySelectorAll('[id^="opp-assessment-mount-pane-"]')]
    const counts = panes.map((x) => ({
      id: x.id,
      key: x.id.replace('opp-assessment-mount-pane-', ''),
      wired: x.querySelectorAll('.opp-assess-levels[data-level-hover]').length,
    }))
    const best = counts.slice().sort((a, b) => b.wired - a.wired)[0]
    if (best && best.wired >= 2) {
      document.getElementById(`opp-assessment-mount-strip-tab-${best.key}`)?.click()
    }
    return { counts, chosen: best }
  })
  console.log(`  hover-wired rows per lens: ${JSON.stringify(lens.counts)}`)
  console.log(`  driving the "${lens.chosen?.key}" lens (${lens.chosen?.wired} wired rows)`)
  check((lens.chosen?.wired ?? 0) >= 2,
    `a lens with two hover-wired rows exists, so R6's second clause can be driven (${lens.chosen?.wired})`)
  await p.waitForFunction((id) => {
    const x = document.getElementById(id)
    return !!x && x.getBoundingClientRect().height > 0
  }, { timeout: 15000 }, lens.chosen.id).catch(() => false)

  // ── SCOPED TO THE ACTIVE LENS PANE, not the document ────────────────────
  //
  // Four lens panes exist and three are hidden. A document-wide query answered
  // for all of them, so the second "row" was a group inside a hidden pane with
  // a zero rect at the origin - and `elementFromPoint` at 0,0 is the sidebar,
  // which is what the probe reported before this was scoped. Verification 25's
  // population clause, arriving as a pointer sent to the wrong place.
  const rows = await p.evaluate(() => {
    const pane = [...document.querySelectorAll('[id^="opp-assessment-mount-pane-"]')]
      .find((x) => x.getBoundingClientRect().height > 0)
    return [...(pane?.querySelectorAll('.opp-assess-levels[data-level-hover]') ?? [])]
    .slice(0, 2).map((g) => ({
      key: g.querySelector('.opp-assess-level-input')?.dataset?.criterion ?? null,
      labels: [...g.querySelectorAll('label.opp-assess-level')].map((l) => l.getAttribute('for')),
    }))
  })
  console.log(`  two rows to drive: ${JSON.stringify(rows.map((r) => r.key))}`)
  check(rows.length === 2 && rows.every((r) => r.labels.length >= 2),
    'two hover-wired rows with levels exist to drive')

  check((await visible()).length === 0, 'nothing is showing before the drive')

  // ── THE DRIVE: select in row 1, then hover and select in row 2 ──────────
  // A real pointer, because the popup is opened by mouseover on the LABEL and
  // the selection is the label's own click.
  const pick = async (row, i) => {
    const id = rows[row].labels[i]
    // Scroll it into view before hovering: the second row sits below the fold
    // on the page this probe opens, and a pointer cannot be sent to a point
    // that is not on screen - which reads as "not clickable" rather than as
    // "scroll first".
    await p.evaluate((x) => document.querySelector(`label[for="${x}"]`)
      ?.scrollIntoView({ block: 'center' }), id)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    // ── WHAT IS AT THE POINT? Verification 14's clause, and here it is not a
    // probe fault but the DEFECT's own consequence: a popup left parked after a
    // selection floats below its row, which is exactly where the next row's
    // levels are, so it COVERS the control the person reaches for next.
    const at = await p.evaluate((x) => {
      const el = document.querySelector(`label[for="${x}"]`)
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { onTop: top ? `${top.tagName.toLowerCase()}.${(top.className || '').toString().slice(0, 30)}` : null,
        isTheLabel: !!top && (top === el || el.contains(top)) }
    }, id)
    if (!at.isTheLabel) console.log(`  >>> the label is COVERED by ${at.onTop}`)
    await p.hover(`label[for="${id}"]`).catch(() => {})
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const onHover = await visible()
    await p.click(`label[for="${id}"]`)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    return { onHover, afterClick: await visible() }
  }

  const r1 = await pick(0, 1)
  console.log(`  row 1: hover -> ${JSON.stringify(r1.onHover)}, after click -> ${JSON.stringify(r1.afterClick)}`)
  check(r1.onHover.length === 1, `hovering a level shows exactly one popup (${r1.onHover.length})`)
  // R6's FIRST CLAUSE. This is the failing claim before the fix.
  check(r1.afterClick.length === 0,
    `R6: selecting DISMISSES the popup (${r1.afterClick.length} still showing: ${JSON.stringify(r1.afterClick)})`)

  const r2 = await pick(1, 2)
  console.log(`  row 2: hover -> ${JSON.stringify(r2.onHover)}, after click -> ${JSON.stringify(r2.afterClick)}`)
  // R6's SECOND CLAUSE, and the one John photographed: hovering elsewhere must
  // MOVE the popup, never accumulate.
  check(r2.onHover.length <= 1,
    `R6: hovering a second row MOVES the popup rather than accumulating (${r2.onHover.length} showing: ${JSON.stringify(r2.onHover)})`)
  check(r2.afterClick.length === 0,
    `R6: the second selection dismisses too (${r2.afterClick.length} showing)`)

  // ── AND THE DISMISSAL MUST BE RECOVERABLE, or the fix has replaced a
  // lingering popup with one nobody can get back.
  //
  // R6 says the popup clears "until the pointer re-enters or focus returns", so
  // re-entering is the other half of the claim and it needs its own assertion:
  // a guard that only ever hides is indistinguishable from one that works, and
  // it would be worse than the defect.
  const leaveId = rows[1].labels[2]
  await p.evaluate(() => {
    document.querySelector('#view-opportunity-detail h1, .pg-title, header')?.scrollIntoView({ block: 'center' })
  })
  await p.mouse.move(5, 5)                       // genuinely out of the group
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
  const afterLeaving = await visible()
  await p.evaluate((x) => document.querySelector(`label[for="${x}"]`)?.scrollIntoView({ block: 'center' }), leaveId)
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.hover(`label[for="${leaveId}"]`).catch(() => {})
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
  const afterReturning = await visible()
  console.log(`  after leaving -> ${JSON.stringify(afterLeaving)}, after re-entering -> ${JSON.stringify(afterReturning)}`)
  check(afterLeaving.length === 0, `leaving shows nothing (${afterLeaving.length})`)
  check(afterReturning.length === 1,
    `R6: RE-ENTERING shows the wording again, so the dismissal is spent rather than permanent (${afterReturning.length})`)

  const shot = `${OUT}r6-${(await visible()).length}-popups-${oppId.slice(0, 8)}.png`
  await p.screenshot({ path: shot })
  console.log(`\n  screenshot: ${shot}`)
} finally {
  await b.close()
  console.log(`  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
