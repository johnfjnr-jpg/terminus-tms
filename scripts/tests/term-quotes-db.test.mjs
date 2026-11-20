// TERM_QUOTES: what 20261120000001 does, measured against the database it was
// applied to (John's review round 2, item 1: the post-apply proof). Runs under
// `npm run test:db` with the service key, so it goes straight at the table and
// the rpc the way a second writer would, bypassing every route.
//
//   (a) every row that existed before this run reads kind = 'commercials'
//   (b) rates {} and {rates:{}} are refused for BOTH kinds; a real cost basis
//       is admitted for each
//   (c) the rpc takes p_kind, and a call without it lands commercials
//   (d) a draft's kind cannot change, and a relabel changing kind is refused:
//       the relabel-list claim version-guard.test.mjs's pure scan cannot see
//   (e) an insert, and a draft update, on a Closed Won record raise PT423
//   (f) an issued row's update still raises restrict_violation, not PT423
//
// Every refusal is asserted by its REASON (code and named message), and each
// has a companion that differs only in the thing refused and LANDS, so a
// refusal for some incidental reason cannot pass (Verification 14).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag, Fixtures, resolveOwnerId, costBasis } from '../verify-harness.mjs'
import { resolveCurrentBatches } from '../../src/lib/base-costs.js'
import { settingsFromRows, costsFromCatalog, buildParams } from '../../src/lib/term-pricing-settings.js'
import { CLOSED_WON_PRICING_REFUSAL, WON_STAGE } from '../../src/lib/pricing-keys.js'

let db, fixtures, ownerId, runStart, RATES, PARAMS
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }

// A record with one revision to version against, built the way the system
// builds one (append_record_revision), not by writing record_revisions.
async function opportunity(status = 'Qualification') {
  const rec = await fixtures.createRecord({ record_type: 'opportunity', status, owner_id: ownerId })
  must(await db.rpc('append_record_revision', {
    p_record_id: rec.id, p_patch: { targetMargin: 30 }, p_created_by: ownerId, p_remove: [], p_expected_revision: null,
  }), 'fixture revision')
  return rec.id
}

// The rpc exactly as the version route calls it; p_kind only when given, so the
// no-kind call is the nine named arguments every caller sends today.
function insertVersion(recordId, { rates, kind, reason = 'term-quotes-db' } = {}) {
  const args = {
    p_record_id: recordId, p_expected_revision: 1, p_reason: reason,
    p_inputs: { targetMargin: 30 }, p_rates: rates, p_sections: [], p_batch_id: null,
    p_created_by: ownerId, p_created_by_email: null,
  }
  if (kind !== undefined) args.p_kind = kind
  return db.rpc('insert_deal_sheet_version', args)
}

async function landed(recordId, opts) {
  const row = must(await insertVersion(recordId, opts), `insert ${opts.kind ?? '(no kind)'}`)
  fixtures.versions.push(row.id)
  return row
}

// The relabel the issue route performs, as the service role. frozen_figures is
// a placeholder object: the guard asks only that it is present, and the shape
// of real figures is buildFrozenFigures' concern, not this migration's.
const relabelOf = (row) => ({
  status: 'issued', major: row.major + 1, minor: 0, issued_by: ownerId,
  issued_at: new Date().toISOString(), frozen_figures: { fixture: 'term-quotes-db' },
})

before(async () => {
  db = adminClient()
  fixtures = new Fixtures(db, newRunTag())
  ownerId = await resolveOwnerId(db)
  runStart = new Date().toISOString()
  RATES = await costBasis(db, { targetMargin: 30 })
  // A term quote's snapshot is buildParams over the live settings and catalog,
  // READ only (the goldens' rule: never write live settings).
  const asOf = new Date().toISOString().slice(0, 10)
  const rows = must(await db.from('term_pricing_settings').select('key, value').range(0, 199), 'term settings')
  const cat = must(await db.from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost::text, hosting_cost_month::text, install_cost_existing::text, install_cost_new::text')
    .lte('effective_from', asOf).range(0, 999), 'catalog')
  PARAMS = buildParams(settingsFromRows(rows), costsFromCatalog(resolveCurrentBatches(cat, asOf), cat))
  assert.ok(Object.keys(PARAMS.costs).length > 0, 'the live catalog must price at least one product for a term snapshot')
})

