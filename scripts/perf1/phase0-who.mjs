// PHASE 0 (b): WHICH CONSUMERS ACTUALLY FIRE, PER VIEW, AND FROM WHERE
//
// A source census names call SITES. It cannot say which of them RUN on a
// given view, and this round's build is about what a page load does. So the
// initiator stack of every `/api/contacts` request is read from CDP, which
// names the function and the bundle position that issued it.
//
// Verification 19: an enumeration by name fails by silent omission. This
// enumerates by what the page DID.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('perf1/phase0-who.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
mkdirSync(`${ROOT}/.verify/perf1/`, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const one = async (t) => must(await db.from('records').select('id')
  .eq('record_type', t).is('deleted_at', null).limit(1), t)[0]?.id

const VIEWS = [
  ['leads (landing)', 'navigate("leads")'],
  ['contacts list', 'navigate("contacts")'],
  ['contact detail', `navigate("contact-detail","${await one('contact')}")`],
  ['opportunity detail', `navigate("opportunity-detail","${await one('opportunity')}")`],
  ['test bed detail', `navigate("test-bed-detail","${await one('test_bed')}")`],
]

const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const [name, go] of VIEWS) {
    const p = await b.newPage()
    const cdp = await p.createCDPSession()
    await cdp.send('Network.enable')
    const seen = []
    cdp.on('Network.requestWillBeSent', (e) => {
      if (!e.request.url.includes('/api/contacts')) return
      if (e.request.url.includes('creation-requirements')) return   // a different route
      const frames = e.initiator?.stack?.callFrames ?? []
      // The first frame with a real function name that is not the transport.
      const named = frames.map((f) => f.functionName).filter(Boolean)
        .filter((n) => !/^(api|fetch|request|Promise)$/.test(n))
      seen.push({
        url: e.request.url.replace('http://127.0.0.1:3000', ''),
        via: named.slice(0, 4).join(' <- ') || '(no named frame)',
        top: frames[0] ? `${(frames[0].url || '').split('/').pop()}:${frames[0].lineNumber}` : '-',
      })
    })
    await p.setViewport({ width: 1440, height: 1000 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    seen.length = 0                       // count the VIEW, not the boot
    await p.evaluate((src) => { (0, eval)(src) }, go)
    try { await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 }) } catch {}
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
    console.log(`\n${name}: ${seen.length} full-list request(s)`)
    for (const s of seen) console.log(`   ${s.url.padEnd(34)} via ${s.via}`)
    await p.close()
  }

  // AND THE BOOT ITSELF, which is what the walk-10 diagnosis measured.
  const p = await b.newPage()
  const cdp = await p.createCDPSession()
  await cdp.send('Network.enable')
  const boot = []
  cdp.on('Network.requestWillBeSent', (e) => {
    if (!e.request.url.includes('/api/contacts') || e.request.url.includes('creation-requirements')) return
    const frames = e.initiator?.stack?.callFrames ?? []
    boot.push((frames.map((f) => f.functionName).filter(Boolean)
      .filter((n) => !/^(api|fetch|request|Promise)$/.test(n)).slice(0, 4).join(' <- ')) || '(no named frame)')
  })
  await p.setViewport({ width: 1440, height: 1000 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  console.log(`\nBOOT (reload onto the landing view): ${boot.length} full-list request(s)`)
  for (const s of boot) console.log(`   via ${s}`)
  await p.close()
} finally { await b.close() }
