// ── THE CHANGED SITES, PHOTOGRAPHED AND READ, AT 1240 AND 1920 ──────────
//
// L1 and L4 are the cosmetic tier: the affected suites, plus a screenshot of
// every changed site at both widths, opened and read.
//
// IT ASSERTS BEFORE IT PHOTOGRAPHS. A screenshot proves what a person sees only
// once something has confirmed the element is in the captured region, and the
// capture comes after every measurement so the instrument cannot perturb what
// it measures (Verification 4).
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-label-convergence-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/label-convergence/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'LABELCONV'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const mk = async (inputs, reason) => (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs, rates: frozenRates(resolveRates(inputs, LIVE)), reason, expected_revision: await rev() })).data

// A ladder with a promoted major AND a newer draft, so the card shows both the
// three-state badge and the promotion control's ruled wording.
await mk({ targetMargin: 30 }, 'first draft')
const second = await mk({ targetMargin: 31 }, 'second draft')
await api('POST', `/deal-sheet-versions/${second.id}/issue`, {})
await mk({ targetMargin: 32 }, 'a draft after the major')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1920, 1240]) {
    errs.length = 0
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)

    console.log(`\n=== ${width}px ===`)

    // ── SITE 1: THE HEADLINE STRIP ──────────────────────────────────────
    const strip = await p.evaluate(() => {
      const t = (el) => (el?.textContent ?? '').trim()
      // `.ohl-figure`, read off `oppHeadlineFigure` rather than guessed. A
      // first draft guessed `.stat-cell` and read null for every field, which
      // is a probe selector failing and would have read as a missing figure.
      const cells = [...document.querySelectorAll('.ohl-figure')]
      const find = (label) => {
        const c = cells.find((e) => t(e.querySelector('.ohl-label')) === label)
        return c ? t(c.querySelector('.ohl-value')) : null
      }
      return { approved: find('Approved version'), working: find('Working version'),
        all: cells.map((e) => `${t(e.querySelector('.ohl-label'))}=${t(e.querySelector('.ohl-value'))}`) }
    })
    check(strip.approved !== null, `the Approved version field renders at ${width}`,
      `"${strip.approved}"`)
    // R-L4a: promoted, nobody signed, so it must NOT name a version.
    check(strip.approved === 'None' || /^none$/i.test(String(strip.approved)),
      `and reads None on a promoted-but-unsigned deal at ${width}`, `"${strip.approved}"`)
    check(/V\d+\.\d+/.test(String(strip.working)),
      `the Working version carries a minor at ${width}`, `"${strip.working}"`)

    // ── SITE 2: THE VERSION CARD ────────────────────────────────────────
    await p.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
    await p.waitForFunction(() => document.getElementById('btn-issue-version'), { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const card = await p.evaluate(() => {
      const t = (el) => (el?.textContent ?? '').trim()
      const rows = [...document.querySelectorAll('.ds-row')].map(t)
      return {
        rows,
        promote: t(document.getElementById('btn-issue-version')),
        labels: [...document.querySelectorAll('.ds-label')].map(t),
      }
    })
    // R-VL4: every label on the ladder carries its minor.
    const bare = card.labels.filter((l) => /^V\d+(?!\.)\b/.test(l))
    check(bare.length === 0, `every version label carries its minor at ${width}`,
      bare.length ? bare.join(' | ') : card.labels.join(' | '))
    // R-L4: the three states, and never the DB word.
    check(card.rows.some((r) => /awaiting approval/i.test(r)),
      `the promoted version reads "awaiting approval" at ${width}`)
    check(!card.rows.some((r) => /\bissued\b/i.test(r)),
      `and no row says "issued" at ${width}`,
      card.rows.filter((r) => /\bissued\b/i.test(r)).join(' | '))
    // R-L4: John's ruled wording on the promotion control.
    check(/^Submit V[\d.]+ as V\d+\.0 for approval$/.test(card.promote),
      `the promotion control carries the ruled wording at ${width}`, `"${card.promote}"`)

    check(errs.length === 0, `no page errors at ${width}`, errs.join(' | '))

    // ── CAPTURE, AFTER EVERY MEASUREMENT, WITH THE CARD IN VIEW ─────────
    await p.evaluate(() => document.getElementById('btn-issue-version')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const r = document.getElementById('btn-issue-version')?.getBoundingClientRect()
      return r ? r.top < window.innerHeight && r.bottom > 0 : false
    })
    check(inView, `the version card is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}versions-${width}.png` })

    // ── THE HEADLINE STRIP, IN THE CAPTURED REGION ──────────────────────
    //
    // A first version clicked to the Reference tab and scrolled to the top,
    // and produced an image with the strip nowhere in it: the figures had been
    // MEASURED and the picture showed a different part of the page. Evidence of
    // nothing, and it looked like diligence (Verification 4).
    await p.evaluate(() => document.querySelector('.ohl-figure')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const stripInView = await p.evaluate(() => {
      const cells = [...document.querySelectorAll('.ohl-figure')]
      const wanted = cells.find((e) => (e.querySelector('.ohl-label')?.textContent ?? '').trim() === 'Approved version')
      const r = wanted?.getBoundingClientRect()
      return r ? r.top < window.innerHeight && r.bottom > 0 : false
    })
    check(stripInView, `the Approved version field is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}headline-${width}.png` })
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} live checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
