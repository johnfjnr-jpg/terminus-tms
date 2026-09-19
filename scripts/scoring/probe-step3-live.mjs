// ── STEP 3 LIVE: the five-button score control, at 1440 AND 1240 ─────────
//
// The ruled drive, on an owned Test Bed, read back from the database:
//   a MOUSE pass with the anchor READ BEFORE the click
//   a KEYBOARD-ONLY pass, the popup following focus and dismissing on commit
//   an ESCAPE revert
//   a 2 COMMITTED FROM ITS BARE NUMBER
//   the awaiting-reason flow end to end
//
// UNWIRED: browser, live server, signed-in session; creates a Test Bed.
// Run: PUPPETEER_PATH=... node scripts/scoring/probe-step3-live.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-step3-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin()
const TAG = 'v9s3'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const scoresOf = async (id, key) => {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'rev')
  const series = rev[0]?.payload?.[key]
  return { revision: rev[0]?.revision_number ?? 0, entries: Array.isArray(series) ? series : [] }
}

const tb = await freshTestBed(TAG)
console.log(`test bed ${tb.bedId}\n`)
const KEY = 'scoreRolloutPath'

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const openQualification = async () => {
    await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
    await p.waitForFunction(() => !!document.querySelector('[data-testid^="tb-tab-btn-"]'), { timeout: 30000 })
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('[data-testid^="tb-tab-btn-"]')]
        .find((x) => /qualification/i.test(x.textContent ?? ''))
      btn?.click()
    })
    // Wait on LAID-OUT buttons, not merely present ones.
    return p.waitForFunction((k) => {
      const e = document.querySelector(`[data-testid="tb-score-btn-${k}-3"]`)
      return !!e && e.getBoundingClientRect().width > 0
    }, { timeout: 30000 }, KEY).then(() => true).catch(() => false)
  }
  const popup = () => p.evaluate((k) => {
    const box = document.querySelector(`[data-testid="tb-score-anchor-${k}"]`)
    if (!box) return { present: false }
    const r = box.getBoundingClientRect()
    return { present: true, shown: !box.classList.contains('hidden') && r.height > 0,
      text: (box.textContent ?? '').trim(), w: Math.round(r.width) }
  }, KEY)
  const chosen = () => p.evaluate((k) => {
    const g = document.querySelector(`[data-testid="tb-score-levels-${k}"]`)
    return g?.querySelector('[aria-checked="true"]')?.getAttribute('data-level') ?? ''
  }, KEY)
  const hoverBtn = async (v) => {
    await p.evaluate((k, n) => document.querySelector(`[data-testid="tb-score-btn-${k}-${n}"]`)
      ?.scrollIntoView({ block: 'center' }), KEY, v)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.hover(`[data-testid="tb-score-btn-${KEY}-${v}"]`).catch(() => {})
    await p.evaluate(() => new Promise((r) => setTimeout(r, 250)))
  }

  for (const width of [1440, 1240]) {
    console.log(`\n  ══ ${width}px ══`)
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    const ready = await openQualification()
    check(ready, `${width}: the five-button control is laid out`)
    if (!ready) continue

    check(await p.evaluate((k) => !document.querySelector(`[data-testid="tb-score-select-${k}"]`), KEY),
      `${width}: R1 the select is GONE`)
    check(await p.evaluate((k) => !document.querySelector(`[data-testid="tb-anchors-toggle-${k}"]`), KEY),
      `${width}: R4 Show definitions is GONE`)

    // ── THE MOUSE PASS, with the anchor READ BEFORE the click ────────────
    await hoverBtn(3)
    const before = await popup()
    console.log(`  ${width}: anchor on hover of 3 -> ${JSON.stringify(before)}`)
    check(before.shown && before.text.length > 10,
      `${width}: R1 hovering 3 SHOWS its anchor before any click ("${before.text.slice(0, 48)}...")`)
    check(before.w <= 420, `${width}: R2 the 420px clamp is carried over (${before.w}px)`)
    // ── WHERE IT SITS IS A RELATIONSHIP, NOT A PROPERTY ─────────────────
    //
    // The first run of this probe passed 34/34 with the popup rendering at the
    // TOP LEFT OF THE PAGE, roughly 700px from the number it explains, because
    // the group had no `position` and an absolutely positioned box resolves
    // against the nearest positioned ancestor - which was the document.
    //
    // Every assertion was about the POPUP - shown, sized, clamped - and all of
    // them are true of a box parked anywhere. Found by opening the screenshot.
    // CLAUDE.md records this exact shape: state the claim as two elements and a
    // relation, then assert THAT.
    const rel = await p.evaluate((k) => {
      const box = document.querySelector(`[data-testid="tb-score-anchor-${k}"]`)
      const btn = document.querySelector(`[data-testid="tb-score-btn-${k}-3"]`)
      if (!box || !btn) return null
      const a = box.getBoundingClientRect(), c = btn.getBoundingClientRect()
      return { below: Math.round(a.top - c.bottom), dx: Math.round(Math.abs((a.left + a.width / 2) - (c.left + c.width / 2))) }
    }, KEY)
    console.log(`  ${width}: the popup sits ${JSON.stringify(rel)} from its number`)
    check(!!rel && rel.below >= -4 && rel.below < 80,
      `${width}: R2 the popup HANGS OFF the number it explains (${rel?.below}px below)`)
    check(!!rel && rel.dx < 260,
      `${width}: and is centred on it within the clamp (${rel?.dx}px off centre)`)

    await p.click(`[data-testid="tb-score-btn-${KEY}-3"]`)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    check(await chosen() === '3', `${width}: the click committed 3 as the draft`)
    check(!(await popup()).shown, `${width}: R6 committing DISMISSED the popup`)

    // ── A 2 COMMITTED FROM ITS BARE NUMBER ──────────────────────────────
    await hoverBtn(2)
    const bare = await popup()
    check(!bare.shown, `${width}: R1 hovering 2 shows NOTHING, because it has no anchor`)
    await p.click(`[data-testid="tb-score-btn-${KEY}-2"]`)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    check(await chosen() === '2', `${width}: a 2 commits from its BARE NUMBER`)

    // ── ESCAPE REVERTS ──────────────────────────────────────────────────
    await p.evaluate((k) => {
      document.querySelector(`[data-testid="tb-score-btn-${k}-2"]`)
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }, KEY)
    await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
    check(await chosen() === '', `${width}: R3 Escape REVERTED the draft (now "${await chosen()}")`)

    // ── THE KEYBOARD-ONLY PASS ──────────────────────────────────────────
    await p.focus(`[data-testid="tb-score-btn-${KEY}-1"]`)
    await p.keyboard.press('ArrowRight')
    await p.keyboard.press('ArrowRight')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 300)))
    const focusNow = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    check(focusNow === `tb-score-btn-${KEY}-3`, `${width}: R3 arrows walked to 3 (focus ${focusNow})`)
    const onFocus = await popup()
    check(onFocus.shown, `${width}: R3 and the popup FOLLOWED the focus`)
    await p.keyboard.press('Enter')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 500)))
    check(await chosen() === '3', `${width}: R3 Enter committed the focused number`)
    check(!(await popup()).shown, `${width}: R6 and committing by keyboard dismissed it too`)

    const shot = `${OUT}step3-${width}-${tb.bedId.slice(0, 8)}.png`
    await hoverBtn(5)
    await p.screenshot({ path: shot })
    console.log(`  ${width}: screenshot ${shot}`)
  }

  // ── AWAITING-REASON END TO END, then READ BACK FROM THE DATABASE ──────
  console.log('\n  ══ awaiting-reason, and the write ══')
  const start = await scoresOf(tb.bedId, KEY)
  await p.click(`[data-testid="tb-score-btn-${KEY}-1"]`)   // level 1 requires a reason
  await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  const locked = await p.evaluate((k) => {
    const rec = document.querySelector('[data-testid="tb-score-record"]')
    return { recordDisabled: !!rec && rec.disabled,
      reasonBox: !!document.querySelector(`[data-testid="tb-score-reason-${k}"]`) }
  }, KEY)
  console.log(`  ${JSON.stringify(locked)}`)
  check(locked.reasonBox, 'R5 the reason box opened for a level that requires one')
  check(locked.recordDisabled, 'and Record is refused until it is given')

  await p.focus(`[data-testid="tb-score-reason-${KEY}"]`)
  await p.keyboard.type('Measured on the live screen by the Step 3 probe.')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  check(!(await p.evaluate(() => document.querySelector('[data-testid="tb-score-record"]')?.disabled)),
    'giving the reason RELEASED Record')

  await p.evaluate(() => {
    const b2 = document.querySelector('[data-testid="tb-score-record"]')
    b2?.scrollIntoView({ block: 'center' }); b2?.click()
  })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 3000)))
  const after = await scoresOf(tb.bedId, KEY)
  console.log(`  entries ${start.entries.length} -> ${after.entries.length}, revision ${start.revision} -> ${after.revision}`)
  const last = after.entries[after.entries.length - 1]
  check(after.entries.length === start.entries.length + 1,
    `the score REACHED THE DATABASE (${start.entries.length} -> ${after.entries.length} entries)`)
  check(last && Number(last.value) === 1, `and it is the 1 that was clicked (${JSON.stringify(last?.value)})`)
  check(!!last?.reason, `with the reason the lock demanded (${JSON.stringify(String(last?.reason ?? '').slice(0, 40))})`)
} finally {
  await b.close()
  console.log(`\n  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
