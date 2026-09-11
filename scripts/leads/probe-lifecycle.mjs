// P1 items 2, 3 and 4: the lead lifecycle, PROVEN over HTTP as real users.
//
// WHY THE CASES ARE SHAPED THE WAY THEY ARE. The instruction is explicit that
// this probe derives its cases from the RULED MODEL, not from the rule rows,
// and Verification 47 is the reason: a fixture shaped to the implementation
// tests the implementation. Reading the 14 payload_field_required rows and
// asserting them back would pass against ANY set of rows, including a wrong
// one.
//
// So the groups below are the model's own, taken from the SCREEN's cards -
// "Contact Details", "Address", "Summary" - which is the model as a person
// meets it. If the server enforces something the model does not name, this
// probe reports it as a FINDING rather than adopting it.
//
// THE STAGE NAME IS READ, NOT TYPED. R1 relabels Parked to Nurture in a
// migration this session cannot apply, so a hardcoded name would be wrong
// either before or after. Read from stage_definitions, it is right on both
// sides of the apply and needs no Phase 1b rewrite.
import { readFileSync } from 'node:fs'
import { admin, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const API = process.env.TMS_API ?? 'http://localhost:3000/api'
const TAG = 'leadlc'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OTHER = JSON.parse(readFileSync(`${ROOT}/session-ref-approver.json`, 'utf8'))
for (const [who, s] of [['owner', OWNER], ['non-owner', OTHER]]) {
  if (!s.access_token) throw new Error(`${who}: no access token`)
  if (new Date((s.expires_at ?? 0) * 1000) <= new Date()) throw new Error(`${who}: session expired`)
}

async function call(method, path, body, token = OWNER.access_token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null
  try { data = await r.json() } catch { /* some routes answer empty */ }
  return { ok: r.ok, status: r.status, data }
}

// ── THE MODEL'S OWN GROUPS, from the screen's cards ───────────────────────
const GROUPS = {
  'Contact Details': { company: 'Fixture Holdings', jobRole: 'Head of Infrastructure',
    email: 'leadlc@example.invalid', mobile: '+65 9000 0002',
    linkedin: 'https://example.invalid/in/leadlc', source: 'Direct Outreach' },
  Address: { address: '1 Fixture Street', address2: 'Level 2', city: 'Singapore',
    postcode: '018956', country: 'Singapore', region: 'Asia Pacific' },
  Summary: { summary: 'A lead created to prove the Qualify gate.' },
}

// The field cleared to make each group incomplete. Chosen from the group's own
// membership above, so it is still the model's grouping doing the work.
const REPRESENTATIVE = { 'Contact Details': 'company', Address: 'city', Summary: 'summary' }

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

// ── The stage names, READ from the configuration ──────────────────────────
const stages = must(await db.from('stage_definitions')
  .select('stage_name, sort_order').eq('record_type', 'contact').order('sort_order'), 'stages')
const names = stages.map((s) => s.stage_name)
const QUALIFIED = names.find((n) => n === 'Qualified')
const HOLD = names.find((n) => n === 'Nurture') ?? names.find((n) => n === 'Parked')
console.log(`  contact stages, read from stage_definitions: ${names.join(' -> ')}`)
console.log(`  the hold stage is currently named: ${HOLD}` +
  `${HOLD === 'Parked' ? '   (R1 relabel not yet applied)' : '   (R1 relabel applied)'}\n`)
if (!QUALIFIED || !HOLD) throw new Error('the expected stages are not configured')

const industry = (await call('GET', '/industries')).data[0]
const accounts = (await call('GET', '/accounts')).data

/**
 * A lead carrying exactly the groups named.
 *
 * CREATED COMPLETE, THEN CLEARED - and the reason is a finding rather than a
 * convenience. `POST /contacts` has its OWN mandatory minimum and refuses a
 * lead with no company, email, mobile or source:
 *
 *     400 {"error":"missing required fields",
 *          "missing":["company","email","mobile","source"]}
 *
 * so the incomplete state cannot be reached at creation at all. It IS reachable
 * by a person, who clears a field on the screen after the fact, and that is the
 * path built here. Verification 47: build the fixture the way the SYSTEM
 * produces the state, and where it cannot, say so at the site.
 */
async function makeLead(label, include) {
  const body = { name: `${TAG}-${label} Lead`, industry_id: industry.id }
  for (const g of Object.keys(GROUPS)) Object.assign(body, GROUPS[g])
  const r = await call('POST', '/contacts', body)
  if (!r.ok) throw new Error(`create ${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)

  // ONE REPRESENTATIVE FIELD PER GROUP, not the whole group, and for two
  // reasons. It is the sharper test - the gate must fire on a SINGLE missing
  // field, not only on an empty group. And `mobile` cannot be cleared at all:
  // PATCH /contacts validates it server-side on both write paths, so clearing
  // the whole Contact Details group is refused by the VALIDATOR before the
  // gate is ever reached, which would be a refusal for the wrong reason.
  const drop = Object.keys(GROUPS).filter((g) => !include.includes(g))
  if (drop.length) {
    const cleared = {}
    for (const g of drop) cleared[REPRESENTATIVE[g]] = ''
    const c = await call('PATCH', `/contacts/${r.data.id}`, { payload: cleared })
    if (!c.ok) throw new Error(`clear ${drop.join('+')} on ${label}: ${c.status} ` +
      `${JSON.stringify(c.data).slice(0, 140)}`)
  }
  // No rememberTag: teardown is called with an EXPLICIT tag below, which is the
  // caller stating the set outright rather than relying on a ledger.
  return r.data
}

const refusalNames = (d, field) => JSON.stringify(d ?? {}).toLowerCase().includes(field.toLowerCase())

try {
  // ═══ ITEM 2: Qualify is refused unless all three groups are complete ═════
  const all = Object.keys(GROUPS)
  for (const missing of all) {
    const include = all.filter((g) => g !== missing)
    const lead = await makeLead(missing.replace(/\s+/g, ''), include)
    await call('POST', `/contacts/${lead.id}/link-account`, { account_id: accounts[0].id })
    const t = await call('POST', `/records/${lead.id}/transition`, { to_stage: QUALIFIED })
    const blocked = !t.ok
    // THE REFUSAL MUST BE ABOUT COMPLETENESS, not any 4xx. A body-shape or
    // ownership refusal would satisfy a naive check and prove nothing.
    const aboutThisGroup = refusalNames(t.data, REPRESENTATIVE[missing])
    record(`${missing} incomplete -> ${QUALIFIED} is REFUSED, naming a field of that group`,
      blocked && aboutThisGroup,
      `status ${t.status}  ${JSON.stringify(t.data).slice(0, 150)}`)
  }

  // The positive half. An assertion that something is refused is worth nothing
  // until the same path is shown LANDING (Verification 14's clause).
  const complete = await makeLead('complete', all)
  await call('POST', `/contacts/${complete.id}/link-account`, { account_id: accounts[0].id })
  const good = await call('POST', `/records/${complete.id}/transition`, { to_stage: QUALIFIED })
  const after = must(await db.from('records').select('status').eq('id', complete.id), 'after')[0]
  record(`all three groups complete -> ${QUALIFIED} LANDS`,
    good.ok && after.status === QUALIFIED,
    `status ${good.status}, record now ${after.status}`)

  // ═══ THE IDENTITY COUNTERFACTUAL: a real non-owner JWT, never the service role
  const otherLead = await makeLead('identity', all)
  await call('POST', `/contacts/${otherLead.id}/link-account`, { account_id: accounts[0].id })
  const nonOwner = await call('POST', `/records/${otherLead.id}/transition`,
    { to_stage: QUALIFIED }, OTHER.access_token)
  const still = must(await db.from('records').select('status').eq('id', otherLead.id), 'still')[0]
  const ownershipShaped = nonOwner.status === 403 || /own|permission|forbidden/i.test(JSON.stringify(nonOwner.data ?? {}))
  record('a COMPLETE lead is refused to a non-owner, ownership-shaped, and does not move',
    !nonOwner.ok && ownershipShaped && still.status !== QUALIFIED,
    `status ${nonOwner.status}  ${JSON.stringify(nonOwner.data).slice(0, 130)}  record still ${still.status}`)

  // ═══ ITEM 3 (R2): the hold stage is gated by followUpDate ════════════════
  const hold = await makeLead('hold', all)
  const noDate = await call('POST', `/records/${hold.id}/transition`, { to_stage: HOLD })
  record(`no followUpDate -> ${HOLD} is REFUSED, naming followUpDate`,
    !noDate.ok && refusalNames(noDate.data, 'followUpDate'),
    `status ${noDate.status}  ${JSON.stringify(noDate.data).slice(0, 150)}`)

  // ═══ ITEM 4: the reason is written as a NOTE, newest first ═══════════════
  const REASON = 'Budget deferred to next fiscal year.'
  const beforeRev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', hold.id).order('revision_number', { ascending: false }).limit(1), 'beforeRev')[0]
  const notesBefore = (beforeRev.payload?.notes ?? []).length
  const patched = await call('PATCH', `/contacts/${hold.id}`, {
    payload: {
      followUpDate: '2026-12-01',
      notes: [{ text: `Contact parked. Follow up on 2026-12-01. ${REASON}`,
        at: new Date().toISOString(), by: OWNER.user?.email ?? 'probe' },
        ...(beforeRev.payload?.notes ?? [])],
    },
  })
  const withDate = await call('POST', `/records/${hold.id}/transition`, { to_stage: HOLD })
  const holdRec = must(await db.from('records').select('status').eq('id', hold.id), 'holdRec')[0]
  record(`followUpDate present -> ${HOLD} LANDS`,
    patched.ok && withDate.ok && holdRec.status === HOLD,
    `patch ${patched.status}, transition ${withDate.status}, record now ${holdRec.status}`)

  const afterRev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', hold.id).order('revision_number', { ascending: false }).limit(1), 'afterRev')[0]
  const notes = afterRev.payload?.notes ?? []
  const newestFirst = notes.length > 1
    ? notes.every((n, i) => i === 0 || String(notes[i - 1].at) >= String(n.at))
    : true
  record('the hold REASON is recorded as a NOTE, newest first, not as a field',
    notes.length === notesBefore + 1 && String(notes[0]?.text ?? '').includes(REASON)
      && newestFirst && afterRev.payload?.nurtureReason === undefined,
    `${notesBefore} -> ${notes.length} notes; newest: ${JSON.stringify(notes[0]?.text ?? '').slice(0, 90)}`)

} finally {
  const swept = await tearDown(TAG)
  console.log(`\n  teardown: ${swept.removed.length} records swept, ${swept.remaining} remaining`)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - failed.length}/${results.length} proven`)
process.exit(failed.length ? 1 : 0)
