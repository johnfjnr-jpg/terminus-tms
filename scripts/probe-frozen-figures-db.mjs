#!/usr/bin/env node
// ── FROZEN_FIGURES R-FF5, R-FF1 AND R-FF4's DATABASE HALF, MEASURED LIVE ────
//
//   node --env-file=.env scripts/probe-frozen-figures-db.mjs [tag]
//
// NEEDS migration 20261117000002 APPLIED. Refuses to run without the column.
//
// R-FF5 (John, 2026-11-17): "prove an INSERT cannot create a row already
// 'issued' or carrying frozen_figures, as owner and as service role. Two
// database tests per path, fingerprinted before and after." Each refused path
// below runs once as the OWNER (the test account's own session, against
// PostgREST, so RLS and the triggers both apply) and once as the SERVICE ROLE
// (which bypasses RLS and must still be refused by the trigger). A refusal
// counts only when the error is the TRIGGER's or the constraint's (asserted by
// message, Verification 14: a refusal for the wrong reason proves nothing) AND
// the fingerprint did not move (Verification 40: a status is not a write).
//
// THE OWNER IS THE TEST ACCOUNT, NOT A MINTED USER. No probe user is created
// and no session is minted for any other account: the session in
// session-ref.json is the one every probe here already uses.
//
// Then the halves that must SUCCEED (a gate made of refusals is satisfied by a
// trigger that refuses everything):
//   R-FF1: a draft issued THROUGH THE ROUTE carries frozen_figures, written by
//          the server, naming its builder and engine; the approval page then
//          reads 'frozen', and today's engine agrees with every stored figure
//          at that moment (frozen.today is empty).
//   R-FF4: a raise into Closed Won, as the owner, DERIVES the won version and
//          ignores the version id supplied; the headline then reads the won
//          version's stored figure.
//
// Fixtures: the record through freshOpportunity, versions through the routes.
// ONE STATE IS BUILT BY ADMIN WRITE AND SAYS SO (Verification 47's clause):
// the APPROVED request that makes V1 "approved". Approving needs a second
// person (the requester may never approve their own request), which one
// account cannot be. The raise reads only that the row exists and is approved.
//
// UNWIRED: needs a live server, a session and the migration. Run at the
// FROZEN_FIGURES build report.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { api, ApiError } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const TAG = process.argv[2] ?? 'ffdb'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const svc = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const owner = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false },
})
const OWNER_ID = session.user.id
const tryApi = async (m, p, b) => {
  try { return await api(m, p, b) } catch (e) { if (e instanceof ApiError) return { status: e.status, data: e.body }; throw e }
}

// Refuse to run against a database without the column: every refusal below
// would otherwise pass for the wrong reason (an unknown column).
{
  const { error } = await svc.from('deal_sheet_versions').select('frozen_figures').limit(1)
  if (error) { console.log(`STOP: migration 20261117000002 is not applied (${error.message})`); process.exit(3) }
}

