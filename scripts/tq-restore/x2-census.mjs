#!/usr/bin/env node
// TQ_RESTORE ruling X2 (John, 2026-11-25): a READ-ONLY census for damage by
// the Commercials cross-record defect, taken before the fix lands. No repair.
//
//   node --env-file=.env scripts/tq-restore/x2-census.mjs
//
// THE RULED QUERY: for the live opportunities, any revision whose Commercials
// keys (COMMERCIALS_FORM_KEYS, the shared list) EQUAL another record's
// revision taken earlier the same day (UTC), excluding defaults and empty
// forms.
//   - "empty form": every Commercials key absent, null or "".
//   - "defaults": the signature equals the one a NEW opportunity is created
//     with. That is read from the data, not typed: the commonest signature of
//     revision 1 across every opportunity ever, live or not.
//   - The other record's revision may be on any opportunity, live or
//     soft-deleted, since a viewed fixture is as able to leak as a real one.
//
// A SECOND, LOOSER READING beside it, labelled as such: the defect writes the
// other record's values for every key the person did NOT edit, so a damaged
// revision differs from its source by the edited keys. "Near" = all but one
// or two Commercials keys equal, and the revision CHANGED Commercials keys
// against the record's own previous revision.
//
// Coverage is asserted (Verification 17): the rows walked equal the exact
// count. Output to a .verify file holds record ids and authors; the report
// carries counts (CURRENT_STATE rule 4, user data private).
import { admin } from '../fixtures.mjs'
import { COMMERCIALS_FORM_KEYS } from '../../src/lib/pricing-keys.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const db = admin()
const must = ({ data, error, count }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return count ?? data }
const OUT = '.verify/tq-restore'
mkdirSync(OUT, { recursive: true })

const opps = []
for (let from = 0; ; from += 1000) {
  const page = must(await db.from('records').select('id, deleted_at').eq('record_type', 'opportunity').order('id').range(from, from + 999), 'opportunities')
  opps.push(...page); if (page.length < 1000) break
}
const oppTotal = must(await db.from('records').select('id', { count: 'exact', head: true }).eq('record_type', 'opportunity'), 'opp count')
if (opps.length !== oppTotal) throw new Error(`walked ${opps.length} opportunities of ${oppTotal}`)
const live = new Set(opps.filter((o) => !o.deleted_at).map((o) => o.id))
const ids = opps.map((o) => o.id)

const revs = []
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100)
  const total = must(await db.from('record_revisions').select('id', { count: 'exact', head: true }).in('record_id', chunk), 'rev count')
  const got = []
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from('record_revisions').select('id, record_id, revision_number, payload, created_by, created_at')
      .in('record_id', chunk).order('id').range(from, from + 999), 'revisions')
    got.push(...page); if (page.length < 1000) break
  }
  if (got.length !== total) throw new Error(`walked ${got.length} revisions of ${total} in a chunk`)
  revs.push(...got)
}

const empty = (v) => v === undefined || v === null || v === ''
const sigOf = (p) => JSON.stringify(COMMERCIALS_FORM_KEYS.map((k) => (empty(p?.[k]) ? null : p[k])))
const isEmpty = (p) => COMMERCIALS_FORM_KEYS.every((k) => empty(p?.[k]))
for (const r of revs) { r.sig = sigOf(r.payload); r.empty = isEmpty(r.payload); r.day = r.created_at.slice(0, 10) }

const firstSigs = new Map()
for (const r of revs.filter((x) => x.revision_number === 1)) firstSigs.set(r.sig, (firstSigs.get(r.sig) ?? 0) + 1)
const [defaultSig, defaultCount] = [...firstSigs.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

const byRecord = new Map()
for (const r of revs) { if (!byRecord.has(r.record_id)) byRecord.set(r.record_id, []); byRecord.get(r.record_id).push(r) }
for (const list of byRecord.values()) list.sort((a, b) => a.revision_number - b.revision_number)
const prevOf = (r) => { const l = byRecord.get(r.record_id); const i = l.indexOf(r); return i > 0 ? l[i - 1] : null }
const differingKeys = (a, b) => COMMERCIALS_FORM_KEYS.filter((k, i) => JSON.stringify(JSON.parse(a.sig)[i]) !== JSON.stringify(JSON.parse(b.sig)[i]))

const exact = [], near = []
const subjects = revs.filter((r) => live.has(r.record_id) && !r.empty && r.sig !== defaultSig)
for (const r of subjects) {
  const earlier = revs.filter((o) => o.record_id !== r.record_id && o.day === r.day && o.created_at < r.created_at && !o.empty && o.sig !== defaultSig)
  const eq = earlier.find((o) => o.sig === r.sig)
  if (eq) { exact.push({ r, src: eq }); continue }
  const prev = prevOf(r)
  if (!prev || prev.sig === r.sig) continue
  for (const o of earlier) {
    const d = differingKeys(r, o)
    if (d.length >= 1 && d.length <= 2) { near.push({ r, src: o, keys: d }); break }
  }
}

const row = ({ r, src, keys }) => ({ record: r.record_id, revision: r.revision_number, author: r.created_by, at: r.created_at,
  matches: { record: src.record_id, revision: src.revision_number, at: src.created_at, live: live.has(src.record_id) }, ...(keys ? { differingKeys: keys } : {}) })
const result = {
  population: { opportunities: opps.length, live: live.size, revisions: revs.length, liveRevisions: revs.filter((r) => live.has(r.record_id)).length,
    subjects: subjects.length, emptyExcluded: revs.filter((r) => live.has(r.record_id) && r.empty).length,
    defaultExcluded: revs.filter((r) => live.has(r.record_id) && !r.empty && r.sig === defaultSig).length, defaultFromRevision1s: defaultCount },
  exact: exact.map(row), near: near.map(row),
}
writeFileSync(`${OUT}/x2-census.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result.population))
console.log(`exact candidates (the ruled query): ${exact.length}`)
console.log(`near candidates (all but 1 or 2 keys, a Commercials change): ${near.length}`)
for (const c of [...exact, ...near]) console.log(`  rev ${c.r.revision_number} at ${c.r.created_at} matches rev ${c.src.revision_number} of another ${live.has(c.src.record_id) ? 'live' : 'deleted'} record at ${c.src.created_at}${c.keys ? `, differing ${c.keys.join(', ')}` : ''}`)
console.log(`detail (record ids, authors): ${OUT}/x2-census.json`)
