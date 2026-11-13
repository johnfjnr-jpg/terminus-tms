// DEAL DYNAMICS Phase 2: the lens roll-ups, captured so a before and an after
// can be compared byte for byte.
//
//   PUPPETEER_PATH=<dir>/node_modules/puppeteer \
//     node --env-file=.env scripts/deal-dynamics/probe-rollups.mjs <label> <outdir>
//
// UNWIRED, deliberately: a round proof for the satisfies flag, run by hand
// before and after the change. It is not a standing check.
//
// Three readings per run, each written to <outdir>/dd-rollups-<label>.json:
//   rollups   every scored opportunity, every lens, the five assessed stages,
//             computed by the page's own oppLensRollup against the page's own
//             criteria cache - so a stage tab that renders no card still counts
//   dom       the rendered "Assessment by lens" block on each stage tab that
//             shows one, as outerHTML
//   testBed   GET /api/scoring-criteria?record_type=test_bed, the body re-serialised
//   oppNoSat  GET /api/scoring-criteria?record_type=opportunity, with any
//             `satisfies` key removed from each level, so the only difference
//             the change is allowed to make is visible as that key and nothing else
//
// Read only. It counts every non-GET request to /api and fails if any is sent.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { api } from '../api-client.mjs'

const [label, outDir] = process.argv.slice(2)
if (!label || !outDir) { console.error('usage: probe-rollups.mjs <label> <outdir>'); process.exit(2) }
const puppeteer = await loadPuppeteer('deal-dynamics/probe-rollups.mjs')
const BASE = 'http://127.0.0.1:3000'
const STAGES = ['Qualification', 'Solution Alignment', 'Proposal', 'Evaluation', 'Negotiating']
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const S = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// ── the population: every live opportunity holding at least one score entry ──
const crits = must(await db.from('scoring_criteria').select('criterion_key').eq('record_type', 'opportunity'), 'criteria')
const opps = must(await db.from('records').select('id, status').eq('record_type', 'opportunity').is('deleted_at', null), 'opportunities')
const scored = []
for (const o of opps) {
  const r = must(await db.from('record_revisions').select('payload').eq('record_id', o.id)
    .order('revision_number', { ascending: false }).limit(1).maybeSingle(), `revision ${o.id}`)
  const n = crits.reduce((a, c) => a + (Array.isArray(r?.payload?.[c.criterion_key]) ? r.payload[c.criterion_key].length : 0), 0)
  if (n > 0) scored.push({ id: o.id, status: o.status, entries: n })
}
scored.sort((a, b) => a.id.localeCompare(b.id))
console.log(`live opportunities ${opps.length}, scored ${scored.length}: ${scored.map((s) => `${s.status}/${s.entries}`).join(', ')}`)
if (!scored.length) { console.error('no scored opportunity, so there is nothing to compare'); process.exit(3) }

// ── the two responses, through the one throwing client ──
// Serialised back from the parsed body, which keeps key order, so any change to
// a key, a value or their order still shows as a different string.
const testBed = JSON.stringify((await api('GET', '/scoring-criteria?record_type=test_bed')).data)
const oppRaw = (await api('GET', '/scoring-criteria?record_type=opportunity')).data
const satisfiesSeen = oppRaw.flatMap((c) => c.levels ?? []).filter((l) => 'satisfies' in l).length
const oppNoSat = JSON.stringify(oppRaw.map((c) => ({ ...c, levels: (c.levels ?? []).map(({ satisfies, ...l }) => l) })))

const browser = await puppeteer.launch({ headless: 'new' })
const writes = []
const out = { label, at: new Date().toISOString(), scored, rollups: {}, dom: {}, testBed, oppNoSat, satisfiesSeen }
try {
  for (const rec of scored) {
    // A FRESH PAGE PER RECORD, so no stage panel can still hold the previous
    // record's card when the wait below is asked whether this one has rendered.
    const p = await browser.newPage()
    p.on('request', (rq) => { if (rq.method() !== 'GET' && rq.url().includes('/api/')) writes.push(`${rq.method()} ${rq.url()}`) })
    await p.setViewport({ width: 1440, height: 1000 })
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    // Waits on THIS record: the id the detail render writes, and both caches.
    await p.waitForFunction((id) => currentOppDetailId === id && Array.isArray(oppCriteria) && Array.isArray(oppLenses),
      { timeout: 30000 }, rec.id)

    // The page payload must be this record's, by the same count the DB gave.
    const pageEntries = await p.evaluate(() => oppCriteria.reduce((a, c) => a + oppAssessSeries(c.criterion_key).length, 0))
    if (pageEntries !== rec.entries) throw new Error(`${rec.id}: page holds ${pageEntries} entries, DB ${rec.entries}`)

    out.rollups[rec.id] = await p.evaluate((stages) => Object.fromEntries(stages.map((st) =>
      [st, oppLenses.map((l) => oppLensRollup(l, st, oppCriteria))])), STAGES)

    const tabs = await p.evaluate((stages) => stages.filter((st) =>
      !!document.querySelector(`#view-opportunity-detail [data-opp-tab="${oppStageTabKey(st)}"]`)), STAGES)
    out.dom[rec.id] = {}
    for (const st of tabs) {
      await p.evaluate((s) => document.querySelector(`#view-opportunity-detail [data-opp-tab="${oppStageTabKey(s)}"]`).click(), st)
      const html = await p.waitForFunction((s) => {
        const el = document.querySelector(`#opp-stage-criteria-${oppStageTabKey(s)} .opp-lens-rollups`)
        return el && el.querySelectorAll('.opp-lens-rollup').length === oppLenses.length ? el.outerHTML : null
      }, { timeout: 8000 }, st).then((h) => h.jsonValue()).catch(() => null)
      out.dom[rec.id][st] = html
    }
    await p.close()
  }
} finally { await browser.close() }

out.writes = writes
const file = `${outDir}/dd-rollups-${label}.json`
writeFileSync(file, JSON.stringify(out, null, 2))

const cells = Object.values(out.rollups).reduce((a, byStage) => a + Object.values(byStage).flat().length, 0)
const domN = Object.values(out.dom).reduce((a, m) => a + Object.values(m).filter(Boolean).length, 0)
const domTried = Object.values(out.dom).reduce((a, m) => a + Object.keys(m).length, 0)
console.log(`rollup cells ${cells}; dom blocks ${domN} of ${domTried} stage tabs; testBed ${testBed.length}B sha ${sha(testBed)}; opp(no satisfies) sha ${sha(oppNoSat)}; satisfies keys seen ${satisfiesSeen}`)
console.log(`non-GET api requests: ${writes.length}`)
console.log(`written ${file}`)
if (writes.length) process.exit(4)