const products = (await api('GET', '/base-costs')).data?.products ?? []
if (!products.length) { console.log('STOP: the catalog read returned no products'); process.exit(3) }
const LIVE = catalogToRates(products).rates
const { oppId } = await freshOpportunity(TAG)
try {
  const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data.latest_revision_number
  await api('PATCH', `/opportunities/${oppId}`, { payload: { ssNew: 10, duration: 36, targetMargin: 30 }, expected_revision: await rev() })
  const takeVersion = async (reason) => {
    const inputs = (await api('GET', `/opportunities/${oppId}`)).data.payload
    return (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
      { inputs, reason, rates: frozenRates(resolveRates(inputs, LIVE)), expected_revision: await rev() })).data
  }
  const vRow = async (id) => must(await svc.from('deal_sheet_versions').select('*').eq('id', id).single(), 'version')
  const fpVersions = async () => JSON.stringify(must(await svc.from('deal_sheet_versions')
    .select('id, status, major, minor, frozen_figures, issued_by, issued_at').eq('record_id', oppId).order('created_at'), 'fp'))

  // A refused write: the expected error, and nothing moved.
  const refused = async (label, run, expect) => {
    const before = await fpVersions()
    const { error } = await run()
    const after = await fpVersions()
    check(label, !!error && expect.test(error.message) && before === after,
      `${error ? error.message.slice(0, 110) : 'NO ERROR'}${before === after ? '' : ' / FINGERPRINT MOVED'}`)
  }

  // ── R-FF1: SUBMIT THROUGH THE ROUTE ─────────────────────────────────────
  const d1 = await takeVersion('frozen figures probe, V1')
  check('the draft carries no figures', (await vRow(d1.id)).frozen_figures === null)
  const issued = await tryApi('POST', `/deal-sheet-versions/${d1.id}/issue`, {})
  const v1 = await vRow(d1.id)
  check('R-FF1: the route submits it', issued.status === 200 && v1.status === 'issued', `${issued.status} ${JSON.stringify(issued.data?.error ?? '')}`)
  const ff = v1.frozen_figures
  check('R-FF1: the submitted row carries the server\'s figures', !!ff && ff.builder === 'buildApprovalPage' && !!ff.page?.ask && !!ff.result?.totals,
    ff ? Object.keys(ff).join(',') : 'null')
  check('R-FF1: named by its engine (commit and calculator hash)', /^[0-9a-f]{40}$/.test(ff?.engine?.commit ?? '') && /^[0-9a-f]{64}$/.test(ff?.engine?.dealCalculatorSha256 ?? ''), JSON.stringify(ff?.engine))
  check('R-FF1: the headline figure is read from the stored result', ff?.page?.ask?.contractNet === ff?.result?.totals?.contractNet && ff?.result?.totals?.contractNet > 0, `${ff?.page?.ask?.contractNet}`)
  check('R-FF1: the stored batches are the version\'s own', JSON.stringify(ff?.batches) === JSON.stringify(v1.rates?.batches) && !!ff?.batches)
  const pg = (await api('GET', `/opportunities/${oppId}/approval-page`)).data
  check('R-FF2: the page reads the stored figures', pg?.frozen?.state === 'frozen' && pg.ask.contractNet === ff.page.ask.contractNet, JSON.stringify(pg?.frozen))
  check('R-FF1: today\'s engine agrees with every stored figure at that moment', pg?.frozen?.state === 'frozen' && Object.keys(pg.frozen.today).length === 0, JSON.stringify(pg?.frozen?.today))

  // ── R-FF5: UPDATING A SUBMITTED ROW ──────────────────────────────────────
  // THE OWNER IS STOPPED ONE LAYER EARLIER, BY RLS, AND RLS DOES NOT ERROR.
  // deal_sheet_versions_update_draft reaches drafts only, so the update
  // matches ZERO rows and PostgREST answers an empty success; the trigger
  // never runs. Found on the first run (the check demanded an error). A zero
  // counts only when the owner can SELECT that very row, so the zero is the
  // policy and not a wrong id (Verification 14), and nothing moved.
  {
    const before = await fpVersions()
    const seen = must(await owner.from('deal_sheet_versions').select('id').eq('id', v1.id), 'owner select')
    const { data, error } = await owner.from('deal_sheet_versions').update({ frozen_figures: { forged: true } }).eq('id', v1.id).select('id')
    const after = await fpVersions()
    const how = error ? `trigger: ${error.message.slice(0, 80)}` : `RLS: ${data?.length ?? 'null'} rows updated`
    check('R-FF5 update a submitted row\'s figures, OWNER', seen.length === 1 && before === after &&
      (error ? /is issued and cannot be changed/.test(error.message) : Array.isArray(data) && data.length === 0),
      `${how}; owner sees the row: ${seen.length === 1}${before === after ? '' : ' / FINGERPRINT MOVED'}`)
  }
  await refused('R-FF5 update a submitted row\'s figures, SERVICE ROLE', () => svc.from('deal_sheet_versions').update({ frozen_figures: { forged: true } }).eq('id', v1.id).select('id'), /is issued and cannot be changed/)

  // ── R-FF5: INSERTING A ROW ALREADY SUBMITTED, OR CARRYING FIGURES ────────
  const base = { record_id: oppId, major: 9, minor: 1, reason: 'forged', inputs: v1.inputs, rates: v1.rates, sections: [], revision_number: v1.revision_number, created_by: OWNER_ID }
  // ISSUED WITH NO FIGURES, and a complete issuer, so the ONLY thing that can
  // refuse it is the born-draft rule's issued branch. Found by planning the
  // calibration: carrying figures here, the figures branch refused it too, so
  // removing the issued branch could never make this check fire.
  const issuedRow = { ...base, status: 'issued', frozen_figures: null, issued_by: OWNER_ID, issued_at: new Date().toISOString() }
  await refused('R-FF5 insert a row already issued, OWNER', () => owner.from('deal_sheet_versions').insert(issuedRow).select('id'), /created as a draft with no frozen figures/)
  await refused('R-FF5 insert a row already issued, SERVICE ROLE', () => svc.from('deal_sheet_versions').insert(issuedRow).select('id'), /created as a draft with no frozen figures/)
  await refused('R-FF5 insert a draft carrying figures, OWNER', () => owner.from('deal_sheet_versions').insert({ ...base, status: 'draft', frozen_figures: ff }).select('id'), /created as a draft with no frozen figures/)
  await refused('R-FF5 insert a draft carrying figures, SERVICE ROLE', () => svc.from('deal_sheet_versions').insert({ ...base, status: 'draft', frozen_figures: ff }).select('id'), /created as a draft with no frozen figures/)

  // ── R-FF5: THE RELABEL, OTHER THAN BY THE SERVER, OR WITHOUT FIGURES ─────
  await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 31 }, expected_revision: await rev() })
  const d2 = await takeVersion('frozen figures probe, V2')
  const relabel = { status: 'issued', major: v1.major + 1, minor: 0, issued_by: OWNER_ID, issued_at: new Date().toISOString() }
  await refused('R-FF5 a draft given figures, OWNER', () => owner.from('deal_sheet_versions').update({ frozen_figures: ff }).eq('id', d2.id).select('id'), /a draft carries no frozen figures/)
  await refused('R-FF5 a draft given figures, SERVICE ROLE', () => svc.from('deal_sheet_versions').update({ frozen_figures: ff }).eq('id', d2.id).select('id'), /a draft carries no frozen figures/)
  await refused('R-FF5 submit with figures the OWNER supplies (not the server)', () => owner.from('deal_sheet_versions').update({ ...relabel, frozen_figures: ff }).eq('id', d2.id).select('id'), /only the server may freeze figures/)
  await refused('R-FF5 submit without figures, OWNER', () => owner.from('deal_sheet_versions').update(relabel).eq('id', d2.id).select('id'), /issuing must freeze the figures/)
  await refused('R-FF5 submit without figures, SERVICE ROLE', () => svc.from('deal_sheet_versions').update(relabel).eq('id', d2.id).select('id'), /issuing must freeze the figures/)
  const stranger = must(await svc.from('records').select('owner_id').neq('owner_id', OWNER_ID).not('owner_id', 'is', null).limit(1).single(), 'another owner').owner_id
  await refused('R-FF5 the SERVICE ROLE submits for someone who does not own the record', () => svc.from('deal_sheet_versions').update({ ...relabel, issued_by: stranger, frozen_figures: ff }).eq('id', d2.id).select('id'), /only the record's owner may submit/)

  // ── R-FF4: A RAISE INTO CLOSED WON DERIVES THE WON VERSION ───────────────
  // The approval of V1, by admin write and declared above.
  const rec = must(await svc.from('records').select('record_type, status').eq('id', oppId).single(), 'record')
  must(await svc.from('transition_requests').insert({
    record_id: oppId, record_type: rec.record_type, from_stage: rec.status, to_stage: rec.status, kind: 'review',
    status: 'approved', frozen_revision: v1.revision_number, frozen_version_id: v1.id, requested_by: OWNER_ID,
    closed_by: stranger, closed_at: new Date().toISOString(), close_reason: `${TAG}: V1 approved, admin fixture`,
  }).select('id').single(), 'approved request')
  const raised = await owner.rpc('raise_transition_request', { p_record_id: oppId, p_to_stage: 'Closed Won', p_kind: 'transition', p_frozen_version_id: d2.id })
  check('R-FF4: the raise into Closed Won is accepted', !raised.error, raised.error?.message ?? '')
  check('R-FF4: it froze the APPROVED V1, not the draft it was handed (Architecture 12)', raised.data?.frozen_version_id === v1.id,
    `froze ${raised.data?.frozen_version_id}; V1 ${v1.id}; supplied ${d2.id}`)

  // The headline reads the won version once the raise is approved. Approval
  // needs a second person; set by admin write, declared.
  must(await svc.from('transition_requests').update({ status: 'approved', closed_by: stranger, closed_at: new Date().toISOString() }).eq('id', raised.data.id).select('id').single(), 'approve raise')
  must(await svc.from('records').update({ status: 'Closed Won' }).eq('id', oppId).select('id').single(), 'stage write')
  await api('PATCH', `/opportunities/${oppId}`, { payload: { summary: `${TAG} after the win` }, expected_revision: await rev() })
  const head = (await api('GET', `/opportunities/${oppId}`)).data
  check('R-FF4: the headline is the won version\'s stored figure, labelled as its', head.headline_source === 'won-version' && head.total_contract_value === ff.result.totals.contractNet && /^The won version's figures \(V1\.0\)/.test(head.headline_note ?? ''),
    `${head.headline_source} ${head.total_contract_value} vs ${ff.result.totals.contractNet}: ${head.headline_note}`)
} finally {
  await tearDown(TAG)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
