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
    'isPerUnit', 'installResp', 'lumpSumCost',
    'targetMargin', 'marginOverrides',
    'warrantyPct', 'whtPct', 'gstPct', 'grossUp',
    'duration', 'structure', 'recoveryMonths', 'invoicing', 'milestones',
    'contractorMilestones',
    'factoring',
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
}
