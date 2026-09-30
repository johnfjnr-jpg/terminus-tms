// ── W-LC1: ONE WORD FOR ONE ABSENCE ─────────────────────────────────────
//
// John's walk 2026-09-30, cosmetic tier. The Working Version field said
// "none" and the Approved Version field beside it said "None", so one kind of
// absence was being spelled two ways on one strip - which reads as two
// different states rather than one.
//
// ── WHY BOTH FIELDS ARE READ, AND NOT ONLY THE ONE THAT CHANGED ─────────
//
// A convergence is a claim about a PAIR. Asserting the changed field alone
// passes just as well if the other field moved underneath it, and the thing
// John asked for is that the two AGREE (Verification 14: state the claim as
// two elements and a relation, then assert that).
//
// The counterfactual is stated first: a record that HAS a working version
// must show its label, or "the field reads None" is being satisfied by a
// field that is simply empty.
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-wlc1-version-fields.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/opex-reset/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'WLC1'

const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

// A FRESH opportunity carries no versions at all, which is the state the
// empty word is about.
const { oppId } = await freshOpportunity(TAG)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1920, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    // Wait on the STRIP, not on the view: the figures arrive with the headline.
    await p.waitForFunction(() => document.querySelectorAll('.ohl-figure').length > 0,
      { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const figs = [...document.querySelectorAll('.ohl-figure')].map((f) => ({
        label: (f.querySelector('.ohl-label')?.textContent || '').trim(),
        value: (f.querySelector('.ohl-value')?.textContent || '').trim(),
        missing: !!f.querySelector('.ohl-value.ohl-missing'),
      }))
      const strip = document.querySelector('.ohl-figure')?.closest('div')
      const r = strip?.getBoundingClientRect()
      return { figs, inView: r ? r.top < window.innerHeight && r.bottom > 0 : false }
    })
    const find = (name) => m.figs.find((f) => f.label.toLowerCase() === name)
    const working = find('working version')
    const approved = find('approved version')

    console.log(`\n=== ${width}px ===`)
    // THE INSTRUMENT FIRST: both fields must be on the strip at all, or every
    // assertion below is about a figure that is not there (Verification 14).
    check(!!working && !!approved, `both version fields are on the strip at ${width}`,
      m.figs.map((f) => f.label).join(' | '))
    check(working?.value === 'None', `Working version reads "None" at ${width}`,
      `"${working?.value}"`)
    check(approved?.value === 'None', `Approved version reads "None" at ${width}`,
      `"${approved?.value}"`)
    check(working?.value === approved?.value,
      `and the two AGREE, which is what the convergence claims at ${width}`,
      `"${working?.value}" vs "${approved?.value}"`)
    // Both are absences, so both wear the missing treatment. A field reading
    // None at full weight would look like a recorded value spelled None.
    check(working?.missing === true && approved?.missing === true,
      `both are dressed as ABSENT rather than as a recorded value at ${width}`,
      `working ${working?.missing}, approved ${approved?.missing}`)

    check(m.inView, `the headline strip is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}wlc1-version-fields-${width}.png` })
  }

  // ── THE COUNTERFACTUAL: THE FIELD CAN SAY SOMETHING ELSE ─────────────
  //
  // "It reads None" is worth nothing from a field that reads None whatever
  // the record holds. The same selector is shown returning a real label.
  // Found in the DATABASE, not in a paged list from the page: a list route
  // caps its page, so "no record has one" from the first 60 rows is a claim
  // about 60 rows rather than about the estate (Verification 17's paged-API
  // species). The first attempt read a page and reported the counterfactual
  // unavailable while records carrying versions existed.
  const other = await (async () => {
    const db = admin()
    const { data, error } = await db.from('records')
      .select('id, record_type, deleted_at')
      .eq('record_type', 'opportunity').is('deleted_at', null).limit(400)
    if (error) throw new Error(`counterfactual search: ${error.message}`)
    const ids = (data ?? []).map((r) => r.id)
    const { data: vers, error: vErr } = await db.from('deal_sheet_versions')
      .select('record_id, major, minor').in('record_id', ids).limit(400)
    if (vErr) throw new Error(`counterfactual versions: ${vErr.message}`)
    const hit = (vers ?? [])[0]
    return hit ? { id: hit.record_id } : null
  })()
  if (!other) {
    check(false, 'a record WITH a working version was available for the counterfactual',
      'none found: the counterfactual did NOT run, so the None readings are uncalibrated')
  } else {
    // A FULL RELOAD FIRST. Navigating and then waiting on `.ohl-figure` is
    // satisfied by the PREVIOUS record's strip, which is still on screen: the
    // first version of this read reported "None" for a record the route says
    // carries V2.0, because it measured the fresh opportunity it had just left
    // (Verification 7, a wait the old state already satisfies).
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), other.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
        && document.querySelectorAll('.ohl-figure').length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shown = await p.evaluate(() => {
      const f = [...document.querySelectorAll('.ohl-figure')]
        .find((x) => (x.querySelector('.ohl-label')?.textContent || '').trim().toLowerCase() === 'working version')
      return { value: (f?.querySelector('.ohl-value')?.textContent || '').trim(),
        missing: !!f?.querySelector('.ohl-value.ohl-missing') }
    })
    check(shown.value !== 'None' && shown.value !== '',
      'the SAME field shows a real version label on a record that has one',
      `"${shown.value}"`)
    check(shown.missing === false, 'and is not dressed as absent when it is not')
    check(/^V\d+\.\d+$/.test(shown.value), 'in the one version-label format (R-VL4)', shown.value)
  }

  check(errs.length === 0, 'no page errors throughout', errs.join(' | '))
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} W-LC1 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
