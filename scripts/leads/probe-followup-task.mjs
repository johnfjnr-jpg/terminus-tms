// P1 item 5: the follow-up task is a DATE and a DESCRIPTION, on EVERY status,
// INDEPENDENT of the Nurture reason.
//
// Three claims, and the third is the one with teeth. "On every status" and "a
// description exists" are easy to satisfy; "independent of the Nurture reason"
// is what stops the task being quietly folded into the park note again, which
// is the shape it had before this item.
//
// THE STALE-SERVER CLAUSE (CLAUDE.md rule 9). This measures a change to
// src/routes/contacts.js on a server started WITHOUT --watch. The server was
// restarted before this ran. A probe cannot notice that it is measuring
// replaced code - it would PASS, because the old route satisfies almost every
// assertion this one does - so the first case below is chosen to be the one
// assertion the OLD code cannot satisfy: it writes the new key and reads it
// back.
import { readFileSync } from 'node:fs'
import { admin, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const API = process.env.TMS_API ?? 'http://localhost:3000/api'
const TAG = 'leadtask'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

async function call(method, path, body, token = OWNER.access_token) {
  const r = await fetch(`${API}${path}`, {
    method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data = null
  try { data = await r.json() } catch { /* some routes answer empty */ }
  return { ok: r.ok, status: r.status, data }
}
const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}
const latest = async (id) => must(await db.from('record_revisions').select('payload, revision_number')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'latest')[0]

const industry = (await call('GET', '/industries')).data[0]
const accounts = (await call('GET', '/accounts')).data

async function makeLead(label) {
  const r = await call('POST', '/contacts', {
    name: `${TAG}-${label} Lead`, company: 'Task Holdings', jobRole: 'Head of Infrastructure',
    email: `${TAG}@example.invalid`, mobile: '+65 9000 0003', source: 'Direct Outreach',
    linkedin: 'https://example.invalid/in/task', industry_id: industry.id,
    address: '1 Fixture Street', address2: 'Level 2', city: 'Singapore',
    postcode: '018956', country: 'Singapore', region: 'Asia Pacific',
    summary: 'A lead created to prove the follow-up task.',
  })
  if (!r.ok) throw new Error(`create ${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
  return r.data
}

const TASK = { followUpDate: '2026-11-14', followUpDescription: 'Call after the budget review.' }

try {
  // ═══ 1. UNQUALIFIED: the task is writable, and the description SURVIVES ═══
  const a = await makeLead('unqual')
  const beforeA = await latest(a.id)
  const w1 = await call('PATCH', `/contacts/${a.id}`, { payload: TASK })
  const afterA = await latest(a.id)
  record('a follow-up task with a DESCRIPTION is writable on Unqualified, and reads back',
    w1.ok && afterA.payload?.followUpDate === TASK.followUpDate
      && afterA.payload?.followUpDescription === TASK.followUpDescription,
    `status ${w1.status}, date=${JSON.stringify(afterA.payload?.followUpDate)}, ` +
    `description=${JSON.stringify(afterA.payload?.followUpDescription)}`)

  // ═══ 2. INDEPENDENT OF THE NURTURE REASON: it writes NO note ═════════════
  const notesBefore = (beforeA.payload?.notes ?? []).length
  const notesAfter = (afterA.payload?.notes ?? []).length
  record('writing a follow-up task adds NO note: the task is not the Nurture reason',
    notesAfter === notesBefore,
    `notes ${notesBefore} -> ${notesAfter}; the reason is a note, the task is a field, and they are separate`)

  // ═══ 3. QUALIFIED: the same write works on a different status ════════════
  const b = await makeLead('qual')
  await call('POST', `/contacts/${b.id}/link-account`, { account_id: accounts[0].id })
  const t = await call('POST', `/records/${b.id}/transition`, { to_stage: 'Qualified' })
  const w2 = await call('PATCH', `/contacts/${b.id}`, { payload: TASK })
  const afterB = await latest(b.id)
  const statusB = must(await db.from('records').select('status').eq('id', b.id), 'statusB')[0].status
  record('the same follow-up task is writable on Qualified',
    t.ok && w2.ok && statusB === 'Qualified'
      && afterB.payload?.followUpDescription === TASK.followUpDescription,
    `record is ${statusB}, patch ${w2.status}, description=${JSON.stringify(afterB.payload?.followUpDescription)}`)

  // ═══ 4. THE TASK IS CLEARABLE, because a default is an initial value ═════
  // Architecture 11: a cleared field is a state the record must be able to
  // SAY, not merely tolerate. If the description cannot be emptied it is not a
  // field, it is a coercion.
  const w3 = await call('PATCH', `/contacts/${a.id}`, { payload: { followUpDescription: '' } })
  const cleared = await latest(a.id)
  record('the description can be CLEARED and stays cleared',
    w3.ok && cleared.payload?.followUpDescription === '',
    `status ${w3.status}, description=${JSON.stringify(cleared.payload?.followUpDescription)}`)

  // ═══ 5. THE NEGATIVE CONTROL: an unknown key is still refused ════════════
  // The writable-key allowlist must not have been widened by accident. This is
  // the counterfactual for case 1: without it, "the key was accepted" is also
  // satisfied by a route that accepts anything.
  const w4 = await call('PATCH', `/contacts/${a.id}`, { payload: { notAField: 'x' } })
  record('an unknown payload key is still REFUSED, so case 1 is about the allowlist',
    !w4.ok, `status ${w4.status}  ${JSON.stringify(w4.data).slice(0, 120)}`)

} finally {
  const swept = await tearDown(TAG)
  console.log(`\n  teardown: ${swept.removed.length} records swept, ${swept.remaining} remaining`)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - failed.length}/${results.length} proven`)
process.exit(failed.length ? 1 : 0)