after(async () => { await fixtures.teardown() })

test('(a) every row that existed before this run reads kind = commercials', async () => {
  const { count: total, error: e1 } = await db.from('deal_sheet_versions')
    .select('id', { count: 'exact', head: true }).lt('created_at', runStart)
  const { count: commercials, error: e2 } = await db.from('deal_sheet_versions')
    .select('id', { count: 'exact', head: true }).lt('created_at', runStart).eq('kind', 'commercials')
  assert.equal(e1, null, e1?.message); assert.equal(e2, null, e2?.message)
  assert.ok(total > 0, 'there must be existing rows for the claim to be about')
  assert.equal(commercials, total, `${total - commercials} pre-existing row(s) read a kind other than commercials`)
})

test('(b) a version with no cost basis is refused for BOTH kinds, and a real one is admitted', async () => {
  const recordId = await opportunity()
  for (const kind of ['commercials', 'term_quote']) {
    for (const rates of [{}, { rates: {} }, { params: {} }]) {
      const { data, error } = await insertVersion(recordId, { kind, rates })
      if (data?.id) fixtures.versions.push(data.id)
      assert.ok(error, `${kind} with rates ${JSON.stringify(rates)} must be refused`)
      assert.equal(error.code, '23514', `${kind} ${JSON.stringify(rates)}: a CHECK refusal, got ${error.code} ${error.message}`)
      assert.match(error.message, /deal_sheet_versions_rates_have_cost_basis/, `${kind} ${JSON.stringify(rates)}: by the cost basis`)
    }
  }
  // And the basis must be the RIGHT KIND's: each kind's real basis, offered
  // under the other kind, is refused.
  for (const [kind, rates] of [['commercials', { params: PARAMS }], ['term_quote', RATES]]) {
    const { data, error } = await insertVersion(recordId, { kind, rates })
    if (data?.id) fixtures.versions.push(data.id)
    assert.match(error?.message ?? 'ADMITTED', /deal_sheet_versions_rates_have_cost_basis/, `${kind} carrying the other kind's basis must be refused`)
  }
  const c = await landed(recordId, { kind: 'commercials', rates: RATES })
  const t = await landed(recordId, { kind: 'term_quote', rates: { params: PARAMS } })
  assert.equal(c.kind, 'commercials'); assert.equal(t.kind, 'term_quote')
})

test('(c) the rpc takes p_kind, and a call without it lands commercials', async () => {
  const recordId = await opportunity()
  const plain = await landed(recordId, { rates: RATES })
  assert.equal(plain.kind, 'commercials', 'the nine-argument call every caller sends today lands commercials')
  const term = await landed(recordId, { kind: 'term_quote', rates: { params: PARAMS } })
  assert.equal(term.kind, 'term_quote')
  // One sequence across kinds (P1): the term quote takes the next number.
  assert.equal(`${term.major}.${term.minor}`, `${plain.major}.${plain.minor + 1}`)
  const { error } = await insertVersion(recordId, { kind: 'bogus', rates: RATES })
  assert.match(error?.message ?? 'ADMITTED', /deal_sheet_versions_kind_known/, 'an unknown kind is refused by name')
})

