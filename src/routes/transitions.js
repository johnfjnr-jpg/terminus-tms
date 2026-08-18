import { createUserClient } from '../supabase.js'

// Round 5 Phase 5 (2026-08-17): extracted from POST /records/:id/transition
// unchanged, so the new read-only Exit Criteria panel (GET
// /records/:id/exit-criteria, below) can compute the exact same blocking[]
// a real transition attempt would, without ever performing the write
// itself - the brief's own "reuse the existing gate-check logic, don't
// build a second, separate criteria-computation path" instruction, taken
// literally. This is genuinely the one and only gate-checking
// implementation now, not a second path with its own copy of the same
// logic (unlike GET /records/:id/stage-approvals, built earlier for the
// now-being-removed Stage & Approvals tab, which re-derives its own
// plain-language criteria text independently - left untouched here,
// Phase 7 removes its only caller).
export async function computeBlocking(db, record, from_stage, to_stage, currentRevision, revPayload) {
  // Null-variant rules apply to all variants; variant-specific rules apply only to that variant.
  // Use .is('variant', null) directly when there is no variant -- .or() with a single condition
  // can be misinterpreted by PostgREST as a top-level OR, bypassing the other .eq() filters.
  let rulesQuery = db
    .from('stage_gate_rules')
    .select('*')
    .eq('record_type', record.record_type)
    .eq('from_stage', from_stage)
    .eq('to_stage', to_stage)

  rulesQuery = record.variant
    ? rulesQuery.or(`variant.is.null,variant.eq.${record.variant}`)
    : rulesQuery.is('variant', null)

  const { data: rules, error: rulesErr } = await rulesQuery

  if (rulesErr) {
    return { error: rulesErr }
  }

  const blocking = []

  for (const rule of rules) {
    if (rule.requirement_type === 'approval_obtained') {
      const track = rule.requirement_detail?.track
      if (!track) continue

      const { data: approval, error: approvalErr } = await db
        .from('approvals')
        .select('id')
        .eq('record_id', record.id)
        .eq('revision_number', currentRevision)
        .eq('track', track)
        .eq('decision', 'approved')
        .maybeSingle()

      // Round 7 step 3.0: an unchecked error here is indistinguishable
      // from "no approval exists", which this branch would read as
      // "requirement unmet" and block on. Fails closed, but silently and
      // non-deterministically - it is what made the gate suite flake.
      if (approvalErr) return { error: approvalErr }

      if (!approval) {
        blocking.push({
          requirement_type: 'approval_obtained',
          track,
          message: `Requires an approved ${track} decision on revision ${currentRevision}`
        })
      }
    }

    if (rule.requirement_type === 'document_status') {
      const docName = rule.requirement_detail?.document
      const reqStatus = rule.requirement_detail?.status
      if (!docName || !reqStatus) continue

      // Document records are stored as record_type='document' children of the parent record.
      // The document type is held in records.variant; completion status in records.status.
      const { data: docRecord, error: docErr } = await db
        .from('records')
        .select('id')
        .eq('parent_record_id', record.id)
        .eq('record_type', 'document')
        .eq('variant', docName)
        .eq('status', reqStatus)
        .maybeSingle()

      // Round 7 step 3.0: as above - an error would read as "document
      // absent" and block.
      if (docErr) return { error: docErr }

      if (!docRecord) {
        blocking.push({
          requirement_type: 'document_status',
          document: docName,
          required_status: reqStatus,
          message: `Requires ${docName} to be ${reqStatus}`
        })
      }
    }

    // payload_field_required: requirement_detail = {field}. Checks the
    // record's current payload for that key - except two fields that are
    // real columns on records rather than payload keys (parent_record_id,
    // the Account link described as "Company" in the UI, and
    // industry_id), which are read straight off the record row instead.
    // Reads only what's already durably saved - the transition endpoint's
    // request body is still just {to_stage}, nothing here accepts inline
    // data to patch in as part of the transition itself.
    if (rule.requirement_type === 'payload_field_required') {
      const field = rule.requirement_detail?.field
      if (!field) continue

      const RECORD_COLUMN_FIELDS = new Set(['parent_record_id', 'industry_id'])
      const value = RECORD_COLUMN_FIELDS.has(field) ? record[field] : revPayload?.[field]

      if (value === undefined || value === null || value === '') {
        blocking.push({
          requirement_type: 'payload_field_required',
          field,
          message: `Requires ${field} to be set`
        })
      }
    }

    // contact_role_linked: requirement_detail = {role}. Checks that a
    // record_contacts row exists for this record + role - a
    // relationship check, distinct from payload_field_required's
    // presence-of-a-value check. The account-vs-Contact match itself
    // (is this Contact actually linked to the right Account) is
    // enforced once, at save time, by whatever endpoint writes the
    // record_contacts row (POST /test-beds/:id/buyer-contacts) - this
    // gate only checks that a validated link already exists, it does
    // not re-derive or re-validate the Account match itself.
    if (rule.requirement_type === 'contact_role_linked') {
      const role = rule.requirement_detail?.role
      if (!role) continue

      const { data: link, error: linkErr } = await db
        .from('record_contacts')
        .select('id')
        .eq('record_id', record.id)
        .eq('role', role)
        .maybeSingle()

      // Round 7 step 3.0: as above - an error would read as "no contact
      // linked" and block.
      if (linkErr) return { error: linkErr }

      if (!link) {
        blocking.push({
          requirement_type: 'contact_role_linked',
          role,
          message: `Requires a Contact linked as ${role}`
        })
      }
    }

    // child_record_status handled in a future milestone
  }

  return { blocking }
}

