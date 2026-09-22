// ITEM 4's EVIDENCE: is it the PAGE LIFETIME, or the wait?
//
// The park's diagnosis was that `networkidle0` degrades on a long-lived page:
// isolated, a reload on this surface settles in about 3s, and inside
// `probe-readonly-view` it exceeds the 30s navigation ceiling. Each isolated
// sample used a FRESH browser; the probe reuses ONE page across six passes.
//
// That is a hypothesis until both shapes are measured on the same machine in
// the same minutes, which is what this does. It replicates the probe's own
// loop - setViewport, goto, set session, reload(networkidle0), navigate -
// and reports the settle time PER ITERATION under each shape.
//
// It asserts nothing. It is a measurement, and its output is the evidence for
// or against the repair.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk10/ab-page-lifetime.mjs')
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const APP = 'http://127.0.0.1:3000'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const ids = must(await db.from('records').select('id')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(3), 'opps').map((r) => r.id)

const CEILING = 30000   // the probe's own navigation ceiling

// One pass of the probe's loop. `fresh` decides the shape under test.
async function pass(browser, page, width, id) {
  await page.setViewport({ width, height: 900 })
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const t = Date.now()
  let ok = true
  try { await page.reload({ waitUntil: 'networkidle0', timeout: CEILING }) } catch { ok = false }
  const ms = Date.now() - t
  if (ok) {
    await page.evaluate((rid) => navigate('opportunity-detail', rid), id)
    // Let the view do its work, as the probe does, so the page accumulates
    // the same state a real pass leaves behind.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
  }
  return { ok, ms }
}

async function run(shape) {
  const browser = await puppeteer.launch({ headless: 'new' })
  const out = []
  let page = shape === 'old' ? await browser.newPage() : null
  let n = 0
  for (const width of [1240, 1920]) {
    for (const id of ids) {
      n += 1
      // THE ONLY DIFFERENCE BETWEEN THE TWO SHAPES.
      if (shape === 'fresh') page = await browser.newPage()
      const r = await pass(browser, page, width, id)
      if (shape === 'fresh') await page.close()
      out.push({ n, ...r })
    }
  }
  await browser.close()
  return out
}

const REPEATS = 3
for (const shape of ['old', 'fresh']) {
  console.log(`\n══ SHAPE: ${shape === 'old' ? 'ONE LONG-LIVED PAGE (as shipped)' : 'FRESH PAGE PER ITERATION'} ══`)
  const perIter = {}
  for (let r = 1; r <= REPEATS; r++) {
    const res = await run(shape)
    console.log(`  run ${r}: ` + res.map((x) => x.ok ? `${x.ms}` : `TIMEOUT@${x.ms}`).join('  '))
    for (const x of res) (perIter[x.n] ??= []).push(x)
  }
  console.log(`  ── per iteration, ${REPEATS} runs ──`)
  for (const n of Object.keys(perIter)) {
    const xs = perIter[n]
    const good = xs.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b)
    const to = xs.filter((x) => !x.ok).length
    console.log(`    iteration ${n}: ${xs.length - to}/${xs.length} settled`
      + (good.length ? `, min ${good[0]} median ${good[Math.floor(good.length / 2)]} max ${good[good.length - 1]}` : '')
      + (to ? `   ${to} TIMEOUT(S) at the ${CEILING}ms ceiling` : ''))
  }
  const six = perIter[6] ?? []
  const sg = six.filter((x) => x.ok).map((x) => x.ms)
  console.log(`  ITERATION 6: ${sg.length}/${six.length} settled`
    + (sg.length ? `, ${sg.sort((a, b) => a - b).join(' / ')}ms` : '')
    + (six.length - sg.length ? `, ${six.length - sg.length} TIMED OUT` : ''))
}
