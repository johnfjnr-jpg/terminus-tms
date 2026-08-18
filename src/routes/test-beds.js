import { createUserClient } from '../supabase.js'
import { issueReferenceNumber } from '../lib/reference-number.js'
import { isValidIsoDate, isNotPastIsoDate, isValidNonNegativeInteger, isValidNonNegativePercent } from '../lib/field-validation.js'
import { calculateTestBedCost } from '../lib/deal-calculator.js'

// Round 5 Phase 6 (2026-08-17): builds the itemized cost breakdown from
// whatever's currently in a Test Bed's payload - the one place this
// mapping happens, called from both GET (live display) and PATCH
// (persisting accumulated_cost/indicativeCost so the two existing
// consumers that read those stored fields directly, the Test Beds list
// view and Test Bed -> Opportunity conversion, never see a stale number
// regardless of which tab last saved a relevant field).
function buildTestBedCostBreakdown(payload) {
  const num = (v) => Number(v) || 0
  return calculateTestBedCost({
    ssUnitCost: num(payload.ssUnitCost), ssUnits: num(payload.safesightCameras),
    aqUnitCost: num(payload.aqUnitCost), aqUnits: num(payload.airQualitySensors),
    hemirUnitCost: num(payload.hemirUnitCost), hemirUnits: num(payload.hemirSensors),
    warrantyPct: payload.warrantyPct !== undefined && payload.warrantyPct !== '' ? num(payload.warrantyPct) : 2,
    installLineItems: [
      { key: 'inSs', cost: num(payload.ssInstallCost) * num(payload.safesightCameras) },
      { key: 'inAqm', cost: num(payload.aqInstallCost) * num(payload.airQualitySensors) },
      { key: 'inHemir', cost: num(payload.hemirInstallCost) * num(payload.hemirSensors) },
    ],
    hostingLineItems: [
      { key: 'hoSs', cost: num(payload.ssHostingCost) * num(payload.safesightCameras) },
      { key: 'hoAqm', cost: num(payload.aqHostingCost) * num(payload.airQualitySensors) },
      { key: 'hoHemir', cost: num(payload.hemirHostingCost) * num(payload.hemirSensors) },
    ],
    months: num(payload.testBedDuration),
  })
}

// Confirmed picklist values (2026-08-15, Milestone 2) - not the prototype's
// literal Government/Local Council/Private/Other, extended to match the
// prototype's own real sample data (Local Authority, Port Authority,
// National Highways), plus Central Government and a kept Other/Private.
// Same validation-array pattern as CONTACT_WRITABLE_KEYS/VALID_SOURCES in
// contacts.js, not a new picklist-admin table - none exists yet for any
// field. Not yet wired into any write path: there is no PATCH endpoint
// for Test Bed reference fields yet (Milestone 4, screens), so this is
// the confirmed value set, ready for that endpoint when it's built, the
// same way Milestone 1's reference generator exists before anything
// calls it.
export const VALID_SITE_OWNERSHIP = [
  'Local Authority', 'Port Authority', 'National Highways',
  'Central Government', 'Private', 'Other',
]

