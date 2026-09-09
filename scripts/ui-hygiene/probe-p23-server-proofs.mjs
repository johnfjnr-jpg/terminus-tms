// P2.3: THE FOUR DELTA ROUTES AND THE THREE PRE-OWNERSHIP-BLOCKED ONES.
//
// ── THE CLAIM IS NOT THE SAME FOR EVERY ROUTE ─────────────────────────────
//
// OWNER-SCOPED: restore, issue, version create, transition, transition-request.
//   The owner's write LANDS; a non-owner's identical write is REJECTED.
//
// ROLE-SCOPED, and proving "non-owner rejected" here would report a WORKING
// control as a gap:
//   /transition-requests/:id/approvals  the assigned APPROVER's decision lands;
//                                       a non-approver is rejected - INCLUDING
//                                       the record's own owner, who is the
//                                       requester and must never approve their
//                                       own request.
//   /transition-requests/:id/withdraw   the REQUESTER's withdraw lands; a
//                                       non-requester is rejected.
//
// ── TWO REAL IDENTITIES, NEITHER THE SERVICE ROLE ─────────────────────────
//
// Every attempt is a real signed-in user over HTTP. The service key creates
// fixtures and hands ownership over - a state one account cannot reach - and
// seats an approver, which is configuration rather than an attempt.
//
// TOKENS ARE NEVER PRINTED.
//
// ── THE STOP CLAUSE IS LIVE ───────────────────────────────────────────────
//
// If any write LANDS where it must be refused, this stops immediately, prints
// the record ids, and waits. That is a live security finding.
import { api as apiCall } from '../api-client.mjs'
import { admin, freshOpportunity, tearDown } from '../fixtures.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { readFileSync, existsSync } from 'fs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = process.env.P23_TAG ?? 'p23proof'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const APPROVER_FILE = `${ROOT}/session-ref-approver.json`
const approverSession = existsSync(APPROVER_FILE)
  ? JSON.parse(readFileSync(APPROVER_FILE, 'utf8')) : null
const APPROVER_ID = approverSession?.user?.id ?? null
const PRIMARY_ID = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8')).user.id

// Identity is swapped per call: api-client reads TMS_ACCESS_TOKEN at CALL time
// and it takes precedence over the session file.
async function as(who, m, p, b) {
  const prev = process.env.TMS_ACCESS_TOKEN
  if (who === 'approver') {
    if (!approverSession) throw new Error('no approver session')
    process.env.TMS_ACCESS_TOKEN = approverSession.access_token
  } else delete process.env.TMS_ACCESS_TOKEN
  try {
    const r = await apiCall(m, p, b)
    return { status: r.status, data: r.data }
  } catch (e) {
    if (e.name !== 'ApiError') throw e
    return { status: e.status, data: e.body }
  } finally {
    if (prev === undefined) delete process.env.TMS_ACCESS_TOKEN
    else process.env.TMS_ACCESS_TOKEN = prev
  }
}
// ── A 2xx IS NOT A WRITE ─────────────────────────────────────────────────
//
// THE FIRST RUN OF THIS PROBE RAISED THE STOP CLAUSE AND IT WAS WRONG.
// `POST /deal-sheet-versions/:vid/restore` answered 200 to a non-owner and was
// scored as a landed write. It performs NO WRITE: it selects the version and
// returns its `inputs`, and the overwrite happens client-side through a
// subsequent PATCH, which IS ownership-guarded and was refused 403 in the same
// run. No revision, no audit row and no updated_at change followed it.
//
// A write is proven by an OBSERVABLE STATE CHANGE, never by a status code. So
// each attempt is bracketed by a fingerprint of the record, and `landed` means
// the fingerprint moved.
const accepted = (r) => r.status >= 200 && r.status < 300

async function fingerprint(recordId) {
  const rev = await db.from('record_revisions').select('revision_number')
    .eq('record_id', recordId).order('revision_number', { ascending: false }).limit(1)
  const aud = await db.from('audit_log').select('id', { count: 'exact', head: true }).eq('record_id', recordId)
  const rec = await db.from('records').select('updated_at, status').eq('id', recordId).maybeSingle()
  const ver = await db.from('deal_sheet_versions').select('id', { count: 'exact', head: true }).eq('record_id', recordId)
  return JSON.stringify({ rev: rev.data?.[0]?.revision_number ?? null, aud: aud.count ?? null,
    upd: rec.data?.updated_at ?? null, st: rec.data?.status ?? null, ver: ver.count ?? null })
}

