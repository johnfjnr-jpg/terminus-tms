// ── R7: THE BUDGET FIGURE RENDERS ONLY AT A FIGURE-BEARING LEVEL ─────────
//
// John's ruling on the Opportunity surface. The figure and currency inputs
// render ONLY at Our hypothesis (3), Buyer confirmed (4) or Verified (5), and
// are hidden for Not applicable (1) and Unknown (2).
//
// THE CLAUSE THAT MATTERS MOST IS THE PRESERVATION ONE: a stored figure is
// never cleared when the level drops, and comes back when a figure-bearing
// level returns. Hiding a control is exactly how a value gets deleted - the
// control that edits a value is also what supplies it on save - so the database
// is read directly rather than the screen being trusted.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates an Opportunity.
// Run: PUPPETEER_PATH=... node scripts/scoring/probe-r7-budget.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('scoring/probe-r7-budget.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/scoring/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin()
const TAG = 'v9r7'
const KEY = 'assessCommBudgetConfirmed'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

// The stored answer, read from the record rather than from the screen.
const storedAnswer = async (id) => {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'rev')
  const series = rev[0]?.payload?.[KEY]
  const last = Array.isArray(series) ? series[series.length - 1] : undefined
  return { level: last?.value ?? null, answer: last?.answer ?? null, entries: Array.isArray(series) ? series.length : 0 }
}

const opp = await freshOpportunity(TAG)
const oppId = opp.oppId ?? opp.opportunityId
console.log(`opportunity ${oppId}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await p.waitForFunction(() => !!document.getElementById('opp-assessment-mount'), { timeout: 30000 })
  await p.evaluate(() => document.querySelector('[data-opp-tab="assessment"]')?.click())
  await p.waitForFunction((k) => {
    const g = document.querySelector(`.opp-assess-levels [data-criterion="${k}"]`)
    return !!g && g.closest('.opp-assess-levels').getBoundingClientRect().width > 50
  }, { timeout: 30000 }, KEY).catch(() => false)

  const boxState = () => p.evaluate((k) => {
    const amt = document.getElementById(`opp-assess-amount-${k}`)
    const cur = document.getElementById(`opp-assess-currency-${k}`)
    const vis = (e) => !!e && e.getBoundingClientRect().height > 0
    return { present: !!amt, visible: vis(amt), currencyVisible: vis(cur), value: amt?.value ?? null }
  }, KEY)
  const setLevel = async (v) => {
    await p.evaluate((k, lv) => {
      const el = document.querySelector(`[data-criterion="${k}"][data-level="${lv}"].opp-assess-level-input`)
      el?.scrollIntoView({ block: 'center' })
      el?.click()
    }, KEY, String(v))
    await p.evaluate(() => new Promise((r) => setTimeout(r, 500)))
  }

  // ── Buyer confirmed (4): the figure renders ─────────────────────────────
  await setLevel(4)
  let s = await boxState()
  console.log(`  level 4: ${JSON.stringify(s)}`)
  check(s.visible && s.currencyVisible, 'at Buyer confirmed the figure and currency RENDER')

  await p.evaluate((k) => { const e = document.getElementById(`opp-assess-amount-${k}`); e.focus() }, KEY)
  await p.keyboard.type('250000')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 200)))

  // ── RECORD IT THROUGH THE REAL CONTROL ─────────────────────────────────
  //
  // The first version clicked "the first enabled button whose text matches
  // record or save", which found something and recorded NOTHING - the probe
  // read `entries: 0` and every preservation check below it became a comparison
  // with nothing on either side. The surface's own control is
  // `saveAllOppAssess()`, on the assessment save bar.
  const saved = await p.evaluate(() => {
    const bar = document.getElementById('opp-assess-savebar')
    const btn = [...(bar?.querySelectorAll('button') ?? [])]
      .find((x) => /record/i.test(x.textContent ?? '') && !x.disabled)
    if (!btn) return { clicked: false, barHidden: bar?.classList.contains('hidden') ?? null }
    btn.scrollIntoView({ block: 'center' })
    btn.click()
    return { clicked: true, barHidden: false }
  })
  console.log(`  record control: ${JSON.stringify(saved)}`)
  check(saved.clicked, `the assessment save bar offered a Record control (${JSON.stringify(saved)})`)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 3000)))
  const afterSave = await storedAnswer(oppId)
  console.log(`  stored after saving at 4: ${JSON.stringify(afterSave)}`)
  check(afterSave.answer && Number(afterSave.answer.amount) === 250000,
    `the figure REACHED the database (${JSON.stringify(afterSave.answer)})`)

  // ── Drop to Unknown (2): hidden on screen, INTACT in the database ───────
  await setLevel(2)
  s = await boxState()
  console.log(`  level 2: ${JSON.stringify(s)}`)
  check(!s.visible && !s.currencyVisible,
    `at Unknown the figure and currency are HIDDEN (visible: ${s.visible}/${s.currencyVisible})`)
  const afterDrop = await storedAnswer(oppId)
  console.log(`  stored after dropping to 2: ${JSON.stringify(afterDrop)}`)
  check(afterDrop.answer && Number(afterDrop.answer.amount) === 250000,
    `and the STORED FIGURE IS INTACT, never cleared (${JSON.stringify(afterDrop.answer)})`)

  // ── Not applicable (1): hidden too ─────────────────────────────────────
  await setLevel(1)
  s = await boxState()
  check(!s.visible, `at Not applicable the figure is HIDDEN (visible: ${s.visible})`)

  // ── Back up to Verified (5): the figure is on screen again ─────────────
  await setLevel(5)
  s = await boxState()
  console.log(`  level 5: ${JSON.stringify(s)}`)
  check(s.visible && s.currencyVisible, 'raising to Verified shows the figure again')
  check(String(s.value) === '250000',
    `and it is THE STORED FIGURE, back on screen (${JSON.stringify(s.value)})`)

  await p.evaluate((k) => document.getElementById(`opp-assess-amount-${k}`)?.scrollIntoView({ block: 'center' }), KEY)
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const shot = `${OUT}r7-budget-1440-${oppId.slice(0, 8)}.png`
  await p.screenshot({ path: shot })
  console.log(`\n  screenshot: ${shot}`)
} finally {
  await b.close()
  console.log(`  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