export default async function testBedsRoutes(app) {
  // GET /api/test-beds
  //
  // Milestone 4: also resolves linked Account name and industry name for
  // the list view's columns (Test Bed name, linked Account, Region,
  // Industry, Stage, Indicative Cost, created date) - bulk-resolved here,
  // not per-row, same reasoning as the detail endpoint's join.
  app.get('/test-beds', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: beds, error } = await db
      .from('records')
      .select('*')
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list test beds')
      return reply.code(500).send({ error: error.message })
    }
    if (!beds.length) return []

    const ids = beds.map(b => b.id)
    const { data: revs } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    const accountIds = [...new Set(beds.map(b => b.account_id).filter(Boolean))]
    const industryIds = [...new Set(beds.map(b => b.industry_id).filter(Boolean))]

    const [accountRevsResult, industriesResult] = await Promise.all([
      accountIds.length
        ? db.from('record_revisions').select('record_id, payload').in('record_id', accountIds).order('revision_number', { ascending: false })
        : Promise.resolve({ data: [] }),
      industryIds.length
        ? db.from('industries').select('id, name').in('id', industryIds)
        : Promise.resolve({ data: [] })
    ])

    const accountNames = {}
    for (const rev of accountRevsResult.data ?? []) {
      if (!(rev.record_id in accountNames)) accountNames[rev.record_id] = rev.payload?.name ?? null
    }
    const industryNames = Object.fromEntries((industriesResult.data ?? []).map(i => [i.id, i.name]))

    return beds.map(b => ({
      ...b,
      payload: latestPayload[b.id] ?? {},
      account_name: b.account_id ? (accountNames[b.account_id] ?? null) : null,
      industry_name: b.industry_id ? (industryNames[b.industry_id] ?? null) : null
    }))
  })

  // POST /api/test-beds
  //
  // reference_code (2026-08-15, new, small and scoped): if industry_id and
  // country_code are both provided, issues a real TT-{country}-{industry}-
  // {number} code via the Milestone 1 counter and stores it. If either is
  // missing, reference_code stays null - "not yet generated", the same
  // honest-empty-state Opportunity's own Reference tab already uses, not
  // a fabricated placeholder. Neither field is required to create the
  // record at all (PROTOTYPE_SPECIFICATION.md Section 6's "no fields are
  // mandatory purely to create the record" decision stands - this only
  // adds what happens when they ARE provided).
  //
  // country_code is accepted pre-resolved (a 3-letter code, e.g. "GBR"),
  // not derived from a free-text country name here. No country-name-to-
  // code mapping exists anywhere in this codebase yet (checked before
  // building this - the prototype's own countryToCode() was never
  // ported), and inventing one now risks getting real countries wrong
  // silently. industry_id is the real records column, resolved to its
  // 6-character industries.short_code the same way the reference format
  // has always needed.
  //
  // Opportunity has the identical gap - its own creation path doesn't
  // call issueReferenceNumber() either - deliberately not fixed here,
  // out of this milestone's scope, logged in the report instead.
  // account_id (2026-08-15, Milestone 3): a hard precondition at creation,
  // not a Qualification exit-gate field (PROTOTYPE_SPECIFICATION.md
  // Section 6, "Account link"). Enforced twice, deliberately: here at the
  // application layer (a clear 400 before anything is written), and
  // again by the database's own records_test_bed_requires_account_id
  // CHECK constraint (20260815000002/3) as the real backstop - the
  // constraint is what actually protects data integrity, this check is
  // what gives the caller a clean error instead of a raw 23514.
  app.post('/test-beds', async (request, reply) => {
    const { name, client_organisation, notes, accumulated_cost, industry_id, country_code, account_id } = request.body ?? {}

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }
    if (!account_id) {
      return reply.code(400).send({ error: 'account_id is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: account, error: accountErr } = await db
      .from('records')
      .select('id')
      .eq('id', account_id)
      .eq('record_type', 'account')
      .is('deleted_at', null)
      .maybeSingle()

    if (accountErr || !account) {
      return reply.code(400).send({ error: 'account_id does not match a known Account' })
    }

    let referenceCode = null
    if (industry_id && country_code) {
      const { data: industry, error: industryErr } = await db
        .from('industries')
        .select('short_code')
        .eq('id', industry_id)
        .maybeSingle()

      if (industryErr || !industry) {
        return reply.code(400).send({ error: 'industry_id does not match a known industry' })
      }

      try {
        referenceCode = await issueReferenceNumber(db, country_code, industry.short_code)
      } catch (refErr) {
        request.log.error({ err: refErr }, 'failed to issue reference number')
        return reply.code(500).send({ error: refErr.message })
      }
    }

    // 'Qualification' (2026-08-15, corrected from the old model's 'NDA')
    // - the flat 8-stage list starts here, matching stage_definitions.
    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'test_bed',
        status: 'Qualification',
        owner_id: request.user.id,
        industry_id: industry_id ?? null,
        reference_code: referenceCode,
        account_id
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert test bed')
      return reply.code(500).send({ error: recordErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: record.id,
        revision_number: 1,
        payload: {
          name: name.trim(),
          client_organisation: client_organisation?.trim() ?? null,
          notes: notes?.trim() ?? null,
          accumulated_cost: accumulated_cost != null ? Number(accumulated_cost) : 0
        },
        created_by: request.user.id
      })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert test bed revision')
      return reply.code(500).send({ error: revErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'test_bed',
      action: 'created',
      actor_id: request.user.id,
      detail: { name: name.trim() }
    })

    return reply.code(201).send(record)
  })

  // GET /api/test-beds/:id
  //
  // Milestone 4: also resolves industry name, linked Account name, and
  // the buyer/owner record_contacts links (role + contact name) - the
  // detail page's Reference/Site Details tabs need all of this to
  // render, and re-deriving it client-side would mean N extra round
  // trips per field. Read-only resolution, no writes.
  app.get('/test-beds/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const [bedResult, revResult] = await Promise.all([
      db.from('records')
        .select('*')
        .eq('id', request.params.id)
        .eq('record_type', 'test_bed')
        .is('deleted_at', null)
        .maybeSingle(),
      db.from('record_revisions')
        .select('revision_number, payload, created_at')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (bedResult.error || !bedResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    const bed = bedResult.data

    const [industryResult, accountResult, contactsResult] = await Promise.all([
      bed.industry_id
        ? db.from('industries').select('id, name, short_code').eq('id', bed.industry_id).maybeSingle()
        : Promise.resolve({ data: null }),
      bed.account_id
        ? db.from('records').select('id, deleted_at').eq('id', bed.account_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from('record_contacts').select('id, contact_id, role, created_at').eq('record_id', bed.id)
    ])

    let account = null
    if (accountResult.data) {
      const { data: acctRev } = await db
        .from('record_revisions')
        .select('payload')
        .eq('record_id', accountResult.data.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      account = { id: accountResult.data.id, name: acctRev?.payload?.name ?? null }
    }

    const links = contactsResult.data ?? []
    const contactIds = [...new Set(links.map(l => l.contact_id))]
    let contactNames = {}
    if (contactIds.length) {
      const { data: contactRevs } = await db
        .from('record_revisions')
        .select('record_id, payload')
        .in('record_id', contactIds)
        .order('revision_number', { ascending: false })
      for (const r of contactRevs ?? []) {
        if (!(r.record_id in contactNames)) contactNames[r.record_id] = r.payload?.name ?? r.payload?.contact_name ?? null
      }
    }

    const buyer_contacts = links.map(l => ({
      role: l.role,
      contact_id: l.contact_id,
      name: contactNames[l.contact_id] ?? null
    }))

    const payload = revResult.data?.payload ?? {}

    return {
      ...bed,
      payload,
      latest_revision_number: revResult.data?.revision_number ?? 1,
      industry: industryResult.data ? { id: industryResult.data.id, name: industryResult.data.name } : null,
      account,
      buyer_contacts,
      // Round 5 Phase 6: always live-recomputed from the current payload,
      // never read back as a stored value itself - the detail page's own
      // Commercials tab is never more than one PATCH away from stale
      // otherwise. accumulated_cost/indicativeCost (in payload above) are
      // the persisted mirror other consumers read directly (see PATCH
      // below), this is the authoritative, itemized source they mirror.
      costBreakdown: buildTestBedCostBreakdown(payload),
    }
  })

  // PATCH /api/test-beds/:id
  //
  // Ordinary field edits, same pattern as PATCH /contacts/:id and
  // PATCH /opportunities/:id - payload merge, no new revision fields
  // beyond what's already writable. account_id is deliberately NOT
  // accepted here (same reasoning as contacts.js's PATCH excluding it) -
  // it's a creation-time precondition (Milestone 3), not a plain field
  // edit; there is no endpoint to change it post-creation, matching how
  // there is no unlink-Account action anywhere in this app.
  const TEST_BED_WRITABLE_KEYS = new Set([
    'name', 'client_organisation', 'notes', 'summary',
    'terminusLead', 'commercialAuthority', 'technicalAuthority', 'region', 'country',
    'siteOwnership', 'installationEnvironment', 'siteAddress', 'city',
    'safesightCameras', 'airQualitySensors', 'hemirSensors', 'estCostPerUnit',
    'testBedDuration', 'estimatedInstallationDate', 'estGoLiveDate',
    'installer', 'techTeam', 'installNotes',
    // terminusCommercialOwner/terminusTechnicalOwner removed (2026-08-16,
    // Phase 7) - they duplicated the real, prototype-accurate
    // commercialAuthority/technicalAuthority fields above under a
    // different, unused key (confirmed empty on the only real Test Bed
    // record before removal, and absent from the prototype's own Test
    // Bed field spec entirely). terminusLegalOwner stays - it's the only
    // Legal-flavoured field that ever existed here, now surfaced as
    // "Legal Authority" in the Reference tab's Terminus Details panel.
    'terminusLegalOwner', 'initialLead',
    'useCases',
    // Round 5 Phase 6 (2026-08-17): Commercials tab, Base Cost Data
    // stopgap - same freely-editable-payload-field convention already
    // used for Opportunity's own rate fields (ssUnitCost etc.,
    // opportunities.js), a deliberate, flagged departure from that
    // route's version specifically: Opportunity's rates are locked
    // read-only after creation (a stopgap-on-a-stopgap, per that route's
    // own comment, pending a real admin-maintained rate table), but Test
    // Bed's Commercials tab is a brand-new build with nothing historical
    // to protect, so its rates stay freely editable through this same
    // generic PATCH like any other field, via the same click-to-edit
    // batch-save mechanism the Reference tab already uses. Test Bed's
    // own install-cost shape is 3 lines (SafeSight/AQ/HEMIR), not
    // Opportunity's 4 (which splits SafeSight into existing/new
    // infrastructure) - Test Bed's own unit-count fields never carried
    // that split, so there's nothing to mirror there.
    'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
    'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
    'ssHostingCost', 'aqHostingCost', 'hemirHostingCost',
    'warrantyPct',
    // accumulated_cost/indicativeCost deliberately removed from this
    // allowlist (2026-08-17) - both are now server-computed, itemized
    // totals (buildTestBedCostBreakdown, below), never client-writable
    // inputs, matching the brief's own "not separate, manually-implied
    // numbers." A client PATCH naming either key is now rejected outright
    // by the disallowed-keys check below, the same as any other
    // unrecognised field.
  ])

  app.patch('/test-beds/:id', async (request, reply) => {
    const { payload, industry_id } = request.body ?? {}

    if (payload) {
      const disallowed = Object.keys(payload).filter(k => !TEST_BED_WRITABLE_KEYS.has(k))
      if (disallowed.length) {
        return reply.code(400).send({
          error: 'payload contains fields that cannot be set from this endpoint',
          disallowed
        })
      }
      if ('siteOwnership' in payload && payload.siteOwnership && !VALID_SITE_OWNERSHIP.includes(payload.siteOwnership)) {
        return reply.code(400).send({ error: `siteOwnership must be one of: ${VALID_SITE_OWNERSHIP.join(', ')}` })
      }
      // Real bug found and fixed (2026-08-15): these fields had a writable
      // key but zero value validation, a plain text input accepted (and
      // this endpoint happily persisted) a garbled date string and a
      // non-numeric duration on a real live record. Client-side now uses
      // <input type="date">/type="number">, but per this session's own
      // rule against trusting client-only validation, the same rejection
      // is enforced here independently.
      for (const key of ['estimatedInstallationDate', 'estGoLiveDate']) {
        if (key in payload && !isValidIsoDate(payload[key])) {
          return reply.code(400).send({ error: `${key} must be a valid date (YYYY-MM-DD)` })
        }
      }
      // Past-date restriction (Round 5 Phase 4, 2026-08-17), mirroring
      // Round 3 Phase 3's identical fix on Opportunity's estGoLive: both
      // are estimates, not records of something that already happened, a
      // past "estimate" is nonsensical. Unlike Opportunity, Test Bed has
      // no "actual" counterpart date field at all (TB_DATE_FIELDS,
      // test-bed-detail.js, is just these two estimates plus Duration) -
      // there's nothing to deliberately exclude the way
      // actualClose/actualGoLive were.
      for (const key of ['estimatedInstallationDate', 'estGoLiveDate']) {
        if (key in payload && !isNotPastIsoDate(payload[key])) {
          return reply.code(400).send({ error: `${key} cannot be in the past` })
        }
      }
      // testBedDuration (Round 5 Phase 4): upgraded from isValidNumber
      // (any finite number, including negative/fractional) to
      // isValidNonNegativeInteger, the same real-months-can't-be-negative-
      // or-fractional reasoning already applied to Opportunity's own
      // Contract Duration (Round 3 Phase 3) - a duration in months has the
      // identical shape on both record types.
      if ('testBedDuration' in payload && !isValidNonNegativeInteger(payload.testBedDuration)) {
        return reply.code(400).send({ error: 'testBedDuration must be a non-negative whole number' })
      }
      // Round 5 Phase 6: Base Cost Data rate fields and warrantyPct -
      // isValidNonNegativePercent is misleadingly named for this use (it's
      // really just "non-negative, up to 2 decimal places"), but that's
      // exactly the right shape for a dollar rate too, not just a
      // percentage, and reusing it avoids a near-duplicate validator.
      for (const key of ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'ssInstallCost', 'aqInstallCost', 'hemirInstallCost', 'ssHostingCost', 'aqHostingCost', 'hemirHostingCost', 'warrantyPct']) {
        if (key in payload && !isValidNonNegativePercent(payload[key])) {
          return reply.code(400).send({ error: `${key} must be a non-negative number, up to 2 decimal places` })
        }
      }
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    if (industry_id !== undefined) {
      const { data: updated, error: updateErr } = await db
        .from('records')
        .update({ industry_id })
        .eq('id', record.id)
        .select('id')
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
      if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
    }

    if (payload) {
      // Real bug found and fixed (2026-08-15): this fetch's error was
      // never checked. A failed fetch made revRow undefined, which
      // mergedPayload below then silently treated as "no existing
      // payload" - a save would have wiped every other field on the
      // record down to just whatever this one PATCH submitted, with no
      // error surfaced. Checking revRowErr explicitly and rejecting the
      // save is the only way this endpoint can tell "genuinely no prior
      // revision" (revRow is null, no error) apart from "couldn't find
      // out" (revRowErr is set) - only the first is safe to treat as an
      // empty base to merge into.
      const { data: revRow, error: revRowErr } = await db
        .from('record_revisions')
        .select('revision_number, payload')
        .eq('record_id', record.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (revRowErr) {
        request.log.error({ err: revRowErr }, 'failed to load current revision before PATCH merge')
        return reply.code(500).send({ error: revRowErr.message })
      }

      const nextRevision = (revRow?.revision_number ?? 0) + 1
      const mergedPayload = { ...(revRow?.payload ?? {}), ...payload }

      // Round 5 Phase 6: recomputed on every save, not just when a rate
      // field itself changes - a save from the Reference tab (a unit
      // count or Duration) affects the real cost exactly as much as a
      // save from Commercials does, so both must keep accumulated_cost/
      // indicativeCost genuinely current, not just the tab that happens
      // to "own" the rate inputs. Both fields always mirror the same
      // computed total (the brief's own "not separate, manually-implied
      // numbers") - not two independently-meaningful figures.
      const costBreakdown = buildTestBedCostBreakdown(mergedPayload)
      mergedPayload.accumulated_cost = costBreakdown.totalCost
      mergedPayload.indicativeCost = costBreakdown.totalCost

      const { error: revErr } = await db
        .from('record_revisions')
        .insert({ record_id: record.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

      if (revErr) return reply.code(500).send({ error: revErr.message })
    }

    return reply.send({ ok: true })
  })

  // GET /api/test-beds/:id/document-requirements
  //
  // Milestone 4 close-out (2026-08-15): confirmed by tracing the code
  // directly (not inferred) that this endpoint's only data source was
  // stage_gate_rules document_status rows, plus a phase-grouping
  // fallback that's permanently dead (phase is null on every test_bed
  // stage since Milestone 2's flattening). Net effect: this returned []
  // for every stage of every Test Bed, not the deliberate "informational,
  // correctly empty" case it looked like - PROTOTYPE_SPECIFICATION.md
  // Section 6's own per-stage docs list (e.g. "Pre-Site Assessment: NDA")
  // was never actually surfaced, because informational display and
  // gating had been conflated into one mechanism.
  //
  // Response is now { reference_docs, completable_documents } - two
  // deliberately separate arrays, not merged, so the frontend can't
  // conflate "go get this" with "this blocks your transition":
  //   - reference_docs: unconditional, from the new stage_reference_docs
  //     table, keyed by the CURRENT stage (not from_stage/to_stage - this
  //     has nothing to do with gating a transition, it's "while you're
  //     in this stage, here's what to go get"). No stage_gate_rules
  //     involved at all.
  //   - completable_documents: exactly the prior logic, unchanged -
  //     document_status gate rules (+ the same phase-fallback, still
  //     dead today but left as-is, not removed, since it's not what this
  //     fix is about) matched against real record_type='document' child
  //     records.
  // Round 5 Phase 7 (2026-08-17): ?stage=<name> - investigated first, per
  // the brief. This endpoint was hardcoded to bed.status throughout, the
  // record's own real current stage, correct for the old single
  // Documents tab (which only ever showed "wherever this Test Bed
  // actually is right now"), but wrong for the new 8 stage tabs, each of
  // which must show a specific NAMED stage's own Documents regardless of
  // where the record actually is. Generalized by threading an explicit
  // targetStage through every place bed.status was previously read
  // directly - reference_docs keyed by stage_name=targetStage, and
  // completable_documents computed for targetStage's own exit gate
  // (targetStage -> whatever stage follows it in stage_definitions),
  // same phase-fallback logic, now driven by targetStage's own index/
  // phase rather than bed.status's. Defaults to bed.status when omitted,
  // so this is a strict superset of the old behaviour, not a breaking
  // change to any existing caller.
  app.get('/test-beds/:id/document-requirements', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: bed } = await db
      .from('records')
      .select('id, status')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .maybeSingle()

    if (!bed) return reply.code(404).send({ error: 'not found' })

    const targetStage = request.query?.stage || bed.status

    const { data: referenceDocs } = await db
      .from('stage_reference_docs')
      .select('document_name')
      .eq('record_type', 'test_bed')
      .eq('stage_name', targetStage)

    const reference_docs = (referenceDocs ?? []).map(d => ({ document_name: d.document_name }))

    const { data: stages } = await db
      .from('stage_definitions')
      .select('stage_name, sort_order, phase')
      .eq('record_type', 'test_bed')
      .is('variant', null)
      .order('sort_order', { ascending: true })

    const stageList = stages ?? []
    const currentIdx = stageList.findIndex(s => s.stage_name === targetStage)
    const nextStage = stageList[currentIdx + 1]?.stage_name

    if (!nextStage) return { reference_docs, completable_documents: [] }

    let { data: rules } = await db
      .from('stage_gate_rules')
      .select('requirement_detail')
      .eq('record_type', 'test_bed')
      .is('variant', null)
      .eq('from_stage', targetStage)
      .eq('to_stage', nextStage)
      .eq('requirement_type', 'document_status')

    // Fallback: when there are no direct gate rules but the stage belongs to a
    // phase (e.g. Site Assessment, PaTBA), show the phase-exit gate documents so
    // all planning documents are visible and workable from Site Assessment onwards.
    if (!rules?.length) {
      const currentPhase = stageList[currentIdx]?.phase
      if (currentPhase) {
        const phaseStages = stageList.filter(s => s.phase === currentPhase)
        const lastPhaseStage = phaseStages[phaseStages.length - 1]
        const lastPhaseIdx = stageList.findIndex(s => s.stage_name === lastPhaseStage?.stage_name)
        const afterPhaseStage = stageList[lastPhaseIdx + 1]?.stage_name

        if (lastPhaseStage && afterPhaseStage) {
          const { data: phaseExitRules } = await db
            .from('stage_gate_rules')
            .select('requirement_detail')
            .eq('record_type', 'test_bed')
            .is('variant', null)
            .eq('from_stage', lastPhaseStage.stage_name)
            .eq('to_stage', afterPhaseStage)
            .eq('requirement_type', 'document_status')
          rules = phaseExitRules
        }
      }
    }

    if (!rules?.length) return { reference_docs, completable_documents: [] }

    // Lower severity than the PATCH/link-account fixes above, but the
    // same unchecked-error shape: a failed fetch here made docs
    // undefined, so docMap stayed empty and every completable_documents
    // row would show "Not started" even for a document that's actually
    // been approved - the query result was never trusted enough to error
    // on, but it also wasn't distrusted enough to check.
    const { data: docs, error: docsErr } = await db
      .from('records')
      .select('id, variant, status')
      .eq('parent_record_id', bed.id)
      .eq('record_type', 'document')
      .is('deleted_at', null)

    if (docsErr) {
      request.log.error({ err: docsErr }, 'failed to load document records for document-requirements')
      return reply.code(500).send({ error: docsErr.message })
    }

    const docMap = {}
    for (const d of docs ?? []) {
      docMap[d.variant] = { id: d.id, status: d.status }
    }

    const docIds = Object.values(docMap).map(d => d.id).filter(Boolean)
    const locationMap = {}
    if (docIds.length) {
      const { data: details } = await db
        .from('document_details')
        .select('record_id, document_location')
        .in('record_id', docIds)
      for (const det of details ?? []) {
        locationMap[det.record_id] = det.document_location
      }
    }

    const completable_documents = rules.map(r => {
      const doc = docMap[r.requirement_detail.document]
      return {
        document: r.requirement_detail.document,
        required_status: r.requirement_detail.status,
        current_status: doc?.status ?? null,
        document_record_id: doc?.id ?? null,
        document_location: doc?.id ? (locationMap[doc.id] ?? null) : null
      }
    })

    return { reference_docs, completable_documents }
  })

  // POST /api/test-beds/:id/complete-document
  // Marks a planning document as approved (status always set to "approved").
  // Optionally stores a Google Drive URL in document_details.
  app.post('/test-beds/:id/complete-document', async (request, reply) => {
    const { document_type, document_location } = request.body ?? {}
    const status = 'approved'

    if (!document_type?.trim()) return reply.code(400).send({ error: 'document_type is required' })

    const db = createUserClient(request.jwt)

    const { data: bed } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .maybeSingle()

    if (!bed) return reply.code(404).send({ error: 'test bed not found' })

    // Lower severity than the PATCH/link-account fixes above, but the
    // same unchecked-error shape: a failed fetch here made `existing`
    // look falsy, so the code below would fall into the create-new-
    // document branch and insert a duplicate record_type='document' row
    // instead of updating the one that's actually there.
    const { data: existing, error: existingErr } = await db
      .from('records')
      .select('id')
      .eq('parent_record_id', bed.id)
      .eq('record_type', 'document')
      .eq('variant', document_type)
      .maybeSingle()

    if (existingErr) {
      request.log.error({ err: existingErr }, 'failed to check for existing document record')
      return reply.code(500).send({ error: existingErr.message })
    }

    let docId
    if (existing) {
      // records_select is team-wide, records_update is still owner-only -
      // a non-owner's update() is filtered by RLS to zero affected rows
      // rather than erroring, so it can't be told apart from success
      // without checking the returned rows directly.
      const { data: updated, error: updateErr } = await db
        .from('records')
        .update({ status })
        .eq('id', existing.id)
        .select('id')
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
      if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
      docId = existing.id
    } else {
      const { data: docRecord, error } = await db
        .from('records')
        .insert({
          record_type: 'document',
          parent_record_id: bed.id,
          status,
          variant: document_type,
          owner_id: request.user.id
        })
        .select()
        .single()

      if (error) {
        request.log.error({ err: error }, 'failed to create document record')
        return reply.code(500).send({ error: error.message })
      }
      docId = docRecord.id
    }

    if (document_location !== undefined) {
      await db.from('document_details').upsert(
        { record_id: docId, document_location: document_location || null },
        { onConflict: 'record_id' }
      )
    }

    await db.from('audit_log').insert({
      record_id: bed.id,
      record_type: 'test_bed',
      action: 'document_approved',
      actor_id: request.user.id,
      detail: { document_type, status }
    })

    return reply.code(existing ? 200 : 201).send({ id: docId, document_type, status })
  })

  // POST /api/test-beds/:id/convert
  //
  // Milestone 5 fixes (2026-08-15), re-verified against today's code
  // before building, not against the Milestone 2 audit as written -
  // account_id/reference_code/buyer-contact linking all changed since:
  //
  // 1. conversion_criteria: was never queried anywhere in this codebase
  //    (checked directly - not by this endpoint, not by Contact's own
  //    create-opportunity/create-test-bed either). Real data showed one
  //    Test Bed converted six times. max_conversions lives in the row's
  //    condition (data-driven, DESIGN_PRINCIPLES.md rule 3), not
  //    hardcoded here - and a missing row for this from/to pair rejects
  //    the conversion outright, same invariant as stage_definitions
  //    (empty list = nothing allowed, not "anything goes").
  // 2. reference_code: the bed select never even fetched this column.
  //    Now carried over unchanged - issueReferenceNumber is deliberately
  //    NOT called on this path (Milestone 1's own build requirement: the
  //    increment must stay a distinct, explicit call so this path can
  //    skip it).
  // 3. account_id: direct copy onto the new Opportunity, no new
  //    mechanism - confirmed (2026-08-15 audit) this endpoint never read
  //    bed.account_id at all before now. Buyer-contact links are
  //    deliberately NOT carried - that's Milestone 6's decision to make
  //    properly (Opportunity's own Person fields are still free text
  //    until then), not something to half-build here.
  app.post('/test-beds/:id/convert', async (request, reply) => {
    const { opportunity_name } = request.body ?? {}

    if (!opportunity_name?.trim()) {
      return reply.code(400).send({ error: 'opportunity_name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: bed, error: bedErr } = await db
      .from('records')
      .select('id, record_type, status, account_id, reference_code')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .maybeSingle()

    if (bedErr || !bed) return reply.code(404).send({ error: 'test bed not found' })

    const { data: criteria } = await db
      .from('conversion_criteria')
      .select('condition')
      .eq('from_record_type', 'test_bed')
      .eq('to_record_type', 'opportunity')
      .maybeSingle()

    if (!criteria) {
      return reply.code(422).send({ error: 'test_bed -> opportunity is not a defined conversion' })
    }

    const maxConversions = criteria.condition?.max_conversions
    if (maxConversions != null) {
      // records!opportunity_details_record_id_fkey, not the bare
      // "records!inner(...)" this originally shipped with - opportunity_
      // details has TWO foreign keys to records (record_id AND
      // converted_from_test_bed_id), so the ambiguous embed failed with
      // PGRST201 every time. Found live: the unchecked error meant that
      // failure was silently treated as "0 prior conversions" and a
      // second conversion went through unblocked - confirmed by actually
      // attempting one, not assumed from reading the code. Checking
      // priorErr explicitly now, same discipline as everywhere else in
      // this codebase that doesn't trust a query result without
      // checking its error first.
      const { data: priorConversions, error: priorErr } = await db
        .from('opportunity_details')
        .select('record_id, records!opportunity_details_record_id_fkey(deleted_at)')
        .eq('converted_from_test_bed_id', bed.id)

      if (priorErr) {
        request.log.error({ err: priorErr }, 'failed to check prior Test Bed conversions')
        return reply.code(500).send({ error: priorErr.message })
      }

      const liveConversions = (priorConversions ?? []).filter(c => !c.records?.deleted_at)

      if (liveConversions.length >= maxConversions) {
        return reply.code(422).send({
          error: 'This Test Bed has already been converted to an Opportunity'
        })
      }
    }

    const { data: bedRev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', bed.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const bedPayload = bedRev?.payload ?? {}

    const { data: probDefault } = await db
      .from('stage_probability_defaults')
      .select('default_probability_pct')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage', 'Discovery')
      .maybeSingle()

    const { data: opp, error: oppErr } = await db
      .from('records')
      .insert({
        record_type: 'opportunity',
        status: 'Discovery',
        owner_id: request.user.id,
        account_id: bed.account_id ?? null,
        reference_code: bed.reference_code ?? null
      })
      .select()
      .single()

    if (oppErr) {
      request.log.error({ err: oppErr }, 'failed to create opportunity from test bed')
      return reply.code(500).send({ error: oppErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: opp.id,
        revision_number: 1,
        payload: {
          name: opportunity_name.trim(),
          company_name: bedPayload.client_organisation ?? '',
          // customerLead (Round 2 Phase 1, 2026-08-16): carries the Test
          // Bed's initialLead value across unchanged, same treatment as
          // account_id/reference_code above - a genuine field-name
          // mapping (Test Bed calls it initialLead, Opportunity calls
          // the identical concept customerLead), not a copy-by-key.
          customerLead: bedPayload.initialLead ?? null
        },
        created_by: request.user.id
      })

    if (revErr) return reply.code(500).send({ error: revErr.message })

    const { error: detErr } = await db
      .from('opportunity_details')
      .insert({
        record_id: opp.id,
        probability_pct: probDefault?.default_probability_pct ?? null,
        converted_from_test_bed_id: bed.id,
        test_bed_cost: bedPayload.accumulated_cost ?? null
      })

    if (detErr) return reply.code(500).send({ error: detErr.message })

    await db.from('audit_log').insert([
      {
        record_id: bed.id,
        record_type: 'test_bed',
        action: 'converted_to_opportunity',
        actor_id: request.user.id,
        detail: { opportunity_id: opp.id }
      },
      {
        record_id: opp.id,
        record_type: 'opportunity',
        action: 'created_from_test_bed',
        actor_id: request.user.id,
        detail: {
          from_test_bed_id: bed.id,
          test_bed_cost: bedPayload.accumulated_cost ?? null,
          account_id: bed.account_id ?? null,
          reference_code: bed.reference_code ?? null
        }
      }
    ])

    return reply.code(201).send({
      ...opp,
      converted_from_test_bed_id: bed.id,
      test_bed_cost: bedPayload.accumulated_cost ?? null
    })
  })

  // POST /api/test-beds/:id/buyer-contacts
  //
  // Milestone 3: the save-time validation point 3 of the brief asks for -
  // "Validate this at save time, real rejection if the Contact isn't
  // linked to the right Account, not a soft warning." Real rejection
  // (422), not the gate check itself (contact_role_linked in
  // transitions.js only checks a validated link already exists, it does
  // not re-derive the Account match).
  //
  // Restricted to the three Client Buyer roles - this endpoint is not a
  // general-purpose "link any contact with any role" action, that's a
  // larger, un-asked-for piece of surface area. The existing internal
  // linkContact() helper in contacts.js (role='commercial buyer' at
  // creation) is untouched and unrelated to this.
  const VALID_CLIENT_BUYER_ROLES = ['Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer']

  app.post('/test-beds/:id/buyer-contacts', async (request, reply) => {
    const { role, contact_id } = request.body ?? {}

    if (!VALID_CLIENT_BUYER_ROLES.includes(role)) {
      return reply.code(400).send({ error: `role must be one of: ${VALID_CLIENT_BUYER_ROLES.join(', ')}` })
    }
    if (!contact_id) {
      return reply.code(400).send({ error: 'contact_id is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: bed } = await db
      .from('records')
      .select('id, account_id')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .maybeSingle()

    if (!bed) return reply.code(404).send({ error: 'test bed not found' })

    const { data: contact } = await db
      .from('records')
      .select('id, parent_record_id')
      .eq('id', contact_id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (!contact) return reply.code(404).send({ error: 'contact not found' })

    // Real rejection, not a soft warning - the Contact must be linked to
    // the exact same Account as this Test Bed. bed.account_id is
    // guaranteed non-null by the database's own CHECK constraint (every
    // live, non-deleted test_bed row has one), so a missing match here
    // means the Contact's own Account link, not the Test Bed's.
    if (!contact.parent_record_id || contact.parent_record_id !== bed.account_id) {
      return reply.code(422).send({
        error: 'Contact is not linked to this Test Bed\'s Account'
      })
    }

    const { error: insertErr } = await db
      .from('record_contacts')
      .insert({ record_id: bed.id, contact_id, role, created_by: request.user.id })

    if (insertErr) {
      request.log.error({ err: insertErr }, 'failed to link buyer contact')
      return reply.code(500).send({ error: insertErr.message })
    }

    await db.from('audit_log').insert({
      record_id: bed.id,
      record_type: 'test_bed',
      action: 'buyer_contact_linked',
      actor_id: request.user.id,
      detail: { role, contact_id }
    })

    return reply.code(201).send({ ok: true, role, contact_id })
  })
}
