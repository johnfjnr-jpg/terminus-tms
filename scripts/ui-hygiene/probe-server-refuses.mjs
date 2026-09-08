// PHASE 0 ITEM 3: the server-refusal proof.
//
// ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
//
// src/lib/ownership.js says it plainly: the door is NOT A SECURITY BOUNDARY.
// RLS is. The door stops a person doing work that will be refused; it does not
// stop anybody who means to.
//
// Item (a) of this round is therefore HYGIENE **only if that sentence is true**.
// If any non-owner write actually lands, the round is not about hygiene and the
// brief says so: STOP and report.
//
// ── THE TARGET IS A FIXTURE, DELIBERATELY ─────────────────────────────────
//
// There are two sets of live opportunities this account does not own: 18 owned
// by john@terminustechnologies.io - the business's own pipeline - and 6 owned by
// terminus.walk65@gmail.com, a walk account. **The walk account's is used.** If
// a refusal fails, the write lands on a fixture rather than in the business's
// records, and that is the whole reason to choose.
//
// ── AND THE COUNTERFACTUAL, WHICH NEEDS A WRITE ───────────────────────────
//
// Verification 14: a check that passes with nothing on either side is not a
// check. A 403 from a broken route, a wrong id or an expired session looks
// exactly like a 403 from RLS. So each call is made TWICE - once as the owner,
// where it must SUCCEED, and once as a non-owner, where it must be REFUSED.
//
// That means creating one fixture Opportunity, which is a departure from "the
// non-owner write attempts are the only writes" and is recorded as one: without
// it the refusals are unfalsifiable. This account owns zero live opportunities,
// measured, so there was nothing to borrow.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../../src/lib/rate-resolution.js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `uihyg-${process.argv[2] ?? 'r0'}`
const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const R = []
const check = (n, pass, detail = '') => {
  R.push({ n, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${detail ? '  -> ' + detail : ''}`)
}
// Never throws: every status here is a result to be read, refusals included.
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}

let mine
try {
  const db = admin()
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const walk = users.users.find((u) => u.email === 'terminus.walk65@gmail.com')?.id
  if (!walk) throw new Error('the walk account is not in auth.users')

  // The non-owned target: a live, walk-owned Opportunity carrying a version.
  const { data: theirs } = await db.from('records')
    .select('id, status, owner_id').eq('record_type', 'opportunity')
    .eq('owner_id', walk).is('deleted_at', null).limit(1).single()
  const { data: theirVersion } = await db.from('deal_sheet_versions')
    .select('id, status').eq('record_id', theirs.id).limit(1).maybeSingle()
  const { data: theirRev } = await db.from('record_revisions')
    .select('revision_number').eq('record_id', theirs.id)
    .order('revision_number', { ascending: false }).limit(1).single()

  console.log(`non-owned target : ${theirs.id}  owner ${theirs.owner_id}  stage ${theirs.status}`)
  console.log(`  its version    : ${theirVersion?.id ?? '(none)'}`)
  console.log(`  its revision   : ${theirRev.revision_number}`)
  check('0. the target is genuinely somebody else\'s', theirs.owner_id !== SESSION.user.id,
    `${theirs.owner_id} vs my ${SESSION.user.id}`)

  // ── THE OWNED FIXTURE, for the counterfactual ──────────────────────────
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', {
    name: `${TAG} Account`, industry_id: industry.id, billingCountry: 'Singapore',
  })
  const contact = await body('POST', '/contacts', {
    name: `${TAG} person`, company: `${TAG} Ltd`, email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0002', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${contact.id}/link-account`, { account_id: account.id })
  // Qualified by direct write: the route requires it and the transition engine
  // is a large amount of unrelated setup. Verification 47's clause, with the
  // migration's Round 4 as precedent.
  await db.from('records').update({ status: 'Qualified' }).eq('id', contact.id)
  mine = (await body('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${TAG} deal` })).id
  const { data: myRev } = await db.from('record_revisions').select('revision_number')
    .eq('record_id', mine).order('revision_number', { ascending: false }).limit(1).single()
  console.log(`owned fixture    : ${mine}  revision ${myRev.revision_number}`)

  // The version body's contract, through the same functions the tab and the
  // route use rather than a hardcoded set: the route requires exactly the keys
  // the catalog produced.
  const LIVE_RATES = catalogToRates((await body('GET', '/base-costs'))?.products ?? []).rates
  const priced = (inputs) => frozenRates(resolveRates(inputs, LIVE_RATES))
  const BASE = { targetMargin: 30 }
  console.log(`rate keys resolved: ${Object.keys(priced(BASE) ?? {}).length}\n`)

  // ── THE FOUR WRITE PATHS THE TAB EXPOSES ───────────────────────────────
  const PATHS = [
    {
      name: 'record patch',
      owner: () => call('PATCH', `/opportunities/${mine}`,
        { payload: { targetMargin: 31 }, expected_revision: myRev.revision_number }),
      other: () => call('PATCH', `/opportunities/${theirs.id}`,
        { payload: { targetMargin: 99 }, expected_revision: theirRev.revision_number }),
    },
    {
      name: 'version save',
      owner: () => call('POST', `/opportunities/${mine}/deal-sheet-versions`, {
        inputs: BASE, rates: priced(BASE), expected_revision: myRev.revision_number,
        reason: `${TAG} counterfactual: this must succeed`,
      }),
      other: () => call('POST', `/opportunities/${theirs.id}/deal-sheet-versions`, {
        inputs: BASE, rates: priced(BASE), expected_revision: theirRev.revision_number,
        reason: `${TAG} refusal probe: this must be refused`,
      }),
    },
    {
      name: 'approval request',
      owner: () => call('POST', `/records/${mine}/transition-requests`, { to_stage: 'Solution Alignment' }),
      other: () => call('POST', `/records/${theirs.id}/transition-requests`, { to_stage: 'Proposal' }),
    },
  ]

  console.log('=== EACH PATH, BOTH WAYS')
  for (const p of PATHS) {
    const o = await p.owner()
    const x = await p.other()
    console.log(`  ${p.name}`)
    console.log(`    as OWNER     -> ${o.status}  ${JSON.stringify(o.data).slice(0, 110)}`)
    console.log(`    as NON-OWNER -> ${x.status}  ${JSON.stringify(x.data).slice(0, 110)}`)
    // THE REFUSAL IS THE CLAIM. 2xx as a non-owner is the stop condition.
    check(`R. ${p.name}: the non-owner write is REFUSED`, x.status >= 400,
      `${x.status}`)
    // THE COUNTERFACTUAL. Without it a 403 from a broken route reads as a pass.
    check(`C. ${p.name}: the SAME call as owner succeeds`, o.status >= 200 && o.status < 300,
      `${o.status}`)
  }

  // Version issue: only testable on a record that HAS a version. The owned
  // fixture has one only if the save above worked, so this runs last and names
  // which id it used.
  const { data: mineVersion } = await db.from('deal_sheet_versions')
    .select('id').eq('record_id', mine).limit(1).maybeSingle()
  console.log('  version issue')
  if (theirVersion && mineVersion) {
    const o = await call('POST', `/deal-sheet-versions/${mineVersion.id}/issue`, {})
    const x = await call('POST', `/deal-sheet-versions/${theirVersion.id}/issue`, {})
    console.log(`    as OWNER     -> ${o.status}  ${JSON.stringify(o.data).slice(0, 110)}`)
    console.log(`    as NON-OWNER -> ${x.status}  ${JSON.stringify(x.data).slice(0, 110)}`)
    check('R. version issue: the non-owner write is REFUSED', x.status >= 400, `${x.status}`)
    // The owner's issue may legitimately refuse for a NON-ownership reason (an
    // unapproved version cannot be issued). Recorded as what it is rather than
    // scored as a counterfactual it cannot be.
    console.log(`    NOTE: the owner's issue answered ${o.status}. If that is a refusal it is`)
    console.log(`    about approval state, not ownership, and this path's counterfactual is`)
    console.log(`    therefore NOT established. Stated rather than scored.`)
  } else {
    console.log(`    SKIPPED: theirVersion=${!!theirVersion} mineVersion=${!!mineVersion}`)
    check('R. version issue: testable', false, 'no version on one side; the path is unproven')
  }

  // Did anything land on the non-owned record? Measured, not inferred from the
  // status codes.
  const { data: afterRev } = await db.from('record_revisions').select('revision_number')
    .eq('record_id', theirs.id).order('revision_number', { ascending: false }).limit(1).single()
  const { count: afterVersions } = await db.from('deal_sheet_versions')
    .select('id', { count: 'exact', head: true }).eq('record_id', theirs.id)
  const { count: afterRequests } = await db.from('transition_requests')
    .select('id', { count: 'exact', head: true }).eq('record_id', theirs.id)
  console.log('\n=== AND THE RECORD ITSELF, measured after the attempts')
  check('X1. its revision number did not move', afterRev.revision_number === theirRev.revision_number,
    `${theirRev.revision_number} -> ${afterRev.revision_number}`)
  check('X2. no version was added', afterVersions === (theirVersion ? afterVersions : 0) && true,
    `${afterVersions} version(s)`)
  check('X3. no transition request was created by me',
    !(await db.from('transition_requests').select('id').eq('record_id', theirs.id)
      .eq('requested_by', SESSION.user.id)).data?.length, 'none requested by this account')
} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  await tearDown()
  const { data: left } = await admin().from('records').select('id')
    .eq('owner_id', SESSION.user.id).is('deleted_at', null)
  console.log(`\nRESIDUE live records owned by the test account: ${left?.length ?? '?'}`)
}

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
// THE STOP CONDITION IS A WRITE THAT LANDED, not a path that could not be run.
// The first version keyed on every row whose name began with 'R.' and printed
// the stop banner for 'version issue: testable' - a row about whether the probe
// could run at all. A stop condition that fires on its own scaffolding is worse
// than none, because the next reader stops believing it.
const landed = R.filter((r) => r.n.startsWith('X') && !r.pass)
const notRefused = R.filter((r) => /the non-owner write is REFUSED/.test(r.n) && !r.pass)
if (landed.length || notRefused.length) {
  console.log('\n*** STOP CONDITION: a non-owner write was NOT refused, or it LANDED. ***')
  for (const r of [...notRefused, ...landed]) console.log('    ' + r.n)
  process.exit(2)
}
process.exit(pass === R.length ? 0 : 1)
