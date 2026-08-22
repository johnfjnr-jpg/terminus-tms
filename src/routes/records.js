import { createUserClient } from '../supabase.js'
import { sendWriteError } from '../lib/write-errors.js'
import { computeBlocking, approvalSatisfiesRule , GATE_RECORD_SELECT } from './transitions.js'

/**
 * Builds the stage-approvals panel's per-track state for one stage.
 *
 * Exported so the agreement test can call the REAL function rather than a
 * copy of it. A test that mirrors this logic would keep passing if this
 * drifted, which is exactly how this panel and computeBlocking came apart
 * in the first place.
 *
 * Judged by the shared approvalSatisfiesRule, the same predicate
 * computeBlocking uses, so the panel and the gate cannot disagree.
 * Deduplicated by track but evaluated against the RULE, since scope lives
 * on the rule and not on the track. Note stageName, not record.status:
 * each row answers "what would it take to exit THIS stage", the same
 * question the gate asks with from_stage.
 */
export function buildStageTracks(stageRules, approvals, stageName, currentRevision) {
  const seen = new Set()
  return (stageRules ?? [])
    .filter(r => r.requirement_type === 'approval_obtained' && r.requirement_detail?.track)
    .filter(r => {
      const t = r.requirement_detail.track
      if (seen.has(t)) return false
      seen.add(t)
      return true
    })
    .map(rule => {
      const decision = (approvals ?? []).find(a =>
        approvalSatisfiesRule(a, rule, { from_stage: stageName, currentRevision }))
      return {
        track: rule.requirement_detail.track,
        approved: !!decision,
        approver_id: decision?.approver_id ?? null,
        decided_at: decision?.decided_at ?? null,
      }
    })
}

