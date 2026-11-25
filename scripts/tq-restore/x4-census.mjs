#!/usr/bin/env node
// TQ_RESTORE ruling X4 (John, 2026-11-25): READ-ONLY. No repair.
//
//   node --env-file=.env scripts/tq-restore/x4-census.mjs
//
// THE RULED QUERY: deal_sheet_versions on LIVE opportunities, created after
// the swap (2026-09-06 02:16:36 UTC, 9b61eee), whose inputs' Commercials keys
// (COMMERCIALS_FORM_KEYS) EQUAL another record's revision payload taken
// earlier the same UTC day, excluding defaults and empty forms (defined as in
// X2: empty = every key absent, null or ""; default = the commonest revision 1
// signature across every opportunity). A term_quote version's inputs are a
// quote, so its Commercials keys are empty and it is excluded as an empty form.
//
// Why it is worth asking: X1's second failure mode sent the version path's
// save to the FIRST record opened, and a version freezes whatever the screen
// held. Coverage asserted against exact counts. Detail with ids to .verify.
import { admin } from '../fixtures.mjs'
import { COMMERCIALS_FORM_KEYS } from '../../src/lib/pricing-keys.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const SWAP = '2026-09-06T02:16:36+00:00'
const db = admin()
const must = ({ data, error, count }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return count ?? data }
const OUT = '.verify/tq-restore'
mkdirSync(OUT, { recursive: true })
const pageAll = async (q, what) => { const out = []; for (let f = 0; ; f += 1000) { const p = must(await q().range(f, f + 999), what); out.push(...p); if (p.length < 1000) return out } }

const opps = await pageAll(() => db.from('records').select('id, deleted_at').eq('record_type', 'opportunity').order('id'), 'opportunities')
const oppTotal = must(await db.from('records').select('id', { count: 'exact', head: true }).eq('record_type', 'opportunity'), 'opp count')
if (opps.length !== oppTotal) throw new Error(`walked ${opps.length} of ${oppTotal} opportunities`)
const live = new Set(opps.filter((o) => !o.deleted_at).map((o) => o.id))
const liveIds = [...live]

const versions = []
for (let i = 0; i < liveIds.length; i += 100) {
  const chunk = liveIds.slice(i, i + 100)
  const total = must(await db.from('deal_sheet_versions').select('id', { count: 'exact', head: true }).in('record_id', chunk).gt('created_at', SWAP), 'version count')
  const got = await pageAll(() => db.from('deal_sheet_versions').select('id, record_id, kind, major, minor, inputs, created_by, created_at').in('record_id', chunk).gt('created_at', SWAP).order('id'), 'versions')
  if (got.length !== total) throw new Error(`walked ${got.length} of ${total} versions`)
  versions.push(...got)
}
const days = [...new Set(versions.map((v) => v.created_at.slice(0, 10)))]

const empty = (v) => v === undefined || v === null || v === ''
const sigOf = (p) => JSON.stringify(COMMERCIALS_FORM_KEYS.map((k) => (empty(p?.[k]) ? null : p[k])))
const isEmpty = (p) => COMMERCIALS_FORM_KEYS.every((k) => empty(p?.[k]))

// The default signature, as X2 read it: the commonest revision 1, every opportunity.
const ones = await pageAll(() => db.from('record_revisions').select('payload').eq('revision_number', 1).order('id'), 'revision 1s')
const counts = new Map(); for (const r of ones) { const s = sigOf(r.payload); counts.set(s, (counts.get(s) ?? 0) + 1) }
const [defaultSig] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]

// Other records' revisions on the same UTC days, any opportunity, live or not.
const revs = []
for (const d of days) {
  const from = `${d}T00:00:00+00:00`, to = `${d}T23:59:59.999999+00:00`
  const total = must(await db.from('record_revisions').select('id', { count: 'exact', head: true }).gte('created_at', from).lte('created_at', to), 'day count')
  const got = await pageAll(() => db.from('record_revisions').select('record_id, revision_number, payload, created_at').gte('created_at', from).lte('created_at', to).order('id'), 'day revisions')
  if (got.length !== total) throw new Error(`walked ${got.length} of ${total} revisions on ${d}`)
  revs.push(...got.map((r) => ({ ...r, sig: sigOf(r.payload), empty: isEmpty(r.payload) })))
}
const oppSet = new Set(opps.map((o) => o.id))

const subjects = versions.filter((v) => !isEmpty(v.inputs) && sigOf(v.inputs) !== defaultSig)
const candidates = []
for (const v of subjects) {
  const s = sigOf(v.inputs)
  const src = revs.find((r) => oppSet.has(r.record_id) && r.record_id !== v.record_id && r.created_at.slice(0, 10) === v.created_at.slice(0, 10)
    && r.created_at < v.created_at && !r.empty && r.sig !== defaultSig && r.sig === s)
  if (src) candidates.push({ version: v.id, record: v.record_id, label: `V${v.major}.${v.minor}`, kind: v.kind, author: v.created_by, at: v.created_at,
    matches: { record: src.record_id, revision: src.revision_number, at: src.created_at, live: live.has(src.record_id) } })
}
// POSITIVE CONTROL (Verification 13): the same matcher, pointed at each
// version's OWN record. Save-then-version means a version's inputs equal its
// record's revision taken just before it, so this must read non-zero, or the
// zero above is an instrument that cannot match.
const ownMatches = subjects.filter((v) => revs.some((r) => r.record_id === v.record_id && r.created_at <= v.created_at && r.sig === sigOf(v.inputs))).length
const result = {
  population: { liveOpportunities: live.size, versionsAfterSwap: versions.length, byKind: versions.reduce((m, v) => ({ ...m, [v.kind ?? 'commercials']: (m[v.kind ?? 'commercials'] ?? 0) + 1 }), {}),
    emptyExcluded: versions.filter((v) => isEmpty(v.inputs)).length, defaultExcluded: versions.filter((v) => !isEmpty(v.inputs) && sigOf(v.inputs) === defaultSig).length,
    subjects: subjects.length, positiveControlOwnRecordMatches: ownMatches, days: days.length, revisionsOnThoseDays: revs.length },
  candidates,
}
writeFileSync(`${OUT}/x4-census.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result.population))
console.log(`candidates (the ruled query): ${candidates.length}`)
for (const c of candidates) console.log(`  ${c.label} ${c.kind} at ${c.at} equals rev ${c.matches.revision} of another ${c.matches.live ? 'live' : 'deleted'} record at ${c.matches.at}`)
console.log(`detail (ids, authors): ${OUT}/x4-census.json`)
