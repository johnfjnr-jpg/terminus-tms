// ── R8 MEASUREMENT: approvers on Test Beds, read-only except its own fixture ──
import { freshTestBed, tearDown, admin, handOver } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { readFileSync } from 'node:fs'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const call = (m, p, b) => api(m, p, b).then((r) => ({ status: r.status, data: r.data })).catch((e) => { if (!e.status) throw e; return { status: e.status, data: e.body } })
const ME = JSON.parse(readFileSync(new URL('../../session-ref.json', import.meta.url), 'utf8')).user.id
const AUTH_KEYS = ['commercialAuthority', 'technicalAuthority', 'terminusLegalOwner']
const TAG = `TBSP-R8-${Date.now()}`

console.log('== 1. where the approver fields live ==')
const staff = must(await db.from('terminus_staff').select('id,name,title'), 'staff')
console.log(`terminus_staff: ${staff.length} rows, columns id,name,title,created_at. NO user_id, so no link to auth.users.`)
console.log(`the record fields are payload keys on the Test Bed: ${AUTH_KEYS.join(', ')} (plus terminusLead), offered as staff NAMES.`)
const ta = must(await db.from('track_approvers').select('record_type,track,record_id,user_id'), 'track_approvers')
console.log(`track_approvers rows: ${ta.length}; for test_bed: ${ta.filter((r) => r.record_type === 'test_bed').length}`)

console.log('\n== 2. what live Test Beds carry (counts only) ==')
const beds = must(await db.from('records').select('id,status,deleted_at').eq('record_type', 'test_bed').is('deleted_at', null), 'beds')
const stages = must(await db.from('stage_definitions').select('stage_name,sort_order').eq('record_type', 'test_bed').order('sort_order'), 'stages')
const order = new Map(stages.map((s) => [s.stage_name, s.sort_order]))
let past = 0, missingAny = 0, missingAll = 0
const perKey = Object.fromEntries(AUTH_KEYS.map((k) => [k, 0]))
for (const b of beds) {
  const rev = must(await db.from('record_revisions').select('payload').eq('record_id', b.id)
    .order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'rev')
  const p = rev?.payload ?? {}
  const beyond = (order.get(b.status) ?? 0) > (order.get('Qualification') ?? 0)
  if (!beyond) continue
  past += 1
  const empty = AUTH_KEYS.filter((k) => !String(p[k] ?? '').trim())
  for (const k of empty) perKey[k] += 1
  if (empty.length) missingAny += 1
  if (empty.length === AUTH_KEYS.length) missingAll += 1
}
console.log(`live Test Beds: ${beds.length}; past Qualification: ${past}`)
console.log(`  with ANY approver field missing or empty: ${missingAny}`)
console.log(`  with ALL THREE missing or empty: ${missingAll}`)
console.log(`  by field: ${AUTH_KEYS.map((k) => `${k}=${perKey[k]}`).join(', ')}`)

console.log('\n== 3. what the grant route checks, measured both directions ==')
let fx
try {
  fx = await freshTestBed(TAG)
  const rev = (await call('GET', `/test-beds/${fx.bedId}`)).data.latest_revision_number
  // Name somebody ELSE as every authority, so "the configured approver" is not me.
  const other = staff.find((s) => s.name !== 'John Fryatt') ?? staff[0]
  await call('PATCH', `/test-beds/${fx.bedId}`, {
    payload: Object.fromEntries(AUTH_KEYS.map((k) => [k, other.name])), expected_revision: rev })
  const stored = must(await db.from('record_revisions').select('payload').eq('record_id', fx.bedId)
    .order('revision_number', { ascending: false }).limit(1).maybeSingle(), 'stored')
  console.log(`  fixture authorities set to "${other.name}" (${other.title}): ${JSON.stringify(AUTH_KEYS.map((k) => stored.payload[k]))}`)
  const asOwner = await call('POST', `/records/${fx.bedId}/approvals`, { track: 'Commercial', decision: 'approved' })
  console.log(`  A. the OWNER (me) grants Commercial -> ${asOwner.status} ${JSON.stringify(asOwner.data?.error ?? asOwner.data?.id ?? asOwner.data)}`)
  // Hand it away, so I am a non-owner and still not the named authority.
  // handOver takes the NEW OWNER's id. The only other real auth.users id this
  // session can name is a track_approvers seat, which is what Round A's fixtures use.
  const otherUser = must(await db.from('track_approvers').select('user_id').limit(1), 'another user')[0].user_id
  await handOver(fx.bedId, otherUser)
  const handed = must(await db.from('records').select('owner_id').eq('id', fx.bedId).single(), 'owner')
  const asStranger = await call('POST', `/records/${fx.bedId}/approvals`, { track: 'Commercial', decision: 'approved' })
  const rows = must(await db.from('approvals').select('track,decision,approver_id,stage').eq('record_id', fx.bedId), 'approvals')
  console.log(`  B. a NON-OWNER who is NOT the named authority grants Commercial -> ${asStranger.status} ${JSON.stringify(asStranger.data?.error ?? 'accepted')}`)
  console.log(`     (record now owned by ${handed.owner_id === ME ? 'me' : 'another user'}; the granter was me)`)
  console.log(`  approvals rows in the DATABASE: ${rows.length} ${JSON.stringify(rows.map((r) => ({ track: r.track, decision: r.decision, byMe: r.approver_id === ME, stage: r.stage })))}`)
  const everyTrack = []
  for (const t of ['Technical', 'Legal']) {
    const r = await call('POST', `/records/${fx.bedId}/approvals`, { track: t, decision: 'approved' })
    everyTrack.push(`${t}:${r.status}`)
  }
  console.log(`  C. the same user grants the OTHER tracks -> ${everyTrack.join(', ')}`)
  const all = must(await db.from('approvals').select('track,approver_id').eq('record_id', fx.bedId), 'all approvals')
  console.log(`     approvals now: ${all.length}, all by the same person: ${all.every((r) => r.approver_id === all[0].approver_id)}`)
} finally {
  if (fx) { const t = await tearDown(TAG); console.log(`\nteardown: removed ${t.removed.length}, remaining ${t.remaining}`) }
}
