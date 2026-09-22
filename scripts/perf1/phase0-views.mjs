// PHASE 0 (a): HOW MANY /api/contacts PER LOAD, AND WHAT DOES EACH COST?
//
// Measured on the live surface at both widths, with the request log read
// rather than inferred. A fresh page per view, so one view's cache cannot
// answer for the next.
//
// THE NUMBER THAT MATTERS IS NOT THE TOTAL WALL TIME, IT IS HOW MANY DRAWS
// THE PAGE TAKES FROM A HEAVY-TAILED DISTRIBUTION. Phase 0 (c) measured 8
// concurrent copies costing x1.1 each, so they do not contend - but a page
// that waits for the slowest of three is taking three draws, and the maximum
// of N draws from a heavy tail grows with N.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('perf1/phase0-views.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/perf1/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.PERF_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const pick = async (type) => must(await db.from('records').select('id, reference_code')
  .eq('record_type', type).is('deleted_at', null).limit(1), type)[0]
const opp = await pick('opportunity')
const contact = must(await db.from('records').select('id')
  .eq('record_type', 'contact').is('deleted_at', null).limit(1), 'contact')[0]
const tb = await pick('test_bed')

const VIEWS = [
  { name: 'leads list', go: () => navigate('leads') },
  { name: 'contacts list', go: () => navigate('contacts') },
  { name: 'contact detail', go: (id) => navigate('contact-detail', id), id: contact?.id },
  { name: 'opportunity detail', go: (id) => navigate('opportunity-detail', id), id: opp?.id },
  { name: 'test bed detail', go: (id) => navigate('test-bed-detail', id), id: tb?.id },
]

const b = await puppeteer.launch({ headless: 'new' })
const report = []
try {
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    for (const v of VIEWS) {
      // A FRESH PAGE PER VIEW. A reused page carries whatever the previous
      // view cached, and the count would then describe the order the probe
      // happens to visit them in.
      const p = await b.newPage()
      await p.setViewport({ width, height: 1000 })
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
      await p.evaluate((k, val) => localStorage.setItem(k, val),
        'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
      await p.reload({ waitUntil: 'networkidle0' })

      const starts = new Map(); const done = []
      const onReq = (r) => { if (r.url().includes('/api/contacts')) starts.set(r, Date.now()) }
      const onEnd = (r) => {
        const t = starts.get(r); if (!t) return
        done.push({ ms: Date.now() - t, url: r.url().replace('http://127.0.0.1:3000', ''), at: t })
      }
      p.on('request', onReq); p.on('requestfinished', onEnd); p.on('requestfailed', onEnd)

      const t0 = Date.now()
      await p.evaluate(({ src, id }) => { (0, eval)(`(${src})`)(id) },
        { src: v.go.toString(), id: v.id ?? null })
      // Settle on the network going quiet for this view rather than a delay.
      try {
        await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 45000 })
      } catch { /* recorded below as whatever landed */ }
      await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
      const wall = Date.now() - t0
      p.off('request', onReq); p.off('requestfinished', onEnd); p.off('requestfailed', onEnd)

      const scoped = done.filter((d) => d.url.includes('account_id=')).length
      const times = done.map((d) => d.ms).sort((a, b2) => a - b2)
      // Overlap: how many were in flight at once, which is what says these are
      // concurrent copies rather than a sequence.
      const maxInFlight = done.length
        ? Math.max(...done.map((d) => done.filter((o) => o.at <= d.at && o.at + o.ms >= d.at).length))
        : 0
      console.log(`  ${v.name.padEnd(20)} ${String(done.length).padStart(2)} request(s)`
        + `  ${scoped} scoped`
        + `  each ${times.join('/') || '-'}ms`
        + `  slowest ${times[times.length - 1] ?? 0}ms  max in flight ${maxInFlight}  view settled in ${wall}ms`)
      report.push({ width, view: v.name, n: done.length, scoped, times, maxInFlight, wall })
      await p.close()
    }
  }
} finally { await b.close() }
writeFileSync(`${OUT}views-${TAG}.json`, JSON.stringify(report, null, 2))
const total = report.reduce((s, r) => s + r.n, 0)
console.log(`\nTOTAL /api/contacts requests across ${report.length} view loads: ${total}`)
console.log(`written to ${OUT}views-${TAG}.json`)