// An attempt that CHANGED the record. Returns { status, changed }.
async function attempt(who, m, p, b, recordId) {
  const before = await fingerprint(recordId)
  const r = await as(who, m, p, b)
  const after = await fingerprint(recordId)
  return { ...r, changed: before !== after }
}
const landed = (r) => r.changed === true || (r.changed === undefined && accepted(r))

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
if (!OTHER) throw new Error('the probe account does not exist; refusing to guess an owner id')

console.log(`  owner identity    ${users.users.find((u) => u.id === PRIMARY_ID)?.email}`)
console.log(`  approver identity ${approverSession ? users.users.find((u) => u.id === APPROVER_ID)?.email : 'ABSENT - the owner-as-approver clause will be reported UNPROVEN'}`)
console.log(`  handed-to owner   ${users.users.find((u) => u.id === OTHER)?.email}\n`)

// ── THE CONSTRUCTED STATE ─────────────────────────────────────────────────
//
// The three routes that refused pre-ownership need a record that has got
// far enough to ask the question: a priced deal, a version, an ISSUED version,
// and a transition request naming it.
const rates = catalogToRates(must({ data: (await as('owner', 'GET', '/base-costs')).data, error: null }, 'rates').products)

async function buildRecord(tag) {
  const { oppId, contactId } = await freshOpportunity(tag)
  await as('owner', 'PATCH', `/opportunities/${oppId}`, { payload: {
    targetMargin: 30, duration: 24, warrantyPct: 10, safesightCameras: 4,
    bidCurrency: 'USD', proposalCurrency: 'USD',
  } })
  const rec = await as('owner', 'GET', `/opportunities/${oppId}`)
  // `latest_revision_number`, read from the response rather than guessed. The
  // first run used `revision_number ?? latest_revision`, neither of which the
  // detail route sends, so expected_revision was undefined and EVERY downstream
  // proof failed on a null version id.
  const revision = rec.data?.latest_revision_number
  if (!Number.isInteger(revision)) throw new Error(`no latest_revision_number on ${tag}: ${Object.keys(rec.data ?? {}).join(',')}`)
  const v = await as('owner', 'POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs: rec.data?.payload ?? {}, rates, expected_revision: revision, reason: `${tag} constructed state` })
  const vid = v.data?.id ?? v.data?.version?.id ?? null
  const issued = vid ? await as('owner', 'POST', `/deal-sheet-versions/${vid}/issue`, {}) : null
  // ── A STAGE THE VERSION GATE APPLIES TO ─────────────────────────────────
  //
  // The version-scoped tracks exist only from Proposal onward, so at
  // Qualification a request naming a version_id is refused 409 - for the OWNER
  // too, which is how the first runs showed it was the fixture and not a door.
  //
  // One account cannot reach Proposal through the front door:
  // decide_transition_request refuses the requester approving their own
  // request. Built by admin write, per Verification 47's clause - the value is
  // one the system itself produces, and the routes read the STATUS, with no
  // opinion on how it got there.
  must(await db.from('records').update({ status: 'Proposal' }).eq('id', oppId).select('id'), 'advance to Proposal')
  return { oppId, contactId, revision, versionId: vid, versionCreate: v, issue: issued }
}

// Read from stage_gate_rules rather than guessed: which stage can this record
// move to under a rule the VERSION gate applies to.
async function nextGatedStage(recordId) {
  const rec = await db.from('records').select('status').eq('id', recordId).maybeSingle()
  const rules = await db.from('stage_gate_rules').select('from_stage, to_stage, requirement_type, requirement_detail')
    .eq('record_type', 'opportunity').eq('from_stage', rec.data?.status ?? '')
  const versionRule = (rules.data ?? []).find((r) => /version/i.test(JSON.stringify(r.requirement_detail ?? {}))
    || /version/i.test(r.requirement_type ?? ''))
  return versionRule?.to_stage ?? (rules.data ?? [])[0]?.to_stage ?? null
}

const rows = []
const record = (name, shape, positive, negative, note = '') => {
  // A REFUSAL FOR THE WRONG REASON IS NOT A PROOF. `ok` says the correct
  // identity's write landed and the wrong one's did not; `shaped` says the
  // refusal was actually about identity. Both are reported, because a 409 on a
  // stale revision is a refusal that proves nothing about ownership.
  const body = JSON.stringify(negative.data ?? {})
  const shaped = negative.status === 403
    || /belongs to another user|only its owner|not permitted|not authoris|approver|requester/i.test(body)
  const ok = landed(positive) && !landed(negative)
  rows.push({ name, shape, pos: positive.status, neg: negative.status, ok, shaped, note,
    negBody: body.slice(0, 70) })
  console.log(`  ${(ok ? 'BOTH WAYS' : 'FAILED   ')} ${shape.padEnd(12)} ${name.padEnd(34)} ` +
    `correct ${String(positive.status).padEnd(4)} wrong ${String(negative.status).padEnd(4)} ` +
    `${shaped ? 'refused-on-identity' : 'refused-for-another-reason'}  ${note}`)
}

console.log('=== CONSTRUCTED STATE ===\n')
const mine = await buildRecord(`${TAG}-own`)
console.log(`  owner record  version ${mine.versionId ? 'created' : 'FAILED ' + JSON.stringify(mine.versionCreate.data).slice(0, 90)}` +
  `${mine.issue ? `, issue ${mine.issue.status}` : ''}`)
const theirs = await buildRecord(`${TAG}-other`)
must(await db.from('records').update({ owner_id: OTHER }).eq('id', theirs.oppId).select('id'), 'hand over')
console.log(`  handed record ${theirs.oppId.slice(0, 8)} now owned by the probe account\n`)

console.log('=== OWNER-SCOPED: the owner lands, a non-owner is refused ===\n')
// RESTORE IS A READ. Measured: the route selects the version and returns its
// inputs, writing nothing; the overwrite is the client's subsequent PATCH,
// which is ownership-guarded. It is reported as a READ rather than scored as a
// write, because scoring it as one raised a false stop.
const restoreOwn = await attempt('owner', 'POST', `/deal-sheet-versions/${mine.versionId}/restore`, {}, mine.oppId)
const restoreOther = await attempt('owner', 'POST', `/deal-sheet-versions/${theirs.versionId}/restore`, {}, theirs.oppId)
console.log(`  READ ONLY    owner        deal-sheet-versions/:vid/restore   ` +
  `owner ${restoreOwn.status}/changed=${restoreOwn.changed}  non-owner ${restoreOther.status}/changed=${restoreOther.changed}`)
console.log(`               it writes nothing; the overwrite is the client's PATCH, guarded separately`)
record('deal-sheet-versions/:vid/issue', 'owner',
  mine.issue ?? { status: 0 },
  await attempt('owner', 'POST', `/deal-sheet-versions/${theirs.versionId}/issue`, {}, theirs.oppId))
record('opportunities/:id/deal-sheet-versions', 'owner',
  mine.versionCreate,
  await (async () => {
    const cur = await as('owner', 'GET', `/opportunities/${theirs.oppId}`)
    return attempt('owner', 'POST', `/opportunities/${theirs.oppId}/deal-sheet-versions`,
      { inputs: cur.data?.payload ?? {}, rates,
        expected_revision: cur.data?.latest_revision_number, reason: 'p2.3 non-owner attempt' }, theirs.oppId)
  })())

// THE STAGE PAIR MUST BE ONE THE VERSION GATE APPLIES TO. Qualification to
// Solution Alignment is not gated on a pricing version, so naming a version_id
// there is refused 409 - for the owner too, which is how the first run showed
// it was the fixture and not the door.
const gated = await nextGatedStage(mine.oppId)
const myReq = gated
  ? await as('owner', 'POST', `/records/${mine.oppId}/transition-requests`,
      { to_stage: gated, kind: 'review', version_id: mine.versionId })
  : { status: 0, data: { error: 'no version-gated transition available from this stage' } }
record('records/:id/transition-requests', 'owner', myReq,
  gated
    ? await attempt('owner', 'POST', `/records/${theirs.oppId}/transition-requests`,
        { to_stage: gated, kind: 'review', version_id: theirs.versionId }, theirs.oppId)
    : { status: 0, changed: false })

console.log('\n=== ROLE-SCOPED: the correct identity lands, the wrong one is refused ===\n')
const reqId = myReq.data?.id ?? myReq.data?.request?.id ?? null
if (!reqId) {
  console.log(`  NO OPEN REQUEST WAS RAISED (${myReq.status} ${JSON.stringify(myReq.data).slice(0, 100)}),`)
  console.log('  so approvals and withdraw are NOT PROVEN rather than reported clean.')
} else {
  // The approver is SEATED as configuration, scoped to this record only.
  if (APPROVER_ID) {
    must(await db.from('track_approvers').insert({
      record_id: mine.oppId, record_type: 'opportunity', track: 'Commercial', user_id: APPROVER_ID,
    }).select('id'), 'seat approver')
  }
  const approverDecide = APPROVER_ID
    ? await as('approver', 'POST', `/transition-requests/${reqId}/approvals`, { track: 'Commercial', decision: 'approved' })
    : { status: 0 }
  // THE OWNER IS THE REQUESTER, and must never approve their own request.
  const ownerDecide = await as('owner', 'POST', `/transition-requests/${reqId}/approvals`,
    { track: 'Commercial', decision: 'approved' })
  if (APPROVER_ID) {
    record('transition-requests/:id/approvals', 'role', approverDecide, ownerDecide,
      'positive = the seated approver; negative = the record owner, who is the requester')
  } else {
    console.log('  UNPROVEN  approvals: no second identity, so the approver positive control does not exist')
  }

  const wrongWithdraw = APPROVER_ID
    ? await as('approver', 'POST', `/transition-requests/${reqId}/withdraw`, { reason: 'p2.3 non-requester attempt' })
    : { status: 0 }
  const rightWithdraw = await as('owner', 'POST', `/transition-requests/${reqId}/withdraw`, { reason: 'p2.3 requester withdraw' })
  if (APPROVER_ID) {
    record('transition-requests/:id/withdraw', 'role', rightWithdraw, wrongWithdraw,
      'positive = the requester; negative = the approver, who did not raise it')
  } else {
    console.log('  UNPROVEN  withdraw: no second identity for the non-requester attempt')
  }
}

// ── THE STOP CLAUSE ───────────────────────────────────────────────────────
const breaches = rows.filter((r) => landed({ status: r.neg }))
console.log(`\n  ${rows.filter((r) => r.ok).length}/${rows.length} proved BOTH WAYS`)
console.log(`  ${rows.filter((r) => r.ok && r.shaped).length}/${rows.length} of those refused ON IDENTITY rather than for another reason`)
for (const r of rows.filter((r) => !r.ok)) {
  console.log(`    NOT PROVEN  ${r.name}: correct ${r.pos}, wrong ${r.neg}  ${r.negBody}`)
}
if (breaches.length) {
  console.log(`\n  *** STOP. A WRITE LANDED WHERE IT MUST BE REFUSED ***`)
  console.log(`  owner record : ${mine.oppId}`)
  console.log(`  handed record: ${theirs.oppId}`)
  for (const b of breaches) console.log(`      ${b.name} -> ${b.neg}`)
  console.log(`  Fixtures are NOT torn down: they are the evidence. Tags ${TAG}-own, ${TAG}-other.`)
  process.exit(2)
}

if (APPROVER_ID) await db.from('track_approvers').delete().eq('record_id', mine.oppId)
await tearDown(`${TAG}-own`)
await tearDown(`${TAG}-other`)
// HANDED-OVER RECORDS ARE OUTSIDE tearDown's CANDIDATE SET, which is owner
// scoped. This is the P2.5 structural gap; until it is fixed, the probe that
// hands a record away sweeps it back itself rather than leaving residue.
must(await db.from('records').update({ deleted_at: new Date().toISOString() })
  .eq('owner_id', OTHER).is('deleted_at', null).select('id'), 'sweep handed-over')
const leftover = must(await db.from('records').select('id').in('owner_id', [PRIMARY_ID, OTHER]).is('deleted_at', null), 'residue')
console.log(`\n  fixtures swept; live records for both accounts: ${leftover.length}`)
process.exit(rows.every((r) => r.ok) ? 0 : 1)
