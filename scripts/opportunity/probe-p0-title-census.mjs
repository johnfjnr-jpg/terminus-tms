// Q1b: IS THE EMPTY OPPORTUNITY TITLE ONE RECORD OR ALL OF THEM?
//
// The top-region probe found `h1#ref-display-name` rendering EMPTY while the
// record is named in the database. One record is a population of one, so this
// asks the same question of several.
//
// A FULL RELOAD PER RECORD, and that is the whole method rather than a detail.
// The first version navigated list -> detail -> list -> detail and waited on
// `#detail-company` carrying text. That element KEEPS THE PREVIOUS RECORD'S
// text across a navigation, so the wait was satisfied before the new record
// arrived and the same record read "Willowglen" in one run and "Trilogy
// Technologies Pte Ltd" in the next. A reload cannot be satisfied by a state
// the previous record left behind.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-p0-title-census.mjs')
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const S = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
const me = S.user?.id

const recs = must(await db.from('records').select('id, owner_id, status')
  .eq('record_type', 'opportunity').is('deleted_at', null), 'records')
const mine = recs.filter((x) => x.owner_id === me)
console.log(`signed-in user ${me}`)
console.log(`live opportunities ${recs.length}: ${mine.length} owned by this user, ${recs.length - mine.length} by others`)

const payloadName = async (id) => {
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'rev')
  return String(rev[0]?.payload?.name ?? '')
}

const sample = [...mine.slice(0, 3), ...recs.filter((x) => x.owner_id !== me).slice(0, 4)]
const b = await puppeteer.launch({ headless: 'new' })
let empty = 0, filled = 0
try {
  console.log(`\n id        owned  db name              h1 rendered          h1 h  sub line`)
  for (const rec of sample) {
    const dbName = await payloadName(rec.id)
    const p = await b.newPage()
    await p.setViewport({ width: 1240, height: 900 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), rec.id)
    // On a FRESH page the sub-line is empty in the static markup, so text in it
    // can only have come from this record.
    try {
      await p.waitForFunction(() => {
        const c = document.getElementById('detail-company')
        const h = document.getElementById('opp-headline')
        return !!c && (c.textContent ?? '').trim().length > 0
            && !!h && (h.textContent ?? '').trim().length > 0
      }, { timeout: 15000 })
    } catch { console.log(`${rec.id.slice(0, 8)}  TIMED OUT, nothing measured`); await p.close(); continue }
    const t = await p.evaluate(() => ({
      h1: document.getElementById('ref-display-name')?.textContent ?? '',
      sub: document.getElementById('detail-company')?.textContent ?? '',
      h: Math.round(document.getElementById('ref-display-name')?.getBoundingClientRect().height ?? -1),
    }))
    if (t.h1.trim()) filled++; else empty++
    console.log(`${rec.id.slice(0, 8)}  ${(rec.owner_id === me ? 'MINE ' : 'other').padEnd(6)} ${JSON.stringify(dbName).padEnd(20)} ${JSON.stringify(t.h1).padEnd(20)} ${String(t.h).padEnd(5)} ${JSON.stringify(t.sub)}`)
    await p.close()
  }
} finally { await b.close() }
console.log(`\n${empty} of ${empty + filled} measured records render an EMPTY title; ${filled} render a title.`)
