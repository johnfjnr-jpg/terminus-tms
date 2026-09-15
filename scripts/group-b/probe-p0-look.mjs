// Group B Phase 0: LOOK at both screens before changing either, and measure
// where the white actually is rather than inferring it from the markup.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-look.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/group-b/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin()
const pick = async (t) => (await db.from('records').select('id')
  .eq('record_type', t).is('deleted_at', null).limit(1)).data?.[0]?.id
const acct = await pick('account')
const opp = await pick('opportunity')
console.log(`account ${acct}\nopportunity ${opp}\n`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  // A light background on a dark screen is what "white" means here, measured
  // rather than eyeballed: parse the computed colour and score its lightness.
  const whites = () => p.evaluate(() => {
    const light = (c) => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '')
      if (!m) return false
      const [r, g, bl] = [+m[1], +m[2], +m[3]]
      return (r + g + bl) / 3 > 140
    }
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const out = []
    for (const e of document.querySelectorAll('input,select,textarea,button')) {
      if (!vis(e)) continue
      const cs = getComputedStyle(e)
      if (light(cs.backgroundColor)) {
        out.push({ tag: e.tagName, id: e.id || null, cls: e.className || null, bg: cs.backgroundColor })
      }
    }
    return out
  })

  await p.evaluate((id) => navigate('account-detail', id), acct)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-account-detail')
    return !!v && !v.classList.contains('hidden')
      && !/Loading/.test(v.textContent || '')
      && !!v.querySelector('#acct-contacts-list')
  }, { timeout: 30000 }).catch(() => console.log('  account view did not settle'))
  await new Promise((r) => setTimeout(r, 1200))
  const acctWhite = await whites()
  console.log(`ACCOUNTS: ${acctWhite.length} light-background controls`)
  for (const w of acctWhite.slice(0, 6)) console.log('   ', JSON.stringify(w))
  await p.screenshot({ path: `${OUT}p0-account.png` })

  // WAIT ON REAL STATE, not a delay. The first version used a fixed 2.5s and
  // photographed "Loading the record..." - so its count was of a loading
  // screen, not of the surface (V6).
  await p.evaluate((id) => navigate('opportunity-detail', id), opp)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    return !!v && !v.classList.contains('hidden')
      && !/Loading the record/.test(v.textContent || '')
      && v.querySelectorAll('input,select,textarea').length > 5
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))
  const oppRef = await whites()
  console.log(`\nOPPORTUNITY / Reference tab: ${oppRef.length} light-background controls`)
  await p.screenshot({ path: `${OUT}p0-opp-reference.png` })

  // THE COMMERCIALS TAB, where the unclassed static inputs live.
  await p.click('[data-opp-tab="commercial"]')
  await p.waitForFunction(() => {
    const el = document.getElementById('deal-ssExisting')
    return !!el && el.getBoundingClientRect().height > 0
  }, { timeout: 20000 }).catch(() => console.log('  commercials panel did not settle'))
  await new Promise((r) => setTimeout(r, 1200))
  const oppWhite = await whites()
  console.log(`OPPORTUNITY / Commercials tab: ${oppWhite.length} light-background controls`)
  const byCls = {}
  for (const w of oppWhite) { const k = w.cls || '(no class)'; byCls[k] = (byCls[k] || 0) + 1 }
  for (const [k, n] of Object.entries(byCls).slice(0, 8)) console.log(`    ${n.toString().padStart(3)}  ${k}`)
  await p.screenshot({ path: `${OUT}p0-opp-commercials.png` })
} finally { await b.close() }