export default async function transitionsRoutes(app) {
  // POST /api/records/:id/transition
  // Validates to_stage against stage_definitions, checks all gate rules,
  // then performs the transition and auto-updates probability_pct for opportunities.
  app.post('/records/:id/transition', async (request, reply) => {
    const { to_stage } = request.body ?? {}

    if (!to_stage || typeof to_stage !== 'string') {
      return reply.code(400).send({ error: 'to_stage is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status, variant, parent_record_id, industry_id')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    const from_stage = record.status

    if (from_stage === to_stage) {
      return reply.code(400).send({ error: 'record is already in that stage' })
    }

    // Validate to_stage against stage_definitions for this record type/variant.
    // No stage list for this record type means nothing is a valid
    // destination, not "anything goes" - this used to skip the check
    // entirely when stageDefs came back empty, which meant any record type
    // with no stage_definitions rows (found via Lead, which has none - its
    // own /convert endpoints never call this endpoint, so this was a live
    // but unexercised hole) could have its status set to an arbitrary
    // string with zero validation.
    let stageQuery = db
      .from('stage_definitions')
      .select('stage_name')
      .eq('record_type', record.record_type)

    stageQuery = record.variant
      ? stageQuery.eq('variant', record.variant)
      : stageQuery.is('variant', null)

    const { data: stageDefs, error: stageDefsErr } = await stageQuery

    // Round 7 step 3.0. The fail-closed OUTCOME here was already correct
    // and is deliberately unchanged: on error stageDefs was null,
    // (stageDefs ?? []) gave [], to_stage was absent from it, and the
    // transition was refused - which is also what the documented
    // invariant requires when a record type genuinely has zero
    // stage_definitions rows. The defect was diagnostic. A database
    // fault was reported as "<stage> is not a valid stage for this
    // record type", sending a reader to debug a stage-definition problem
    // that does not exist while the real fault went unreported. The two
    // cases are now distinguishable: a real error is a 500, an empty
    // list is still a 400.
    if (stageDefsErr) {
      request.log.error({ err: stageDefsErr }, 'failed to load stage_definitions for transition validation')
      return reply.code(500).send({ error: stageDefsErr.message })
    }

    const validStages = (stageDefs ?? []).map(s => s.stage_name)
    if (!validStages.includes(to_stage)) {
      return reply.code(400).send({
        error: `${to_stage} is not a valid stage for this record type`
      })
    }

    // Get the current revision (and its payload, for payload_field_required
    // checks below) to check approvals against
    const { data: revRow, error: revRowErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Round 7 step 3.0. This was the ONLY fail-OPEN of the six, and the
    // reason 3.0 runs before 3.1 rather than merely before 3.2. On error
    // revRow was null, so currentRevision silently fell back to 1 and
    // the approvals branch matched revision_number = 1. A stale
    // revision-1 approval then satisfied a gate on a record sitting at a
    // much later revision, and the transition proceeded. Reachable only
    // on approvals-only gates, since revPayload was also undefined and
    // payload_field_required blocks - which is exactly the shape of a
    // commercial sign-off gate. Stage-scoping in 3.1 does NOT remove
    // this: revision-scoped rules keep matching on revision_number, and
    // those are the Deal Sheet and Opportunity commercial approvals.
    if (revRowErr) {
      request.log.error({ err: revRowErr }, 'failed to load current revision before gate evaluation')
      return reply.code(500).send({ error: revRowErr.message })
    }

    const currentRevision = revRow?.revision_number ?? 1

    const { blocking, error: blockingErr } = await computeBlocking(db, record, from_stage, to_stage, currentRevision, revRow?.payload)
    if (blockingErr) {
      request.log.error({ err: blockingErr }, 'failed to fetch stage_gate_rules')
      return reply.code(500).send({ error: blockingErr.message })
    }

    if (blocking.length > 0) {
      return reply.code(422).send({
        error: 'transition blocked by unmet requirements',
        blocking
      })
    }

    // records_select is team-wide, records_update is still owner-only - a
    // non-owner's update() is filtered by RLS to zero affected rows
    // rather than erroring, so updateErr alone can't distinguish a real
    // transition from a silent no-op. Checking the write result itself
    // (not an extra owner-checking SELECT earlier in this handler) is
    // what stops a false success response and a fabricated audit_log
    // entry for a transition that never happened.
    const { data: updated, error: updateErr } = await db
      .from('records')
      .update({ status: to_stage })
      .eq('id', record.id)
      .select('id')

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to update record status')
      return reply.code(500).send({ error: updateErr.message })
    }
    if (!updated?.length) {
      return reply.code(403).send({ error: 'not permitted' })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: record.record_type,
      action: 'transition',
      actor_id: request.user.id,
      detail: { from: from_stage, to: to_stage, revision: currentRevision }
    })

    // Auto-update probability_pct from stage defaults after a successful transition.
    // Opportunities have null variant; the lookup uses IS NULL to match the correct defaults row.
    // Test Beds have no probability concept, so this block is scoped to opportunity only.
    if (record.record_type === 'opportunity') {
      let probQuery = db
        .from('stage_probability_defaults')
        .select('default_probability_pct')
        .eq('record_type', record.record_type)
        .eq('stage', to_stage)

      probQuery = record.variant
        ? probQuery.eq('variant', record.variant)
        : probQuery.is('variant', null)

      const { data: probDefault, error: probDefaultErr } = await probQuery

      // Round 7 step 3.0. Unlike the five above, this sits AFTER the
      // transition has already succeeded, so an error here must not
      // become a 500 on an otherwise-successful response - it is logged,
      // matching how the update below already treats its own failures.
      if (probDefaultErr) {
        request.log.error({ err: probDefaultErr }, 'failed to load stage_probability_defaults after transition')
      }

      if (probDefault) {
        // Reached only after the owner-gated update above genuinely
        // succeeded, so a zero-row result here isn't an authorization
        // failure (the caller IS the owner) - it would mean the
        // opportunity_details row is missing, a data-integrity issue,
        // not a permissions one. The primary transition already
        // succeeded, so this stays a logged warning, not a 403 on an
        // otherwise-successful response - but it's still checked rather
        // than assumed, same discipline as the other five fixes.
        const { data: probUpdated, error: probErr } = await db
          .from('opportunity_details')
          .update({ probability_pct: probDefault.default_probability_pct })
          .eq('record_id', record.id)
          .select('record_id')

        if (probErr) {
          request.log.error({ err: probErr }, 'failed to reset probability_pct after transition')
        } else if (!probUpdated?.length) {
          request.log.warn({ record_id: record.id }, 'probability_pct reset affected no rows - missing opportunity_details row?')
        }
      }
    }

    return { record_id: record.id, from: from_stage, to: to_stage }
  })
}
