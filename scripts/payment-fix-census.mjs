// ── R-PT3 PHASE 0: WHO IS SAVED AS CAPEX SINGLE PHASE, AND IS ANY ISSUED ─
//
// The ruling removes Single phase from CAPEX. Those deals load as OPEX, same
// economics, with the mapping recorded. The brief carries a STOP: if the count
// includes ISSUED VERSIONS, nothing is touched until John has seen it.
//
// An issued version is frozen evidence somebody approved a price. Migrating the
// structure key under one is not a display change; it is editing the record of
// a decision.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const users = (await db.auth.admin.listUsers()).data.users
const email = Object.fromEntries(users.map((u) => [u.id, u.email]))
const BUSINESS = new Set(['john@terminustechnologies.io', 'johnf.jnr@gmail.com'])
const WALK = new Set(['terminus.walk65@gmail.com'])
const kind = (e) => (BUSINESS.has(e) ? 'business' : WALK.has(e) ? 'walk' : 'harness/probe')

const recs = must(await db.from('records')
  .select('id, reference_code, owner_id, status')
  .eq('record_type', 'opportunity').is('deleted_at', null), 'records')
console.log(`${recs.length} live opportunities\n`)

const hits = []
for (const r of recs) {
  const rev = must(await db.from('record_revisions').select('payload, revision_number')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  const p = rev?.payload ?? {}
  const mode = String(p.paymentMode ?? 'capex')
  const structure = String(p.structure ?? '')
  // CAPEX SINGLE PHASE is the set the ruling moves. `paymentMode` defaults to
  // capex, so a record written before OPEX existed is capex by construction.
  if (mode === 'capex' && structure === 'single') {
    const versions = must(await db.from('deal_sheet_versions')
      .select('major, minor, status, reason, created_by_email')
      .eq('record_id', r.id), 'versions')
    hits.push({ ref: r.reference_code, stage: r.status, owner: email[r.owner_id],
      rev: rev.revision_number, versions })
  }
}

console.log(`── LIVE DEALS SAVED AS CAPEX SINGLE PHASE: ${hits.length} ──\n`)
let issuedTotal = 0
for (const h of hits) {
  const issued = h.versions.filter((v) => v.status === 'issued')
  issuedTotal += issued.length
  console.log(`  ${h.ref}  ${h.stage}  owner ${h.owner} (${kind(h.owner)})  rev ${h.rev}`)
  console.log(`      versions: ${h.versions.length ? h.versions.map((v) => `V${v.major}.${v.minor}/${v.status}`).join(' ') : 'none'}`)
}
console.log(`\n  ISSUED versions across that set: ${issuedTotal}`)
console.log(issuedTotal > 0
  ? '\n  *** STOP CONDITION MET: the set includes issued versions. ***'
  : '\n  No issued version sits on a CAPEX single-phase deal.')

// AND THE WHOLE POPULATION, so the number above can be read against something.
const byStructure = {}
for (const r of recs) {
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', r.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  const p = rev?.payload ?? {}
  const k = `${String(p.paymentMode ?? 'capex')} / ${String(p.structure ?? '(none)')}`
  byStructure[k] = (byStructure[k] ?? 0) + 1
}
console.log('\n── every live opportunity by mode and structure ──')
for (const [k, n] of Object.entries(byStructure).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${k}`)
}
