import { createUserClient } from '../supabase.js'
import { isValidIsoDate, isValidNumber } from '../lib/field-validation.js'

export default async function opportunitiesRoutes(app) {
  // GET /api/opportunities
  app.get('/opportunities', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: opps, error: oppsErr } = await db
      .from('records')
      .select('*, opportunity_details!opportunity_details_record_id_fkey(*)')
      .eq('record_type', 'opportunity')
      .is('deleted_at', null)
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
        .is('deleted_at', null)
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
    // Reference tab (B1/Milestone 6) - Terminus Lead/Commercial/Technical/
    // Legal Authority stay free text deliberately: the prototype documents
    // these as "Terminus staff, from Contacts", but this app's Contact
    // record type represents client people exclusively, there is no staff/
    // user directory to back a dropdown against - same reasoning Test Bed's
    // own Terminus Owner fields were kept free text in Milestone 3.
    // customerLead/techBuyer/commBuyer/legalBuyer/itBuyer/commAddress are
    // also still free text, out of Milestone 6's scope.
    // 'account' is deliberately NOT in this list (2026-08-15) - it's now a
    // real records.account_id link, same reasoning contacts.js's PATCH
    // excludes account_id: linking is its own business event (search
    // existing/create new), not a plain field edit. See
    // POST /opportunities/:id/link-account.
    'lead', 'commercial', 'technical', 'legal',
    'customerLead', 'techBuyer', 'commBuyer', 'legalBuyer', 'itBuyer', 'commAddress',
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
    // Real bug found and fixed (2026-08-15), same shape and same scan as
    // PATCH /test-beds/:id: these fields had a writable key but zero
    // value validation. Client-side now uses <input type="date">/
    // type="number">, but per this session's own rule against trusting
    // client-only validation, the same rejection is enforced here too.
    for (const key of ['actualClose', 'estGoLive', 'actualGoLive']) {
      if (key in payload && !isValidIsoDate(payload[key])) {
        return reply.code(400).send({ error: `${key} must be a valid date (YYYY-MM-DD)` })
      }
    }
    if ('duration' in payload && !isValidNumber(payload.duration)) {
      return reply.code(400).send({ error: 'duration must be a number' })
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

    // Real bug found and fixed (Milestone 5, 2026-08-15): this fetch's
    // error was never checked. A failed fetch made revRow undefined,
    // which mergedPayload below then silently treated as "no existing
    // payload" - a save would have wiped every other field on the
    // Opportunity down to just whatever this one PATCH submitted, with
    // no error surfaced. Same fix as PATCH /test-beds/:id and
    // PATCH /contacts/:id, checked here too (Milestone 6) since this
    // route shares the identical shape and wasn't in the original scan.
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

  // POST /api/opportunities/:id/link-account
  //
  // Milestone 6: the real Account link for Opportunity, records.account_id
  // (the generic column Milestone 3 added), not record_contacts - checked
  // directly against the prototype before building (Terminus Ops.dc.html:
  // 5687): "The customer account the opportunity belongs to... Editing
  // offers the accounts already on file, or '+ New account' to type a
  // new one" - a real Account picker, not a Contact-dropdown field, same
  // mechanism and same shape as POST /contacts/:id/link-account, just
  // writing account_id instead of parent_record_id (Opportunity has no
  // single-parent relationship with Account the way Contact does).
  app.post('/opportunities/:id/link-account', async (request, reply) => {
    const { account_id, new_account_name } = request.body ?? {}

    if (!account_id && !new_account_name?.trim()) {
      return reply.code(400).send({ error: 'account_id or new_account_name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: opp, error: oppErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'opportunity')
      .is('deleted_at', null)
      .maybeSingle()

    if (oppErr || !opp) {
      return reply.code(404).send({ error: 'not found' })
    }

    let resolvedAccountId = account_id ?? null
    let accountName = null

    if (resolvedAccountId) {
      const { data: existingRev, error: existingRevErr } = await db
        .from('record_revisions')
        .select('payload')
        .eq('record_id', resolvedAccountId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingRevErr) {
        request.log.error({ err: existingRevErr }, 'failed to load existing account name for link-account')
        return reply.code(500).send({ error: existingRevErr.message })
      }
      accountName = existingRev?.payload?.name ?? null
    } else {
      const { data: newAccount, error: accountErr } = await db
        .from('records')
        .insert({ record_type: 'account', status: 'active', owner_id: request.user.id })
        .select()
        .single()

      if (accountErr) {
        request.log.error({ err: accountErr }, 'failed to create account for link-account')
        return reply.code(500).send({ error: accountErr.message })
      }

      accountName = new_account_name.trim()
      const { error: acctRevErr } = await db
        .from('record_revisions')
        .insert({
          record_id: newAccount.id,
          revision_number: 1,
          payload: { name: accountName },
          created_by: request.user.id
        })

      if (acctRevErr) {
        request.log.error({ err: acctRevErr }, 'failed to insert account revision for link-account')
        return reply.code(500).send({ error: acctRevErr.message })
      }

      resolvedAccountId = newAccount.id
    }

    // records_select is team-wide, records_update is still owner-only -
    // a non-owner's update() is filtered by RLS to zero affected rows
    // rather than erroring, so it can't be told apart from success
    // without checking the returned rows directly, same discipline as
    // every other write path in this codebase.
    const { data: updated, error: updateErr } = await db
      .from('records')
      .update({ account_id: resolvedAccountId })
      .eq('id', opp.id)
      .select('id')

    if (updateErr) return reply.code(500).send({ error: updateErr.message })
    if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })

    const { data: revRow, error: revRowErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', opp.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (revRowErr) {
      request.log.error({ err: revRowErr }, 'failed to load current revision before link-account note')
      return reply.code(500).send({ error: revRowErr.message })
    }

    const note = {
      text: `Linked to Account: ${accountName ?? 'Unknown'}.`,
      at: new Date().toISOString(),
      by: request.user.email,
    }
    const mergedPayload = { ...(revRow?.payload ?? {}), notes: [note, ...(revRow?.payload?.notes ?? [])] }
    const nextRevision = (revRow?.revision_number ?? 0) + 1

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: opp.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

    if (revErr) return reply.code(500).send({ error: revErr.message })

    await db.from('audit_log').insert({
      record_id: opp.id,
      record_type: 'opportunity',
      action: 'linked_account',
      actor_id: request.user.id,
      detail: { account_id: resolvedAccountId, account_name: accountName }
    })

    return reply.send({ ok: true, account_id: resolvedAccountId, account_name: accountName })
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