test('(d) a draft\'s kind cannot change, and a relabel changing kind is refused', async () => {
  const recordId = await opportunity()
  const draft = await landed(recordId, { rates: RATES })

  // Companion first: the same draft takes an ordinary edit, so the refusal
  // below is about kind and nothing else.
  must(await db.from('deal_sheet_versions').update({ reason: 'edited' }).eq('id', draft.id).select('id').single(), 'draft edit')
  const k = await db.from('deal_sheet_versions').update({ kind: 'term_quote', rates: { params: PARAMS } }).eq('id', draft.id).select('id')
  assert.equal(k.error?.code, '23001', `a draft kind change must be refused by the guard, got ${k.error?.code} ${k.error?.message}`)
  assert.match(k.error.message, /pricing method cannot change; take a new version/)

  // The relabel. A valid relabel LANDS (companion), and the identical relabel
  // also changing kind is refused by the relabel's guarded list. kind is the
  // only difference, and the list's message is the only one that can answer.
  const a = await landed(recordId, { rates: RATES, reason: 'relabel with kind' })
  const r = await db.from('deal_sheet_versions')
    .update({ ...relabelOf(a), kind: 'term_quote', rates: { params: PARAMS } }).eq('id', a.id).select('id')
  assert.equal(r.error?.code, '23001', `a relabel changing kind must be refused, got ${r.error?.code} ${r.error?.message}`)
  assert.match(r.error.message, /issuing may set the status, number, issuer and frozen figures only/)

  const b = await landed(recordId, { rates: RATES, reason: 'relabel without kind' })
  const ok = must(await db.from('deal_sheet_versions').update(relabelOf(b)).eq('id', b.id).select('id, status, kind').single(), 'valid relabel')
  assert.equal(ok.status, 'issued'); assert.equal(ok.kind, 'commercials')
})

test('(e) Closed Won: an insert of either kind, and a draft update, raise PT423; (f) an issued row still raises restrict_violation', async () => {
  const recordId = await opportunity()
  const draft = await landed(recordId, { rates: RATES, reason: 'draft before the win' })
  const toIssue = await landed(recordId, { rates: RATES, reason: 'issued before the win' })
  must(await db.from('deal_sheet_versions').update(relabelOf(toIssue)).eq('id', toIssue.id).select('id').single(), 'issue before the win')

  must(await db.from('records').update({ status: WON_STAGE }).eq('id', recordId).select('id').single(), 'the win')

  for (const [kind, rates] of [['commercials', RATES], ['term_quote', { params: PARAMS }]]) {
    const { data, error } = await insertVersion(recordId, { kind, rates })
    if (data?.id) fixtures.versions.push(data.id)
    assert.equal(error?.code, 'PT423', `${kind} insert on Closed Won: got ${error?.code ?? 'ADMITTED'} ${error?.message ?? ''}`)
    assert.equal(error.message, CLOSED_WON_PRICING_REFUSAL, 'in the screen\'s own words')
  }
  const direct = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 90, status: 'draft', reason: 'direct', revision_number: 1,
    inputs: { targetMargin: 30 }, rates: RATES, sections: [], created_by: ownerId,
  }).select('id')
  if (direct.data?.[0]?.id) fixtures.versions.push(direct.data[0].id)
  assert.equal(direct.error?.code, 'PT423', `a direct insert on Closed Won: got ${direct.error?.code ?? 'ADMITTED'}`)

  const du = await db.from('deal_sheet_versions').update({ reason: 'after the win' }).eq('id', draft.id).select('id')
  assert.equal(du.error?.code, 'PT423', `a draft update on Closed Won: got ${du.error?.code ?? 'LANDED'} ${du.error?.message ?? ''}`)

  // (f) The issued row is refused by immutability, and the Closed Won trigger
  // stands aside for it: restrict_violation, never PT423.
  const iu = await db.from('deal_sheet_versions').update({ reason: 'after the win' }).eq('id', toIssue.id).select('id')
  assert.equal(iu.error?.code, '23001', `an issued row's update: got ${iu.error?.code ?? 'LANDED'} ${iu.error?.message ?? ''}`)
  assert.match(iu.error.message, /is issued and cannot be changed/)
})

test('(e) companion: the same draft update lands on a record that is NOT Closed Won', async () => {
  const recordId = await opportunity()
  const draft = await landed(recordId, { rates: RATES })
  must(await db.from('deal_sheet_versions').update({ reason: 'not won' }).eq('id', draft.id).select('id').single(), 'draft edit, not won')
})