export default async function recordsRoutes(app) {
  // POST /api/records — create a record with its initial revision
  // TODO M2: wrap the three inserts (records, record_revisions, audit_log)
  // in a Postgres function called via .rpc() to make creation atomic.
  app.post('/records', async (request, reply) => {
    const { record_type, status = 'draft', payload = {}, parent_record_id } = request.body ?? {}

    if (!record_type || typeof record_type !== 'string' || record_type.trim() === '') {
      return reply.code(400).send({ error: 'record_type is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({ record_type, status, owner_id: request.user.id, parent_record_id: parent_record_id ?? null })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert record')
      return sendWriteError(reply, recordErr)
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: 1, payload, created_by: request.user.id })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert record_revision')
      return sendWriteError(reply, revErr)
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type,
      action: 'created',
      actor_id: request.user.id,
      detail: { initial_status: status }
    })

    return reply.code(201).send(record)
  })

  // GET /api/records — list records visible to the authenticated user
  app.get('/records', async (request, reply) => {
    const { record_type, status } = request.query ?? {}
    const db = createUserClient(request.jwt)

    let query = db.from('records').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (record_type) query = query.eq('record_type', record_type)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      request.log.error({ err: error }, 'failed to list records')
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // GET /api/records/:id — fetch a single record with its latest revision
  app.get('/records/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const [recordResult, revResult] = await Promise.all([
      db.from('records').select('*').eq('id', request.params.id).is('deleted_at', null).maybeSingle(),
      db.from('record_revisions')
        .select('*')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (recordResult.error || !recordResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    return { record: recordResult.data, latest_revision: revResult.data }
  })

  // GET /api/records/:id/stage-approvals
  // Read-only view for the Stage & Approvals tab: every stage in the
  // record's lifecycle (not just the current one), with its dot state,
  // a plain-language exit-criteria list derived from stage_gate_rules
  // (both approval_obtained and document_status requirement rows), and
  // which approval_obtained tracks are already decided on the current
  // revision. This does not decide who may approve - it only shows what's
  // required and what's already true. The actual transition gate (does an
  // approval exist before allowing the stage to advance) already lives in
  // transitions.js; this endpoint is purely for display.
  app.get('/records/:id/stage-approvals', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status, variant')
      .eq('id', request.params.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    let stageQuery = db
      .from('stage_definitions')
      .select('stage_name, sort_order, phase')
      .eq('record_type', record.record_type)
      .order('sort_order', { ascending: true })
    stageQuery = record.variant ? stageQuery.eq('variant', record.variant) : stageQuery.is('variant', null)

    let rulesQuery = db
      .from('stage_gate_rules')
      .select('from_stage, requirement_type, requirement_detail')
      .eq('record_type', record.record_type)
    rulesQuery = record.variant
      ? rulesQuery.or(`variant.is.null,variant.eq.${record.variant}`)
      : rulesQuery.is('variant', null)

    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const currentRevision = revRow?.revision_number ?? 1

    const [stagesResult, rulesResult, approvalsResult] = await Promise.all([
      stageQuery,
      rulesQuery,
      // Round 7: NOT filtered by revision_number here. This panel covers
      // every stage at once, and whether a given approval counts depends on
      // its rule's scope - a stage-scoped rule matches on approvals.stage
      // and ignores the revision entirely. Filtering here would decide that
      // question before the rule is known, which is precisely the bug this
      // replaces: the panel filtered on revision while computeBlocking
      // honoured scope, so after any edit the gate stayed satisfied while
      // the panel showed the tracks un-ticked.
      db.from('approvals')
        .select('track, decision, approver_id, decided_at, stage, revision_number')
        .eq('record_id', record.id)
    ])

    if (stagesResult.error) return reply.code(500).send({ error: stagesResult.error.message })
    if (rulesResult.error) return reply.code(500).send({ error: rulesResult.error.message })
    if (approvalsResult.error) return reply.code(500).send({ error: approvalsResult.error.message })

    const stages = stagesResult.data ?? []
    const rules = rulesResult.data ?? []
    const approvals = approvalsResult.data ?? []
    const currentIdx = stages.findIndex(s => s.stage_name === record.status)

    const result = stages.map((stage, idx) => {
      const state = currentIdx < 0 ? 'upcoming' : (idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'upcoming')
      const stageRules = rules.filter(r => r.from_stage === stage.stage_name)

      // payload_field_required/contact_role_linked (2026-08-15, Milestone
      // 4): added so Test Bed's Qualification gate (3 payload fields + 3
      // buyer-role links, no approval_obtained rows at all) shows real
      // criteria text here instead of "--" - without this, this display
      // endpoint would be nearly empty for the one stage Test Bed
      // actually has gate rules on today. Benefits Opportunity too, for
      // free, if it ever gains a payload_field_required-gated stage.
      const criteria = stageRules.map(r => {
        if (r.requirement_type === 'approval_obtained') {
          return `Requires an approved ${r.requirement_detail?.track} decision`
        }
        if (r.requirement_type === 'document_status') {
          return `Requires ${r.requirement_detail?.document} to be ${r.requirement_detail?.status}`
        }
        if (r.requirement_type === 'payload_field_required') {
          return `Requires ${r.requirement_detail?.field} to be set`
        }
        if (r.requirement_type === 'contact_role_linked') {
          return `Requires a Contact linked as ${r.requirement_detail?.role}`
        }
        return null
      }).filter(Boolean)

      const tracks = buildStageTracks(stageRules, approvals, stage.stage_name, currentRevision)

      return { stage_name: stage.stage_name, sort_order: stage.sort_order, phase: stage.phase, state, criteria, tracks }
    })

    return result
  })

  // GET /api/records/:id/history
  //
  // Round 18 Phase 4. THE ONLY read of audit_log anywhere in this system.
  // Every other reference to that table is an insert, so "reads it once" is
  // structural here rather than a convention to keep: there is one query, in
  // one place, and any second consumer calls this route.
  //
  // READ-ONLY BY CONSTRUCTION. audit_log has no UPDATE or DELETE policy at
  // all, deny-by-default since the initial schema, so there is no write to
  // expose even if something wanted to. This route selects and returns.
  //
  // RAW, DELIBERATELY. `action` and `detail` are returned exactly as stored,
  // and `actor_id` as the uuid it is. Round 18 Phase 4 ships without
  // vocabulary work on purpose: what each action should say to a person is
  // the expensive judgement, and it is better made looking at real entries
  // than guessed at beforehand.
  //
  // Ordered newest first, which is the only display decision taken here and
  // is the same direction notes already use.
  app.get('/records/:id/history', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (recordErr) return reply.code(500).send({ error: recordErr.message })
    if (!record) return reply.code(404).send({ error: 'not found' })

    const { data: entries, error } = await db
      .from('audit_log')
      .select('id, action, actor_id, timestamp, detail')
      .eq('record_id', request.params.id)
      .order('timestamp', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to read record history')
      return reply.code(500).send({ error: error.message })
    }
    return reply.send({ entries: entries ?? [] })
  })

  // GET /api/records/:id/exit-criteria (Round 5 Phase 5, 2026-08-17)
  // Read-only, for the Exit Criteria panel: what's still outstanding to
  // exit a given stage (i.e. the blocking[] a real transition attempt
  // from that stage would return), computed via the exact same
  // computeBlocking() transitions.js itself uses - never performs the
  // transition, this never writes to records.status, purely a read. The
  // brief's own instruction: reuse the existing gate-check logic, don't
  // build a second, separate criteria-computation path (unlike
  // stage-approvals above, which pre-dates this and re-derives its own
  // plain-language criteria text independently - not touched here,
  // Round 5 Phase 7 removed its only caller on the Test Bed side).
  //
  // ?stage= (Round 6 Phase 3, 2026-08-17): optional override for which
  // stage to compute exit criteria FROM - each of Test Bed's 8 stage
  // tabs now shows its own outstanding requirements for that specific
  // stage, not just the record's real current one. Defaults to
  // record.status when omitted, reproducing the exact original
  // behaviour for any caller that doesn't pass it (the same
  // generalization shape GET /test-beds/:id/document-requirements?stage=
  // already established in Round 5 Phase 7). The actual field/approval/
  // document checks inside computeBlocking() still run against the
  // record's real, current payload and revision regardless of which
  // stage was requested - only which stage_gate_rules rows get looked up
  // changes, not what data they're checked against.
  app.get('/records/:id/exit-criteria', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select(GATE_RECORD_SELECT)
      .eq('id', request.params.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    let stageQuery = db
      .from('stage_definitions')
      .select('stage_name, sort_order, is_terminal')
      .eq('record_type', record.record_type)
      .order('sort_order', { ascending: true })
    stageQuery = record.variant ? stageQuery.eq('variant', record.variant) : stageQuery.is('variant', null)

    const { data: stages, error: stagesErr } = await stageQuery
    if (stagesErr) return reply.code(500).send({ error: stagesErr.message })

    const fromStage = request.query.stage || record.status
    const currentIdx = (stages ?? []).findIndex(s => s.stage_name === fromStage)

    // Round 20 Phase 2: a record already in a terminal stage is heading
    // nowhere, so it has no exit criteria.
    //
    // The property that matters here is the stage the record is IN, not
    // the one it would move to. Closed Won sorts last and is the genuine
    // next stage after Negotiating, so it must keep being offered. Closed
    // Lost sorts to position 0, ahead of Qualification, so a lost deal's
    // currentIdx is 0 and stages[currentIdx + 1] is Qualification: without
    // this, the exit-criteria panel on a lost deal would list what is
    // needed to qualify it.
    //
    // is_terminal defaults false, so every stage that predates this column
    // behaves exactly as it did.
    const currentRow = currentIdx >= 0 ? stages[currentIdx] : undefined
    const nextStage = currentIdx >= 0 && !currentRow?.is_terminal
      ? stages[currentIdx + 1]
      : undefined

    if (!nextStage) {
      // Either the requested stage isn't in this record type's own
      // stage list at all (data issue, shouldn't happen given the
      // invariant transitions.js already enforces), or it's genuinely
      // the final stage already - either way, nothing to exit toward,
      // an empty, honest list rather than a fabricated one.
      return { from_stage: fromStage, to_stage: null, blocking: [], requirements: [] }
    }

    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const currentRevision = revRow?.revision_number ?? 1

    const { requirements, blocking, error: blockingErr } = await computeBlocking(db, record, fromStage, nextStage.stage_name, currentRevision, revRow?.payload)
    if (blockingErr) {
      request.log.error({ err: blockingErr }, 'failed to compute exit criteria')
      return reply.code(500).send({ error: blockingErr.message })
    }

    // Round 9 Phase 3.1: `requirements` is every criterion for this
    // transition with its `met` flag, which is what the tick list needs.
    // `blocking` is the unmet subset and is returned UNCHANGED, so the
    // two existing consumers (renderTbStageExitCriteria in
    // test-bed-detail.js and the chevron hover popup in app.js, both of
    // which read only to_stage and blocking[].message) keep working
    // without modification. The change is purely additive.
    return { from_stage: fromStage, to_stage: nextStage.stage_name, blocking, requirements }
  })
}
