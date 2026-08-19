import { createUserClient } from '../supabase.js'
import { issueReferenceNumber } from '../lib/reference-number.js'
import { isValidIsoDate, isNotPastIsoDate, isValidNonNegativeInteger, isValidNonNegativePercent, isValidIsoTimestamp } from '../lib/field-validation.js'
import { calculateTestBedCost } from '../lib/deal-calculator.js'

// Round 5 Phase 6 (2026-08-17): builds the itemized cost breakdown from
// whatever's currently in a Test Bed's payload - the one place this
// mapping happens, called from both GET (live display) and PATCH
// (persisting accumulated_cost/indicativeCost so the two existing
// consumers that read those stored fields directly, the Test Beds list
// view and Test Bed -> Opportunity conversion, never see a stale number
// regardless of which tab last saved a relevant field).
// Exported (Round 7 Phase 8) so the warranty backfill recomputes stored
// totals through the REAL function rather than a copy of it. A backfill
// that reimplements the cost mapping can disagree with the route that
// maintains it, which is the same drift the approvals scope fix removed.
export function buildTestBedCostBreakdown(payload) {
  const num = (v) => Number(v) || 0
  return calculateTestBedCost({
    ssUnitCost: num(payload.ssUnitCost), ssUnits: num(payload.safesightCameras),
    aqUnitCost: num(payload.aqUnitCost), aqUnits: num(payload.airQualitySensors),
    hemirUnitCost: num(payload.hemirUnitCost), hemirUnits: num(payload.hemirSensors),
    // Round 7 Phase 8: a Test Bed is Terminus-funded R&D with no customer
    // warranty commitment, so warranty is neutralised BY DATA - 0 passed
    // explicitly - not by a code path that diverges from Opportunity's.
    // calculateTestBedCost still calls calculateHardwareAndWarranty exactly
    // as before, so the two record types keep running through identical
    // arithmetic and cannot drift apart later.
    //
    // The conditional it replaces read `... : 2`, and the default mattered:
    // no live Test Bed has ever STORED a warrantyPct, so every one of them
    // was computing with a 2% warranty via that fallback. An explicit 0 is
    // required - deal-calculator's own parameter default is also 2 and
    // applies whenever the key is absent, so omitting it would have changed
    // nothing at all.
    warrantyPct: 0,
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

// Round 10 Phase 3.2 (2026-08-19). Same hardcoded-array convention as
// VALID_SITE_OWNERSHIP above and VALID_SOURCES in contacts.js - no
// picklist-admin table exists for any field yet, and the business has
// confirmed these move to an Admin-configured list later, so a table
// built now would be a second home for the same decision.
export const VALID_INSTALLATION_ENVIRONMENT = ['Indoor', 'Outdoor', 'Both']

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

    // Round 11 Phase 5: resolve the Installer Account's name the same way the
    // client Account's is resolved just above, rather than making the browser
    // fetch it. client_installed is COMPUTED, never stored: it is simply
    // whether the two Account links are the same, which is the whole reason
    // Installer is a link rather than a picklist.
    let installer = null
    if (bed.installer_account_id) {
      const { data: instRev } = await db
        .from('record_revisions').select('payload')
        .eq('record_id', bed.installer_account_id)
        .order('revision_number', { ascending: false }).limit(1).maybeSingle()
      installer = {
        id: bed.installer_account_id,
        name: instRev?.payload?.name ?? null,
        client_installed: bed.installer_account_id === bed.account_id,
      }
    }

    return {
      ...bed,
      payload,
      latest_revision_number: revResult.data?.revision_number ?? 1,
      industry: industryResult.data ? { id: industryResult.data.id, name: industryResult.data.name } : null,
      account,
      installer,
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
  // Round 9 Phase 3.2: the judgement criteria that gate a stage exit.
  //
  // These are ordinary payload_field_required rules, not a new
  // requirement type - no branch is added to transitions.js and the whole
  // checklist stays configurable as data for the eventual Admin module.
  // The rule rows carry an additive `label` the engine ignores.
  //
  // Naming: `exit` + the abbreviated stage the criterion gates the exit
  // FROM, so a key names its own gate. exitQual* gate Qualification to
  // Pre-Site Assessment; exitMon* gate Monitoring and Analysis to Review
  // and Completion. The rows themselves are written in Phases 4 and 5;
  // the keys are fixed HERE, once, because each one is written in three
  // places (this allowlist, the gate rule's requirement_detail.field, and
  // the tick control) and renaming one afterwards is three edits with no
  // constraint aligning them.
  //
  // THE STORED VALUE IS AN ISO TIMESTAMP, NEVER A BOOLEAN, and untick
  // DELETES the key. payload_field_required blocks only on undefined,
  // null and '', so a stored `false` reads as present and would satisfy
  // the gate with the box visibly unticked. See isValidIsoTimestamp.
  const TB_EXIT_CRITERION_KEYS = new Set([
    // Qualification -> Pre-Site Assessment
    'exitQualTechnicalCommercialValue',   // Technical and Commercial Value
    // exitQualDataAndUseCase RETIRED, Round 11 Phase 1 (2026-08-19). It
    // asked two questions at once and the framework now asks them
    // separately, so the criterion ceases to exist rather than being
    // renamed: it becomes Clear Use Case Requirements and Metrics and Data
    // Rights, both scored rather than ticked, both landing in Phase 4.
    // Its gate rule was deleted in the same change - removing the key here
    // while the labelled rule survived would have made the row computed
    // rather than tickable, so it would still block with nothing in the
    // product able to satisfy it. All three live Qualification records hold
    // zero ticks, so that sequencing would have blocked every one of them.
    //
    // Removing it here also removes it from TEST_BED_WRITABLE_KEYS below,
    // which is built by spreading this set, so a PATCH naming it is now
    // rejected. That is intended: four live Closed records still hold the
    // key in their payloads as history, and nothing should write to it.
    'exitQualPhysicalSuitability',        // Physical Suitability
    'exitQualPartnerCommitment',          // Partner Commitment
    // Monitoring and Analysis -> Review and Completion
    'exitMonAllMeetingActionsCompleted',  // All Meeting Actions Completed
  ])

  const TEST_BED_WRITABLE_KEYS = new Set([
    ...TB_EXIT_CRITERION_KEYS,
    'name', 'client_organisation', 'notes', 'summary',
    'terminusLead', 'commercialAuthority', 'technicalAuthority', 'region', 'country',
    'siteOwnership', 'installationEnvironment', 'siteAddress', 'city',
    'safesightCameras', 'airQualitySensors', 'hemirSensors', 'estCostPerUnit',
    'testBedDuration', 'estimatedInstallationDate', 'estGoLiveDate',
    // 'installer' and 'techTeam' REMOVED, Round 11 Phase 5: both are real
    // links now (installer_account_id, and a record_contacts row), written
    // by their own endpoints with their own validation. A PATCH naming
    // either is rejected rather than writing a free-text value that nothing
    // reads. Six soft-deleted probe records still hold the old payload keys
    // as history, now unread, same as the warrantyPct precedent.
    'installNotes',
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
    // warrantyPct removed (Round 7 Phase 8): with no input and a hardcoded
    // 0, leaving it writable would let a direct PATCH set a non-zero value
    // that silently changes a Test Bed's cost with nothing on screen to
    // explain it. Same treatment accumulated_cost/indicativeCost already
    // received below.  A PATCH naming it is now rejected outright by the
    // disallowed-keys check, like any other unrecognised field.
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

    // Round 7 Phase 2 (2026-08-18): see contacts.js for the full note.
    // A body this endpoint cannot act on is now a 400, not a silent
    // 200 {ok:true} with no write.
    if (payload !== undefined && (payload === null || typeof payload !== 'object' || Array.isArray(payload))) {
      return reply.code(400).send({ error: 'payload must be an object' })
    }
    if (payload === undefined && industry_id === undefined) {
      return reply.code(400).send({ error: 'request body must contain payload or industry_id' })
    }

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
      // Round 10 Phase 1: `name` became user-editable this round. It has
      // been a writable key since Milestone 4, but nothing in the product
      // could reach it, so it never needed a guard. Now that a click-to-
      // edit control exists, clearing the field and saving would leave a
      // record with no name at all, and the header, both list views and
      // the linked-records modal all render it. Rejected server-side
      // rather than only in the browser, per the standing rule against
      // trusting client-only validation for anything persisted.
      if ('name' in payload && (typeof payload.name !== 'string' || !payload.name.trim())) {
        return reply.code(400).send({ error: 'name cannot be blank' })
      }
      // Round 10 Phase 3.2. Guarded on the key being PRESENT IN THE
      // SUBMITTED PAYLOAD, exactly like siteOwnership above, not on the
      // merged result. That distinction is load-bearing: three
      // soft-deleted records still hold legacy free-text values
      // ("Indoor and Outdoor", "Roadside verge - real save"), and
      // validating the merged payload would make every unrelated save on
      // such a record fail for a field the user never touched - the same
      // shape as the NOT VALID constraint that once edit-locked a batch of
      // Test Beds, including for soft-delete. An empty string is allowed
      // through so a value can still be cleared back to unset.
      if ('installationEnvironment' in payload && payload.installationEnvironment
          && !VALID_INSTALLATION_ENVIRONMENT.includes(payload.installationEnvironment)) {
        return reply.code(400).send({ error: `installationEnvironment must be one of: ${VALID_INSTALLATION_ENVIRONMENT.join(', ')}` })
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
      // Round 9 Phase 3.2: an exit criterion is ticked by storing an ISO
      // timestamp and unticked by sending null, which DELETES the key at
      // the merge below. Everything else is refused here, so no client
      // can write a boolean, a 0 or an empty string into a key the gate
      // reads as present-and-non-empty.
      for (const key of TB_EXIT_CRITERION_KEYS) {
        if (!(key in payload)) continue
        if (payload[key] === null) continue
        if (!isValidIsoTimestamp(payload[key])) {
          return reply.code(400).send({
            error: `${key} must be an ISO timestamp string to tick, or null to clear it`
          })
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
      // Round 7 Phase 2.2 (2026-08-18): sensor counts and estCostPerUnit.
      // These were writable but validated NOWHERE, at either layer - the
      // gap was carried in the brief as "server-side rejection was never
      // confirmed", and the answer turned out to be that it did not exist
      // at all. It matters more than the Duration report that prompted the
      // look: all three counts multiply directly into the install and
      // hosting line items in buildTestBedCostBreakdown(), so a negative
      // count produced a negative cost line and a silently wrong total on
      // the figure a go/no-go decision rests on.
      //
      // Counts reuse isValidNonNegativeInteger, the same validator
      // testBedDuration already uses - a physical count of devices has the
      // identical shape to a duration in months: never negative, never
      // fractional.
      for (const key of ['safesightCameras', 'airQualitySensors', 'hemirSensors']) {
        if (key in payload && !isValidNonNegativeInteger(payload[key])) {
          return reply.code(400).send({ error: `${key} must be a non-negative whole number` })
        }
      }
      // estCostPerUnit is a money rate, not a count, so it takes the same
      // non-negative-up-to-2dp shape as the Base Cost Data rates below.
      // Note it currently has NO rendered input (Round 6 Phase 3 trimmed
      // Site Details to 4 fields and it was not among them), so this
      // server check is the only layer it can have - see the client-side
      // note in test-bed-detail.js.
      if ('estCostPerUnit' in payload && !isValidNonNegativePercent(payload.estCostPerUnit)) {
        return reply.code(400).send({ error: 'estCostPerUnit must be a non-negative number, up to 2 decimal places' })
      }
      // Round 5 Phase 6: Base Cost Data rate fields and warrantyPct -
      // isValidNonNegativePercent is misleadingly named for this use (it's
      // really just "non-negative, up to 2 decimal places"), but that's
      // exactly the right shape for a dollar rate too, not just a
      // percentage, and reusing it avoids a near-duplicate validator.
      // warrantyPct dropped from this loop (Round 7 Phase 8) - it is no
      // longer a writable key, so validating it would be unreachable code.
      for (const key of ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'ssInstallCost', 'aqInstallCost', 'hemirInstallCost', 'ssHostingCost', 'aqHostingCost', 'hemirHostingCost']) {
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

      // Round 9 Phase 3.2: untick REMOVES the key rather than storing an
      // empty value. Deliberately scoped to the criterion keys alone: a
      // null on any other field keeps meaning exactly what it meant
      // before, so this cannot change the behaviour of anything else on
      // the record.
      for (const key of TB_EXIT_CRITERION_KEYS) {
        if (key in payload && payload[key] === null) delete mergedPayload[key]
      }

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

  // GET /api/test-beds/:id/lifecycle-documents
  //
  // Round 10 Phase 7 (2026-08-19). Every document produced across the whole
  // lifecycle, grouped by stage in lifecycle order, for the Closed tab.
  //
  // ONE call, not eight. The obvious alternative was to call the existing
  // per-stage document-requirements endpoint once per stage, which is eight
  // round trips to build one read-only panel and would have made the Closed
  // tab the slowest screen in the app.
  //
  // READ-ONLY BY CONSTRUCTION, not by the frontend choosing not to render a
  // button. It returns no gate rule, no required_status and nothing a
  // Confirm control could act on - a closed Test Bed's documents are the
  // record, and altering them after closure undermines the audit trail. The
  // backward transition path built in Round 9 Phase 4A is the way to change
  // something, and it records the move as a regression.
  //
  // The catalogue is stage_reference_docs, which is what makes the grouping
  // authoritative: it is the table that says which document belongs to which
  // stage. A document child record whose variant matches no catalogue entry
  // is still returned, under its own heading, rather than silently dropped -
  // the same union-not-intersection reasoning the stage panel already uses,
  // because the two tables hold names as independent free strings.
  app.get('/test-beds/:id/lifecycle-documents', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: bed, error: bedErr } = await db
      .from('records')
      .select('id, record_type, status')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .maybeSingle()
    if (bedErr) return reply.code(500).send({ error: bedErr.message })
    if (!bed) return reply.code(404).send({ error: 'not found' })

    const { data: stages, error: stagesErr } = await db
      .from('stage_definitions')
      .select('stage_name, sort_order')
      .eq('record_type', 'test_bed')
      .order('sort_order')
    if (stagesErr) return reply.code(500).send({ error: stagesErr.message })

    const { data: catalogue, error: catErr } = await db
      .from('stage_reference_docs')
      .select('stage_name, document_name')
      .eq('record_type', 'test_bed')
    if (catErr) return reply.code(500).send({ error: catErr.message })

    const { data: children, error: kidsErr } = await db
      .from('records')
      .select('id, variant, status, created_at')
      .eq('parent_record_id', bed.id)
      .eq('record_type', 'document')
      .is('deleted_at', null)
    if (kidsErr) return reply.code(500).send({ error: kidsErr.message })

    const locations = {}
    const ids = (children ?? []).map(c => c.id)
    if (ids.length) {
      const { data: details, error: detErr } = await db
        .from('document_details')
        .select('record_id, document_location')
        .in('record_id', ids)
      if (detErr) return reply.code(500).send({ error: detErr.message })
      for (const d of details ?? []) locations[d.record_id] = d.document_location
    }

    const childByName = {}
    for (const c of children ?? []) childByName[c.variant] = c

    const groups = []
    const claimed = new Set()
    for (const st of stages ?? []) {
      const names = (catalogue ?? []).filter(c => c.stage_name === st.stage_name).map(c => c.document_name)
      if (!names.length) continue
      groups.push({
        stage: st.stage_name,
        sort_order: st.sort_order,
        documents: names.map(name => {
          const child = childByName[name]
          if (child) claimed.add(child.variant)
          return {
            document: name,
            // null, not a fabricated status: a document never produced is a
            // real state and the panel has to be able to say so.
            status: child?.status ?? null,
            document_location: child ? (locations[child.id] ?? null) : null,
            produced: !!child,
          }
        })
      })
    }

    // Anything the record actually holds that the catalogue does not name.
    const orphans = (children ?? []).filter(c => !claimed.has(c.variant))
    if (orphans.length) {
      groups.push({
        stage: 'Not in the stage catalogue',
        sort_order: 9999,
        documents: orphans.map(c => ({
          document: c.variant,
          status: c.status,
          document_location: locations[c.id] ?? null,
          produced: true,
        }))
      })
    }

    const total = groups.reduce((n, g) => n + g.documents.length, 0)
    const produced = groups.reduce((n, g) => n + g.documents.filter(d => d.produced).length, 0)
    return reply.send({ record_status: bed.status, total, produced, groups })
  })

  // POST /api/test-beds/:id/complete-document
  // Marks a planning document as approved (status always set to "approved").
  // Optionally stores a Google Drive URL in document_details.
  app.post('/test-beds/:id/complete-document', async (request, reply) => {
    // Round 9 Phase 6.1: `approve` added, DEFAULTING TO TRUE so every
    // pre-existing caller behaves exactly as it did.
    //
    // The brief expected the URL half of the merged Terminus Documents
    // panel to be "wiring rather than new mechanism", since this endpoint
    // already stored a Drive URL. Checked directly before building, and
    // it is not: `status` was a hardcoded, unconditional 'approved', so
    // saving a URL through this endpoint APPROVED the document as a side
    // effect. That makes the panel's stated purpose impossible - the URL
    // points at the WORKING COPY, which an operator sets while the
    // document is still being written and long before anyone confirms it,
    // and satisfying a gate by pasting a link is precisely the failure
    // this gate exists to prevent.
    //
    // approve === false means: record or keep the document child and set
    // its location, without touching its status. A document that does not
    // exist yet is created at 'draft', not 'approved'.
    const { document_type, document_location, approve } = request.body ?? {}
    const shouldApprove = approve !== false
    const status = shouldApprove ? 'approved' : 'draft'

    if (!document_type?.trim()) return reply.code(400).send({ error: 'document_type is required' })
    if (approve !== undefined && typeof approve !== 'boolean') {
      return reply.code(400).send({ error: 'approve must be a boolean' })
    }

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
      if (shouldApprove) {
        const { data: updated, error: updateErr } = await db
          .from('records')
          .update({ status })
          .eq('id', existing.id)
          .select('id')
        if (updateErr) return reply.code(500).send({ error: updateErr.message })
        if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
      }
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
      // Round 9 Phase 6.1: this upsert's error was never checked, so a
      // failed save returned 200 and the operator saw their URL sitting
      // in the input while nothing had been stored. Same shape as the
      // unchecked-error class already recorded in DESIGN_PRINCIPLES.md,
      // and it matters more now that the URL is an editable field rather
      // than an occasional argument.
      const { error: locErr } = await db.from('document_details').upsert(
        { record_id: docId, document_location: document_location || null },
        { onConflict: 'record_id' }
      )
      if (locErr) {
        request.log.error({ err: locErr }, 'failed to store document location')
        return reply.code(500).send({ error: locErr.message })
      }
    }

    await db.from('audit_log').insert({
      record_id: bed.id,
      record_type: 'test_bed',
      action: shouldApprove ? 'document_approved' : 'document_location_set',
      actor_id: request.user.id,
      detail: shouldApprove
        ? { document_type, status }
        : { document_type, document_location: document_location ?? null }
    })

    // The stored status is reported, not the requested one: with
    // approve:false on a document that is ALREADY approved, nothing is
    // changed and 'draft' would be a lie.
    const { data: finalDoc } = await db.from('records').select('status').eq('id', docId).maybeSingle()

    return reply.code(existing ? 200 : 201).send({
      id: docId, document_type, status: finalDoc?.status ?? status
    })
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

  // Appends one entry to an append-only payload series and writes the
  // revision. Extracted so the measurability confirmation writes through the
  // SAME path a score does rather than through a second convention that
  // agrees today and drifts later - the shape is Phase 2's general one, and
  // two writers of one shape is not a fork of the mechanism.
  //
  // Returns { error } with a status, or { ok: true }.
  async function appendPayloadSeriesEntry(db, recordId, key, entry, actorId) {
    const { data: revRow, error: revReadErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', recordId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    // An unchecked error here would read as "no existing series", which is
    // materially different: it would make a revision look like a first entry.
    if (revReadErr) return { status: 500, error: revReadErr.message }
    if (!revRow) return { status: 404, error: 'test bed has no revision' }

    const payload = revRow.payload ?? {}
    const existing = Array.isArray(payload[key]) ? payload[key] : []
    const merged = { ...payload, [key]: [...existing, entry] }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: recordId, revision_number: revRow.revision_number + 1, payload: merged, created_by: actorId })
    if (revErr) {
      if (revErr.code === '42501') return { status: 403, error: 'not permitted' }
      return { status: 500, error: revErr.message }
    }
    return { ok: true, entries: existing.length + 1, existingCount: existing.length }
  }

  // POST /api/test-beds/:id/measurability
  //
  // Round 11 Phase 4.3, 2026-08-19. A plain yes or no, deliberately NOT
  // folded into the 1 to 5: can the proposed sensors capture what would be
  // measured? Either they can or they cannot, and a 3 is not a meaningful
  // answer, which is why it is not scored.
  //
  // Recorded WITH AN AUTHOR, because it is a technical judgement and it is
  // currently the only technical judgement recorded anywhere before
  // commitment. Entitlement stays out of scope, consistent with everything
  // else in this system: this proves who confirmed it, not that they were
  // entitled to confirm it. The author is written here rather than accepted
  // from the client, for the same reason a score's is.
  app.post('/test-beds/:id/measurability', async (request, reply) => {
    const { confirmed, comment } = request.body ?? {}
    if (typeof confirmed !== 'boolean') {
      return reply.code(400).send({ error: 'confirmed must be true or false' })
    }
    const db = createUserClient(request.jwt)

    const { data: record, error: recErr } = await db
      .from('records').select('id, status')
      .eq('id', request.params.id).eq('record_type', 'test_bed').is('deleted_at', null).maybeSingle()
    if (recErr) return reply.code(500).send({ error: recErr.message })
    if (!record) return reply.code(404).send({ error: 'test bed not found' })

    const entry = {
      at: new Date().toISOString(),
      by: request.user.email,
      value: confirmed,
      stage: record.status,
    }
    if (String(comment ?? '').trim()) entry.comment = String(comment).trim()

    const result = await appendPayloadSeriesEntry(db, record.id, 'measurabilityConfirmed', entry, request.user.id)
    if (!result.ok) return reply.code(result.status).send({ error: result.error })

    await db.from('audit_log').insert({
      record_id: record.id, record_type: 'test_bed',
      action: 'measurability_confirmed', actor_id: request.user.id,
      detail: { value: confirmed, stage: entry.stage },
    })
    return reply.code(201).send({ entry, entries: result.entries })
  })

  // POST /api/test-beds/:id/scores
  //
  // Round 11 Phase 2, 2026-08-19. Appends ONE entry to a criterion's
  // append-only series. Every score is a new entry; nothing is ever
  // overwritten.
  //
  // WHY THIS IS NOT PATCH /test-beds/:id, which is the obvious reuse and is
  // wrong. A PATCH takes the whole value for a key, so a client would send
  // the entire array - and could therefore forge `by`, back-date `at`, claim
  // any `anchorVersion`, drop earlier entries or rewrite them. That defeats
  // append-only entirely, and append-only is the whole point: a 3
  // overwritten by a 1 when someone finally visits the site and finds no
  // power at the mounting positions is the single most valuable data point
  // this framework will produce. The criterion keys are deliberately absent
  // from TEST_BED_WRITABLE_KEYS so this endpoint is the only way in.
  //
  // THE ENTRY SHAPE IS DELIBERATELY GENERAL, NOT SCORING-SPECIFIC, because
  // Round 12 surfaces a field-change trail and criterion authorship and must
  // not fork what this builds:
  //
  //   { at, by, value, comment, reason, anchorVersion }
  //
  // `at` and `by` are the SAME KEY NAMES the notes pattern already uses
  // ({text, at, by}), so anything that renders one can render the other.
  // `value` rather than `score` is what makes it general: Round 12's field
  // change records a new value in exactly the same slot, and "what it was
  // before" is the previous entry's value rather than a second field.
  // `anchorVersion` is simply ABSENT on a series that has no anchors, which
  // is how this codebase already reads optional payload keys - no `meta` bag,
  // because a wrapper invented for a consumer that does not exist yet is
  // structure without evidence.
  //
  // AUTHOR, TIMESTAMP AND ANCHOR VERSION ARE ALL WRITTEN HERE, never taken
  // from the client. The author is a deliberate departure from the notes
  // pattern, which sets `by` client-side from the session: a note records
  // that somebody said something, a score records a judgement somebody is
  // answerable for, and it gates a transition. Approvals get
  // `with check (auth.uid() = approver_id)` from RLS; a payload key has no
  // equivalent, because record_revisions RLS constrains who writes a
  // revision, not what a JSON field inside it claims. `at` follows for the
  // same reason - a client clock is not evidence - and `anchorVersion` must
  // be resolved server-side or a client could stamp a score with a version
  // whose wording it was never made against, which is the one thing the
  // versioning exists to prevent.
  app.post('/test-beds/:id/scores', async (request, reply) => {
    const { criterion, score, comment, reason } = request.body ?? {}
    const db = createUserClient(request.jwt)

    // The criterion must be real. scoring_criteria is the vocabulary, so an
    // unrecognised key cannot create a series under a name nothing defines.
    const { data: crit, error: critErr } = await db
      .from('scoring_criteria')
      .select('id, criterion_key, name')
      .eq('record_type', 'test_bed')
      .eq('criterion_key', criterion ?? '')
      .maybeSingle()
    if (critErr) {
      request.log.error({ err: critErr }, 'failed to look up scoring criterion')
      return reply.code(500).send({ error: critErr.message })
    }
    if (!crit) return reply.code(400).send({ error: 'criterion is not a recognised scoring criterion' })

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return reply.code(400).send({ error: 'score must be a whole number from 1 to 5' })
    }

    const { data: record, error: recErr } = await db
      .from('records')
      .select('id, status')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .is('deleted_at', null)
      .maybeSingle()
    if (recErr) return reply.code(500).send({ error: recErr.message })
    if (!record) return reply.code(404).send({ error: 'test bed not found' })

    const { data: revRow, error: revReadErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    // Round 7 step 3.0's lesson applied here rather than rediscovered: an
    // unchecked error would read as "no existing series", which would make
    // a revision look like a first score and skip the mandatory reason.
    if (revReadErr) return reply.code(500).send({ error: revReadErr.message })
    if (!revRow) return reply.code(404).send({ error: 'test bed has no revision' })

    const payload = revRow.payload ?? {}
    const existing = Array.isArray(payload[crit.criterion_key]) ? payload[crit.criterion_key] : []

    // Mandatory at 1 or 2, naming what is missing. A low score is the one
    // that has to be actionable; without it the framework records an opinion
    // nobody can act on.
    if (score <= 2 && !String(comment ?? '').trim()) {
      return reply.code(400).send({ error: 'a comment is required at a score of 1 or 2, naming what is missing' })
    }

    // Mandatory on any entry after the first. Phase 3 makes this an
    // interrupting dialogue fired on a detected change; the rule itself is
    // enforced here so it holds for any caller, not only that one.
    if (existing.length > 0 && !String(reason ?? '').trim()) {
      return reply.code(400).send({ error: 'a reason for the change is required when revising a score' })
    }

    // Resolved here, never accepted from the client. max(version) is the
    // current anchor set, computed rather than stored.
    const { data: latestAnchor, error: anchorErr } = await db
      .from('scoring_anchors')
      .select('version')
      .eq('criterion_id', crit.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (anchorErr) return reply.code(500).send({ error: anchorErr.message })
    if (!latestAnchor) {
      return reply.code(409).send({ error: `no anchors are defined for ${crit.name}, so a score cannot be recorded against a definition` })
    }

    const entry = {
      at: new Date().toISOString(),
      by: request.user.email,
      value: score,
      anchorVersion: latestAnchor.version,
      stage: record.status,
    }
    if (String(comment ?? '').trim()) entry.comment = String(comment).trim()
    if (String(reason ?? '').trim()) entry.reason = String(reason).trim()

    // APPENDED, oldest first. Notes prepend; this appends, and the two
    // disagree on purpose - "the first entry" is what decides whether a
    // reason is mandatory, and series[0] meaning the first is worth more
    // than matching an unrelated array's direction. Every reader sorts on
    // `at` regardless, per the Round 10 Phase 2 fix, so neither order is
    // load-bearing at render time.
    const mergedPayload = { ...payload, [crit.criterion_key]: [...existing, entry] }
    const nextRevision = revRow.revision_number + 1

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })
    if (revErr) {
      if (revErr.code === '42501') return reply.code(403).send({ error: 'not permitted' })
      request.log.error({ err: revErr }, 'failed to save score revision')
      return reply.code(500).send({ error: revErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'test_bed',
      action: existing.length ? 'score_revised' : 'score_recorded',
      actor_id: request.user.id,
      detail: { criterion: crit.criterion_key, value: score, anchorVersion: entry.anchorVersion, stage: entry.stage }
    })

    return reply.code(201).send({ criterion: crit.criterion_key, entry, entries: existing.length + 1 })
  })

  // PATCH /api/test-beds/:id/installer
  //
  // Round 11 Phase 5, 2026-08-19. Sets or clears the Installer Account.
  //
  // ITS OWN PATH, NOT buyer-contacts. That endpoint refuses any Contact whose
  // parent_record_id differs from the Test Bed's account_id, with a 422, and
  // that check is exactly what makes the three contact_role_linked gates on
  // transition 1 mean anything - a Client Buyer who is not of the client's
  // Account is not a client buyer. Loosening it to accommodate this phase
  // would have weakened three live gates to add one feature. So Phase 5
  // builds its own path and leaves that check untouched.
  app.patch('/test-beds/:id/installer', async (request, reply) => {
    const { installer_account_id } = request.body ?? {}
    const db = createUserClient(request.jwt)

    const { data: bed, error: bedErr } = await db
      .from('records').select('id, account_id, installer_account_id')
      .eq('id', request.params.id).eq('record_type', 'test_bed').is('deleted_at', null).maybeSingle()
    if (bedErr) return reply.code(500).send({ error: bedErr.message })
    if (!bed) return reply.code(404).send({ error: 'test bed not found' })

    if (installer_account_id) {
      const { data: acct, error: acctErr } = await db
        .from('records').select('id')
        .eq('id', installer_account_id).eq('record_type', 'account').is('deleted_at', null).maybeSingle()
      if (acctErr) return reply.code(500).send({ error: acctErr.message })
      if (!acct) return reply.code(422).send({ error: 'Installer must be a real, non-deleted Account' })
    }

    // CHANGING THE INSTALLER INVALIDATES A TECH TEAM FROM THE OLD ACCOUNT,
    // and this is handled explicitly rather than left to be discovered.
    // Keeping the link would leave the contact_role_linked gate satisfied by
    // a Contact of an Account with nothing to do with the installation, which
    // is precisely the integrity the buyer-contacts 422 exists to protect.
    // The link is removed and the removal is REPORTED in the response rather
    // than done silently, so the UI can say what happened.
    let clearedTechTeam = null
    const changing = String(bed.installer_account_id ?? '') !== String(installer_account_id ?? '')
    if (changing) {
      const { data: link, error: linkErr } = await db
        .from('record_contacts').select('id, contact_id')
        .eq('record_id', bed.id).eq('role', 'Test Bed Tech Team').maybeSingle()
      if (linkErr) return reply.code(500).send({ error: linkErr.message })
      if (link) {
        const { data: contact, error: cErr } = await db
          .from('records').select('id, parent_record_id').eq('id', link.contact_id).maybeSingle()
        if (cErr) return reply.code(500).send({ error: cErr.message })
        const stillValid = installer_account_id && contact?.parent_record_id === installer_account_id
        if (!stillValid) {
          // .select() and check the ROWS, not just the error. record_contacts
          // had no DELETE policy at all until this phase added one, so an
          // RLS-filtered delete returns zero rows and NO error - and the
          // first version of this endpoint reported cleared_tech_team on the
          // strength of that null error while the link was still there.
          const { data: deleted, error: delErr } = await db
            .from('record_contacts').delete().eq('id', link.id).select('id')
          if (delErr) return reply.code(500).send({ error: delErr.message })
          if (!deleted?.length) return reply.code(403).send({ error: 'not permitted to clear the existing Test Bed Tech Team' })
          clearedTechTeam = link.contact_id
        }
      }
    }

    // records_update is owner-only under RLS, so a non-owner's update is
    // filtered to zero rows rather than erroring. Checking the returned rows
    // is what tells the two apart.
    const { data: updated, error: updErr } = await db
      .from('records').update({ installer_account_id: installer_account_id ?? null })
      .eq('id', bed.id).select('id, installer_account_id')
    if (updErr) return reply.code(500).send({ error: updErr.message })
    if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })

    await db.from('audit_log').insert({
      record_id: bed.id, record_type: 'test_bed', action: 'installer_set',
      actor_id: request.user.id,
      detail: { installer_account_id: installer_account_id ?? null, cleared_tech_team: clearedTechTeam },
    })

    return reply.send({
      installer_account_id: updated[0].installer_account_id,
      client_installed: !!updated[0].installer_account_id && updated[0].installer_account_id === bed.account_id,
      cleared_tech_team: clearedTechTeam,
    })
  })

  // POST /api/test-beds/:id/tech-team
  //
  // Round 11 Phase 5. A single Contact from the INSTALLER's Account, which is
  // the variation the buyer-contacts endpoint cannot express: it validates
  // against the Test Bed's own account_id and returns 422 otherwise.
  //
  // The same STRUCTURE is reused rather than forked - a record_contacts row
  // with a role, validated at save time, gated by contact_role_linked, which
  // only checks that a validated link exists and never re-derives the Account
  // match. What differs is which Account it validates against, and that is
  // one line rather than a new mechanism.
  app.post('/test-beds/:id/tech-team', async (request, reply) => {
    const { contact_id } = request.body ?? {}
    const db = createUserClient(request.jwt)

    const { data: bed, error: bedErr } = await db
      .from('records').select('id, installer_account_id')
      .eq('id', request.params.id).eq('record_type', 'test_bed').is('deleted_at', null).maybeSingle()
    if (bedErr) return reply.code(500).send({ error: bedErr.message })
    if (!bed) return reply.code(404).send({ error: 'test bed not found' })

    // A Tech Team without an Installer has no Account to be validated
    // against, so the order is enforced rather than left to produce a
    // confusing downstream failure.
    if (!bed.installer_account_id) {
      return reply.code(422).send({ error: 'Set the Installer before choosing a Test Bed Tech Team' })
    }
    if (!contact_id) return reply.code(400).send({ error: 'contact_id is required' })

    const { data: contact, error: cErr } = await db
      .from('records').select('id, parent_record_id')
      .eq('id', contact_id).eq('record_type', 'contact').is('deleted_at', null).maybeSingle()
    if (cErr) return reply.code(500).send({ error: cErr.message })
    if (!contact) return reply.code(404).send({ error: 'contact not found' })

    if (contact.parent_record_id !== bed.installer_account_id) {
      return reply.code(422).send({ error: "Contact is not linked to the Installer's Account" })
    }

    // One Tech Team, so an existing link is REPLACED rather than added to,
    // and the replacement is verified. Without checking the affected rows a
    // filtered delete leaves the old link in place and the insert then
    // creates a SECOND row for the same (record_id, role) - which the
    // contact_role_linked gate reads with .maybeSingle(), so a duplicate
    // turns a working gate into a 500 rather than into a wrong answer.
    const { data: existingLinks, error: exErr } = await db.from('record_contacts')
      .select('id').eq('record_id', bed.id).eq('role', 'Test Bed Tech Team')
    if (exErr) return reply.code(500).send({ error: exErr.message })
    if (existingLinks.length) {
      const { data: deleted, error: delErr } = await db.from('record_contacts')
        .delete().eq('record_id', bed.id).eq('role', 'Test Bed Tech Team').select('id')
      if (delErr) return reply.code(500).send({ error: delErr.message })
      if (deleted.length !== existingLinks.length) {
        return reply.code(403).send({ error: 'not permitted to replace the existing Test Bed Tech Team' })
      }
    }

    const { error: insErr } = await db.from('record_contacts')
      .insert({ record_id: bed.id, contact_id, role: 'Test Bed Tech Team', created_by: request.user.id })
    if (insErr) return reply.code(500).send({ error: insErr.message })

    await db.from('audit_log').insert({
      record_id: bed.id, record_type: 'test_bed', action: 'tech_team_linked',
      actor_id: request.user.id, detail: { contact_id },
    })
    return reply.code(201).send({ contact_id })
  })

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
