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
/**
 * THE single definition of what satisfies an approval_obtained rule.
 *
 * Round 7, added after a real defect: 3.1 taught computeBlocking about
 * requirement_detail.scope but left the stage-approvals panel in
 * records.js filtering on revision_number alone. The two then answered the
 * same question by different rules - with Phase 4's stage-scoped
 * Qualification approvals, editing any field left the gate satisfied while
 * the panel showed both tracks un-ticked, which re-enabled the row and let
 * a duplicate approval be recorded per edit (the unique constraint carries
 * revision_number, so a moved revision does not block it).
 *
 * Both call sites now import this. Do not inline the scope check anywhere
 * else - a second implementation is exactly how those two drifted apart.
 *
 * @param approval a row from `approvals` carrying track, decision, stage,
 *   revision_number
 * @param rule a stage_gate_rules row with requirement_type
 *   'approval_obtained'
 * @param ctx.from_stage the stage being exited (the gate's own stage)
 * @param ctx.currentRevision the record's current revision number
 */
export function ruleScope(rule) {
  // Absent scope defaults to 'revision' - the behaviour every rule had
  // before 3.1, and a continuity requirement, not a style choice. Read it
  // through here rather than repeating the ?? default, so the default
  // itself has one home too.
  return rule?.requirement_detail?.scope ?? 'revision'
}

export function approvalSatisfiesRule(approval, rule, { from_stage, currentRevision }) {
  if (!approval || approval.decision !== 'approved') return false
  const track = rule?.requirement_detail?.track
  if (!track || approval.track !== track) return false

  return ruleScope(rule) === 'stage'
    ? approval.stage === from_stage
    : approval.revision_number === currentRevision
}

