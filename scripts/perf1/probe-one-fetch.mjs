// THE GUARD: ONE FULL-LIST CONTACTS FETCH PER PAGE LOAD
//
// Phase 0 measured a boot issuing FIVE, four of them from `loadContactsData`
// because `showApp` calls `navigate` four times. This asserts the number the
// build produced, at both widths, from the browser's own request log.
//
// ── WHAT IT COUNTS, AND WHAT IT DOES NOT ────────────────────────────────
//
// `/api/contacts/creation-requirements` is a DIFFERENT ROUTE that happens to
// share the prefix, and it costs 3ms against the list's 867ms. Counting it
// would inflate every reading and hide the thing being measured. Excluded by
// name, and the exclusion is asserted rather than assumed: the probe reports
// it separately so a reader can see it was seen.
//
// THE SCOPED CALL IS COUNTED SEPARATELY TOO. W3's picker asks for one
// account's contacts and keeps its scoping; it is not part of the pile-up and
// must not be deduplicated into the full list.
//
// CALIBRATED BY UN-DEDUPLICATING: `scripts/perf1/calibrate.mjs` removes the
// shared cache and this assertion goes red on the named check.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('perf1/probe-one-fetch.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
mkdirSync(`${ROOT}/.verify/perf1/`, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
const one = async (t) => must(await db.from('records').select('id')
  .eq('record_type', t).is('deleted_at', null).limit(1), t)[0]?.id
const contactId = await one('contact')
const tbId = await one('test_bed')

// ── THE LATENCY ASSERTION ────────────────────────────────────────────────
//
// Verification 48: never assert a SINGLE measured duration against a fixed
// threshold - that is a lottery ticket, and a heavy tail crosses any ceiling
// eventually. This samples and asserts the MINIMUM, because timing noise is
// additive: the minimum is a lower bound on the true cost and discards
// exactly the samples that are noise. A real regression raises the floor.
//
// THE CEILING IS THE REQUIREMENT, NOT THE RESULT (Verification 47). The
// route made five to six sequential round trips when Phase 0 read it and one
// round trip measures ~119ms, so anything at or under 2,000ms is the route
// this round inherited. It is NOT set just above the measured 749ms, which
// would be a tautology wearing a threshold and would go red on an ordinary
// bad afternoon.
const LATENCY_CEILING_MS = 2000
const samples = []
for (let i = 0; i < 8; i++) {
  const t = Date.now(); await api('GET', '/contacts'); samples.push(Date.now() - t)
}
const minMs = Math.min(...samples)
check(minMs <= LATENCY_CEILING_MS,
  `GET /contacts floor is within the ceiling this round inherited`,
  `min ${minMs}ms of 8 against ${LATENCY_CEILING_MS}ms  [${samples.join(', ')}]`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    const p = await b.newPage()
    const cdp = await p.createCDPSession()
    await cdp.send('Network.enable')
    const full = [], scoped = [], other = []
    cdp.on('Network.requestWillBeSent', (e) => {
      const u = e.request.url
      if (!u.includes('/api/contacts')) return
      if (u.includes('creation-requirements')) { other.push(u); return }
      if (u.includes('account_id=')) { scoped.push(u); return }
      full.push(u)
    })
    // ── THE SESSION IS SEEDED BEFORE THE DOCUMENT EXISTS ────────────────
    //
    // Verification 45, and this probe needed it. The first version did
    // `goto` then set localStorage then `reload`, and read TWO boot fetches
    // on four runs of five. The extra one arrives 2ms after the reload
    // starts and belongs to the PRE-RELOAD document: setting the session on a
    // signed-out page boots it, and the reload then catches its request.
    //
    // It reads exactly like the product failing to deduplicate, and it is the
    // harness counting two boots as one. Seeded before the document, there is
    // one boot to count and the reading is 1 of 1 on five consecutive runs.
    await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
      'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.setViewport({ width, height: 1000 })

    // ── BOOT ─────────────────────────────────────────────────────────────
    full.length = 0; scoped.length = 0; other.length = 0
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
    const bootFull = full.length, bootOther = other.length
    check(bootFull === 1,
      'BOOT makes exactly ONE full-list contacts fetch', `${bootFull} (was 5 before this round)`)
    console.log(`        and ${bootOther} creation-requirements call(s), a different route, not counted`)

    // ── NAVIGATION WITHIN THE SHARED WINDOW ─────────────────────────────
    for (const [name, go] of [
      ['contacts list', 'navigate("contacts")'],
      ['leads list', 'navigate("leads")'],
      ['test bed detail', `navigate("test-bed-detail","${tbId}")`],
    ]) {
      full.length = 0
      await p.evaluate((src) => { (0, eval)(src) }, go)
      try { await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 }) } catch {}
      await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))
      check(full.length === 0,
        `navigating to ${name} adds NO full-list fetch`, `${full.length}`)
    }

    // ── A CONSUMER THAT STILL FETCHES, AND MUST ─────────────────────────
    // The contact view reads one record out of the list. It shares the key,
    // and it REFETCHES on every navigation on purpose: a walk measured a
    // qualified contact reading "Unqualified" on the next visit. So one
    // request here is the correct answer, not a miss.
    full.length = 0
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("contact-detail","${contactId}")`)
    try { await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 }) } catch {}
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))
    check(full.length === 1,
      'the contact view refetches ONCE, which its navigation contract requires',
      `${full.length}`)

    // ── AND THE SCOPED CALL KEEPS ITS SCOPING ───────────────────────────
    scoped.length = 0; full.length = 0
    const oppId = await one('opportunity')
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    try { await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 }) } catch {}
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
    check(scoped.length >= 1 && full.length === 0,
      'W3\'s picker still asks for ONE account, and was not folded into the full list',
      `${scoped.length} scoped, ${full.length} full`)
    await p.close()
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
