import { createUserClient } from '../supabase.js'

export default async function opportunitiesRoutes(app) {
  // GET /api/opportunities
  app.get('/opportunities', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: opps, error: oppsErr } = await db
      .from('records')
      .select('*, opportunity_details!opportunity_details_record_id_fkey(*)')
      .eq('record_type', 'opportunity')
      .order('created_at', { ascending: false })

    if (oppsErr) {
      request.log.error({ err: oppsErr }, 'failed to list opportunities')
      return reply.code(500).send({ error: oppsErr.message })
    }
    if (!opps.length) return []

    const ids = opps.map(o => o.id)
    const { data: revs, error: revErr } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to fetch opportunity revisions')
      return reply.code(500).send({ error: revErr.message })
    }

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    return opps.map(opp => ({ ...opp, payload: latestPayload[opp.id] ?? {} }))
  })

  // GET /api/opportunities/:id
  app.get('/opportunities/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const [oppResult, revResult] = await Promise.all([
      db.from('records')
        .select('*, opportunity_details!opportunity_details_record_id_fkey(*)')
        .eq('id', request.params.id)
        .eq('record_type', 'opportunity')
        .maybeSingle(),
      db.from('record_revisions')
        .select('revision_number, payload, created_at')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (oppResult.error || !oppResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    return {
      ...oppResult.data,
      payload: revResult.data?.payload ?? {},
      latest_revision_number: revResult.data?.revision_number ?? 1
    }
  })

  // PATCH /api/opportunities/:id — save the working payload (e.g. Commercials
  // tab edits) as a new immutable revision. This is the "working copy" save,
  // distinct from POST /api/deals/submit, which is the authoritative commit
  // step that recomputes server-side from whatever was last saved here.
  //
  // Field-level allowlist: only salesperson-controlled inputs (units, margin
  // overrides, installation choice, terms, payment structure, factoring) can
  // be written here. Cost rate fields (ssUnitCost/aqUnitCost/hemirUnitCost,
  // installation and hosting per-unit rates) are rejected outright - the
  // request is a merge onto the previous revision's payload, so anything
  // outside the allowlist (rates included) simply carries forward unchanged
  // rather than being silently dropped or zeroed.
  //
  // STOPGAP, per John (2026-08-11): this is a route-level allowlist, not a
  // real permission model - there is no role/admin distinction enforced
  // anywhere else in the app yet. The real fix is a proper Base Cost Data
  // table (admin-maintained rate catalog, matching the original prototype's
  // Base Costs tab), with Opportunities resolving/snapshotting rates from
  // it rather than holding them as freely-editable payload fields at all.
  // Out of scope for v1, tracked for later.
  const SALESPERSON_WRITABLE_KEYS = new Set([
    'ssExisting', 'ssNew', 'aqm', 'hemir',
    'installResp', 'lumpSumCost',
    'targetMargin', 'marginOverrides',
    'warrantyPct', 'whtPct', 'gstPct', 'grossUp',
    'duration', 'structure', 'recoveryMonths', 'invoicing', 'milestones',
    'contractorMilestones',
    'factoring',
    // Reference tab (B1) - person/account fields are free text, there is no
    // Contacts feature in this app to back a dropdown against (confirmed
    // before building, see project_reference_fields_free_text memory).
    'lead', 'commercial', 'technical', 'legal',
    'account', 'customerLead', 'techBuyer', 'commBuyer', 'legalBuyer', 'itBuyer', 'commAddress',
    'summary', 'oppType',
    'actualClose', 'estGoLive', 'actualGoLive',
    'notes',
  ])

  app.patch('/opportunities/:id', async (request, reply) => {
    const { payload } = request.body ?? {}

    if (!payload || typeof payload !== 'object') {
      return reply.code(400).send({ error: 'payload is required' })
    }

    const disallowedKeys = Object.keys(payload).filter(k => !SALESPERSON_WRITABLE_KEYS.has(k))
    if (disallowedKeys.length) {
      return reply.code(400).send({
        error: 'payload contains fields that cannot be set from this endpoint',
        disallowed: disallowedKeys
      })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'opportunity')
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextRevision = (revRow?.revision_number ?? 0) + 1
    const mergedPayload = { ...(revRow?.payload ?? {}), ...payload }

    const { data: newRevision, error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })
      .select('revision_number, payload')
      .single()

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to save opportunity payload')
      return reply.code(500).send({ error: revErr.message })
    }

    return reply.send({ record_id: record.id, revision_number: newRevision.revision_number, payload: newRevision.payload })
  })

  // POST /api/opportunities/:id/close-date-move
  // Est. Close Date is a real, indexed column on opportunity_details (used by
  // pipeline forecast reporting), not a payload key - so moving it needs its
  // own endpoint rather than the generic PATCH above, which only ever touches
  // record_revisions.payload. A reason is mandatory: this is the one Reference
  // field the extraction spec calls out as needing its own dedicated form
  // (date + reason), not the generic click-to-edit flow.
  app.post('/opportunities/:id/close-date-move', async (request, reply) => {
    const { date, reason } = request.body ?? {}

    if (!date || typeof date !== 'string' || !date.trim()) {
      return reply.code(400).send({ error: 'date is required' })
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return reply.code(400).send({ error: 'reason is required' })
    }

    const db = createUserClient(request.jwt)

    const [oppDetailsResult, revRowResult] = await Promise.all([
      db.from('opportunity_details').select('forecast_close_date').eq('record_id', request.params.id).maybeSingle(),
      db.from('record_revisions')
        .select('revision_number, payload')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!revRowResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    const oldDate = oppDetailsResult.data?.forecast_close_date ?? 'not set'
    if (oldDate === date.trim()) {
      return reply.code(400).send({ error: 'date is unchanged' })
    }

    const payload = revRowResult.data.payload ?? {}
    const closeMoves = (payload.closeMoves ?? 0) + 1
    const note = {
      text: `Est. Close Date moved from ${oldDate} to ${date.trim()}. ${reason.trim()}`,
      at: new Date().toISOString(),
      by: request.user.email,
    }
    const mergedPayload = { ...payload, closeMoves, notes: [note, ...(payload.notes ?? [])] }
    const nextRevision = revRowResult.data.revision_number + 1

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: request.params.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

    if (revErr) {
      // record_revisions_select is team-wide, so the earlier existence
      // check above no longer 404s a non-owner - this insert's own RLS
      // check (record_revisions_insert requires auth.uid() = the
      // record's owner_id) is what actually stops them, and unlike a
      // silent zero-row UPDATE, a rejected INSERT raises a real Postgres
      // error (42501, insufficient_privilege) rather than returning
      // quietly. Surfacing that as 403 rather than 500 keeps this route
      // consistent with the other five - it's still the write's own
      // result driving the response, not an added owner-checking SELECT.
      if (revErr.code === '42501') {
        return reply.code(403).send({ error: 'not permitted' })
      }
      request.log.error({ err: revErr }, 'failed to save close-date-move revision')
      return reply.code(500).send({ error: revErr.message })
    }

    // records_select/record_revisions_select are team-wide, but
    // opportunity_details_update is still owner-only - a non-owner's
    // update() is filtered by RLS to zero affected rows rather than
    // erroring. In practice the record_revisions insert above already
    // fails loudly first for a non-owner (its RLS check requires
    // auth.uid() = owner_id too), but checking this write's own result
    // rather than relying on that ordering is the same fix as the other
    // five routes, and doesn't depend on nothing upstream ever changing.
    const { data: updatedDetails, error: updateErr } = await db
      .from('opportunity_details')
      .update({ forecast_close_date: date.trim() })
      .eq('record_id', request.params.id)
      .select('record_id')

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to update forecast_close_date')
      return reply.code(500).send({ error: updateErr.message })
    }
    if (!updatedDetails?.length) {
      return reply.code(403).send({ error: 'not permitted' })
    }

    await db.from('audit_log').insert({
      record_id: request.params.id,
      record_type: 'opportunity',
      action: 'close_date_moved',
      actor_id: request.user.id,
      detail: { from: oldDate, to: date.trim(), reason: reason.trim() },
    })

    return reply.send({ revision_number: nextRevision, payload: mergedPayload, forecast_close_date: date.trim() })
  })
}