/**
 * Round 9 Phase 3.1: this now builds a FULL requirement list, each entry
 * carrying `met`, and derives `blocking` from it as
 * `requirements.filter(r => !r.met)`.
 *
 * The business needs a tick list, every criterion for a transition shown
 * with its satisfied state, not only the unsatisfied ones. The obvious
 * way to get that is a second function that lists requirements while this
 * one lists blockers, and that is exactly what rule 4 forbids: one gate
 * computation path, never a second. So satisfied items simply stop being
 * discarded. Every predicate is still evaluated once, in one place.
 *
 * `blocking` is a derived VIEW, not a parallel result. Its entries are
 * byte-identical to what this function returned before (the `met` key is
 * stripped, since every member of `blocking` is unmet by construction),
 * so the mutating transition endpoint's 409 body is unchanged. That is
 * the property the Phase 3 regression test pins.
 */
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

  // One entry per rule, met or unmet. See the note above the function.
  const requirements = []

  for (const rule of rules) {
    if (rule.requirement_type === 'approval_obtained') {
      const track = rule.requirement_detail?.track
      if (!track) continue

      // Round 7: candidates are fetched here and judged by the shared
      // approvalSatisfiesRule above, rather than the scope being encoded
      // into this query's filters. That is deliberate - it is the only way
      // this and the stage-approvals panel in records.js can be guaranteed
      // to agree, and their disagreeing is a real defect that shipped once.
      const scope = ruleScope(rule)

      const { data: candidates, error: approvalErr } = await db
        .from('approvals')
        .select('track, decision, stage, revision_number')
        .eq('record_id', record.id)
        .eq('track', track)
        .eq('decision', 'approved')

      const approval = (candidates ?? []).some(
        a => approvalSatisfiesRule(a, rule, { from_stage, currentRevision }))

      // Round 7 step 3.0: an unchecked error here is indistinguishable
      // from "no approval exists", which this branch would read as
      // "requirement unmet" and block on. Fails closed, but silently and
      // non-deterministically - it is what made the gate suite flake.
      if (approvalErr) return { error: approvalErr }

      requirements.push({
        requirement_type: 'approval_obtained',
        track,
        scope,
        message: scope === 'stage'
          ? `Requires an approved ${track} decision at stage ${from_stage}`
          : `Requires an approved ${track} decision on revision ${currentRevision}`,
        met: approval
      })
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

      requirements.push({
        requirement_type: 'document_status',
        document: docName,
        required_status: reqStatus,
        message: `Requires ${docName} to be ${reqStatus}`,
        met: !!docRecord
      })
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

      // Round 9 Phase 3.2: `label` is additive and ignored by the
      // engine's own matching - this branch reads `field` and nothing
      // else, so an unrecognised key in requirement_detail cannot break
      // it. It is carried through here so the tick list and a rejected
      // transition can both say "Physical Suitability" rather than
      // "exitQualPhysicalSuitability", from one construction rather than
      // two. Rules without a label are unaffected, message included.
      const label = rule.requirement_detail?.label

      requirements.push({
        requirement_type: 'payload_field_required',
        field,
        ...(label ? { label } : {}),
        message: label ? `Requires ${label}` : `Requires ${field} to be set`,
        met: !(value === undefined || value === null || value === '')
      })
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

      requirements.push({
        requirement_type: 'contact_role_linked',
        role,
        message: `Requires a Contact linked as ${role}`,
        met: !!link
      })
    }

    // child_record_status (Round 7 Phase 3.2, 2026-08-18). Until this
    // branch existed the loop simply fell through here, so a
    // child_record_status rule was a silent no-op that never blocked
    // anything - a seeded gate rule that looked configured and did
    // nothing.
    //
    // Matching is on BOTH keys, deliberately, and variant only when the
    // rule supplies one:
    //
    //   {"record_type":"document","variant":"NDA","status":"approved"}
    //
    // A literal child record_type of 'nda' would mean a new record type
    // per document, which breaks the generic model. Matching
    // document+variant only would silently make this a documents-only
    // mechanism, when a future rule may legitimately need a child
    // 'pilot' at status 'complete' with no variant at all. So:
    // record_type always, variant when present, status always.
    //
    // No case folding on variant. The vocabulary is
    // stage_reference_docs.document_name and rules must use it exactly -
    // case-insensitive matching would paper over a data-quality problem
    // rather than surface it.
    if (rule.requirement_type === 'child_record_status') {
      const childType = rule.requirement_detail?.record_type
      const reqStatus = rule.requirement_detail?.status
      if (!childType || !reqStatus) continue

      const variant = rule.requirement_detail?.variant

      let childQuery = db
        .from('records')
        .select('id')
        .eq('parent_record_id', record.id)
        .eq('record_type', childType)
        .eq('status', reqStatus)

      if (variant !== undefined && variant !== null) {
        childQuery = childQuery.eq('variant', variant)
      }

      // limit(1) before maybeSingle(): a rule that omits variant can
      // legitimately match several children (three 'pilot' children, say),
      // and maybeSingle() on its own treats more than one row as an error.
      // Existence is the question here, not uniqueness.
      const { data: child, error: childErr } = await childQuery.limit(1).maybeSingle()

      if (childErr) return { error: childErr }

      requirements.push({
        requirement_type: 'child_record_status',
        child_record_type: childType,
        ...(variant !== undefined && variant !== null ? { variant } : {}),
        required_status: reqStatus,
        message: variant
          ? `Requires ${variant} to be ${reqStatus}`
          : `Requires a ${childType} child at status ${reqStatus}`,
        met: !!child
      })
    }
  }

  // `blocking` keeps its exact pre-Phase-3 shape: the unmet subset, with
  // `met` stripped, since every member of it is unmet by definition.
  // Callers that only ever wanted the blockers are untouched.
  const blocking = requirements
    .filter(r => !r.met)
    .map(({ met, ...rest }) => rest)

  return { requirements, blocking }
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
      .select('stage_name, sort_order')
      .eq('record_type', record.record_type)
      .order('sort_order', { ascending: true })

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

    const orderedStages = stageDefs ?? []
    const validStages = orderedStages.map(s => s.stage_name)
    if (!validStages.includes(to_stage)) {
      return reply.code(400).send({
        error: `${to_stage} is not a valid stage for this record type`
      })
    }

    // ── Stage adjacency (Round 9 Phase 4A.1, 2026-08-19) ──────────────
    //
    // Until now this endpoint checked only that to_stage existed in
    // stage_definitions, and nothing about WHERE it sat. Gate rules are
    // keyed on the (from_stage, to_stage) pair, so a skipped stage did
    // not bypass its gates, it landed on a pair for which no rules exist
    // at all: 51 of test_bed's 56 ordered stage pairs carried no rules,
    // Qualification -> Closed among them. The hole was in the space
    // between the rules, which is why every rule-level check passed
    // while it was open.
    //
    // Adjacency is measured by POSITION IN THE ORDERED LIST, not by
    // sort_order arithmetic. The confirmed rule was written as "exactly
    // +1 on sort_order", and for every record type today that is the
    // same thing, because every stage list is contiguous from 1. It
    // stops being the same thing the moment anyone numbers a list 10,
    // 20, 30, which is a normal way to leave room for insertions, and
    // then +1 arithmetic would refuse every forward transition in that
    // record type. Position is also what GET /records/:id/exit-criteria
    // already uses to decide which stage a record is heading for
    // (stages[currentIdx + 1]), so the endpoint that says what is needed
    // to exit and the endpoint that performs the exit now agree by
    // construction rather than by coincidence.
    const fromIdx = orderedStages.findIndex(s => s.stage_name === from_stage)
    const toIdx = orderedStages.findIndex(s => s.stage_name === to_stage)

    // An unknown CURRENT stage is refused rather than treated as the
    // start of the list. A record whose status is not in its own type's
    // stage list is a data fault, and guessing a direction for it would
    // turn that fault into an unaudited stage change.
    if (fromIdx < 0) {
      return reply.code(400).send({
        error: `record's current stage ${from_stage} is not in the stage list for this record type`
      })
    }

    const isBackward = toIdx < fromIdx
    if (!isBackward && toIdx !== fromIdx + 1) {
      return reply.code(400).send({
        error: `cannot skip stages: ${to_stage} is not the next stage after ${from_stage}`,
        from_stage,
        to_stage,
        next_stage: orderedStages[fromIdx + 1]?.stage_name ?? null
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

    // A backward move is deliberately UNGATED. Gate rules describe what it
    // takes to LEAVE a stage, not what it takes to re-enter one, so
    // evaluating them on a reversal would be asking the wrong question:
    // the (from, to) pair of a reversal is not a configured transition
    // and never will be. A record advanced in error has to be
    // recoverable, and this is the mechanism. It is a real concession,
    // recorded as such in DESIGN_PRINCIPLES.md: whether a reversal should
    // require a reason, an entitlement, or both is a live question and is
    // the same governance question as approval entitlement.
    if (!isBackward) {
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
      // A backward move is marked in the audit trail rather than being
      // indistinguishable from ordinary progress. `action` deliberately
      // stays 'transition' so every existing query over the trail still
      // finds it; the direction is carried in the detail. Ungated is not
      // the same as unrecorded.
      detail: isBackward
        ? { from: from_stage, to: to_stage, revision: currentRevision, direction: 'backward', regression: true, gated: false }
        : { from: from_stage, to: to_stage, revision: currentRevision }
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

      // .maybeSingle() (Round 7, 2026-08-18): without it this query
      // resolves to an ARRAY, so `if (probDefault)` was truthy even for
      // zero rows and `probDefault.default_probability_pct` was always
      // undefined. The update below therefore sent {probability_pct:
      // undefined}, which supabase-js drops on serialisation, so it
      // matched no rows and changed nothing - confirmed live: 0 rows
      // affected, no error, value unchanged. The documented
      // reset-on-stage-change (DESIGN_PRINCIPLES.md Section 2) has never
      // once fired since this mechanism was written.
      //
      // The warn branch below did fire every time, but blamed a
      // "missing opportunity_details row", pointing at the wrong cause
      // entirely - the same misdiagnosis class as the line 192 fix in
      // step 3.0. contacts.js and test-beds.js both call this same table
      // with .maybeSingle() correctly; only this site omitted it.
      const { data: probDefault, error: probDefaultErr } = await probQuery.maybeSingle()

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
