import { createUserClient } from '../supabase.js'
import { issueReferenceNumber } from '../lib/reference-number.js'

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

    return beds.map(b => ({ ...b, payload: latestPayload[b.id] ?? {} }))
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

    return {
      ...bedResult.data,
      payload: revResult.data?.payload ?? {},
      latest_revision_number: revResult.data?.revision_number ?? 1
    }
  })

  // GET /api/test-beds/:id/document-requirements
  // Returns document_status gate requirements relevant to the current stage.
  // For stages with no direct gate rules but a phase set, falls back to the
  // phase-exit gate (last Planning stage → Installation and Commissioning) so
  // that all planning documents are visible from Site Assessment onwards.
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

    const { data: stages } = await db
      .from('stage_definitions')
      .select('stage_name, sort_order, phase')
      .eq('record_type', 'test_bed')
      .is('variant', null)
      .order('sort_order', { ascending: true })

    const stageList = stages ?? []
    const currentIdx = stageList.findIndex(s => s.stage_name === bed.status)
    const nextStage = stageList[currentIdx + 1]?.stage_name

    if (!nextStage) return []

    let { data: rules } = await db
      .from('stage_gate_rules')
      .select('requirement_detail')
      .eq('record_type', 'test_bed')
      .is('variant', null)
      .eq('from_stage', bed.status)
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

    if (!rules?.length) return []

    const { data: docs } = await db
      .from('records')
      .select('id, variant, status')
      .eq('parent_record_id', bed.id)
      .eq('record_type', 'document')
      .is('deleted_at', null)

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

    return rules.map(r => {
      const doc = docMap[r.requirement_detail.document]
      return {
        document: r.requirement_detail.document,
        required_status: r.requirement_detail.status,
        current_status: doc?.status ?? null,
        document_record_id: doc?.id ?? null,
        document_location: doc?.id ? (locationMap[doc.id] ?? null) : null
      }
    })
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

    const { data: existing } = await db
      .from('records')
      .select('id')
      .eq('parent_record_id', bed.id)
      .eq('record_type', 'document')
      .eq('variant', document_type)
      .maybeSingle()

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
  // Creates a new Opportunity from this Test Bed.
  // The Test Bed record is NOT mutated -- it continues its own lifecycle.
  // The new Opportunity records converted_from_test_bed_id and carries the
  // Test Bed's accumulated_cost as test_bed_cost for the eventual Deal Sheet.
  app.post('/test-beds/:id/convert', async (request, reply) => {
    const { opportunity_name } = request.body ?? {}

    if (!opportunity_name?.trim()) {
      return reply.code(400).send({ error: 'opportunity_name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: bed, error: bedErr } = await db
      .from('records')
      .select('id, record_type, status')
      .eq('id', request.params.id)
      .eq('record_type', 'test_bed')
      .maybeSingle()

    if (bedErr || !bed) return reply.code(404).send({ error: 'test bed not found' })

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
        owner_id: request.user.id
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
          company_name: bedPayload.client_organisation ?? ''
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
          test_bed_cost: bedPayload.accumulated_cost ?? null
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
