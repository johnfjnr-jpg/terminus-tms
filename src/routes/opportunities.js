import { createUserClient } from '../supabase.js'
import { isValidIsoDate, isValidNonNegativeInteger, isValidNonNegativePercent, isNotPastIsoDate } from '../lib/field-validation.js'

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

    const opp = oppResult.data

    // Account resolved server-side now (2026-08-16), matching Test
    // Bed's own GET /test-beds/:id exactly - Account became read-only
    // and inherited (no more Link-to-Account UI), so the frontend can no
    // longer rely on accountsCache being populated (that depended on the
    // removed panel's own on-open refresh, or on having visited
    // Contacts/Leads first). Same shape Test Bed returns: { id, name } |
    // null.
    let account = null
    if (opp.account_id) {
      const { data: acctRec } = await db
        .from('records')
        .select('id, deleted_at')
        .eq('id', opp.account_id)
        .maybeSingle()
      if (acctRec && !acctRec.deleted_at) {
        const { data: acctRev } = await db
          .from('record_revisions')
          .select('payload')
          .eq('record_id', acctRec.id)
          .order('revision_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        account = { id: acctRec.id, name: acctRev?.payload?.name ?? null }
      }
    }

    // Buyer Roles resolved server-side (Round 3 Phase 3, 2026-08-17) -
    // same shape and same query pattern as Test Bed's own GET
    // /test-beds/:id buyer_contacts (test-beds.js), now that Technical/
    // Commercial/Legal/IT-Security Buyer are real record_contacts links
    // instead of free text.
    const { data: buyerLinks } = await db
      .from('record_contacts')
      .select('id, contact_id, role, created_at')
      .eq('record_id', opp.id)
      .in('role', VALID_OPPORTUNITY_BUYER_ROLES)

    const links = buyerLinks ?? []
    const buyerContactIds = [...new Set(links.map(l => l.contact_id))]
    let buyerContactNames = {}
    if (buyerContactIds.length) {
      const { data: buyerContactRevs } = await db
        .from('record_revisions')
        .select('record_id, payload')
        .in('record_id', buyerContactIds)
        .order('revision_number', { ascending: false })
      for (const r of buyerContactRevs ?? []) {
        if (!(r.record_id in buyerContactNames)) buyerContactNames[r.record_id] = r.payload?.name ?? null
      }
    }
    const buyer_contacts = links.map(l => ({
      role: l.role,
      contact_id: l.contact_id,
      name: buyerContactNames[l.contact_id] ?? null
    }))

    return {
      ...opp,
      payload: revResult.data?.payload ?? {},
      latest_revision_number: revResult.data?.revision_number ?? 1,
      account,
      buyer_contacts
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
    // Reference tab (B1/Milestone 6). lead/commercial/technical/legal
    // (Terminus Lead/Commercial/Technical/Legal Authority) were free text
    // until 2026-08-16, now a dropdown sourced from terminus_staff -
    // still written through this same PATCH/payload-merge path either
    // way, just constrained to a controlled option list client-side, so
    // they stay in this allowlist unchanged.
    // customerLead/commAddress are still free text, out of Milestone 6's
    // scope. techBuyer/commBuyer/legalBuyer/itBuyer were also free text
    // until Round 3 Phase 3 (2026-08-17), see the note below this
    // allowlist for where they moved to.
    // 'account' is deliberately NOT in this list - it's a real
    // records.account_id link, not a payload field, and as of 2026-08-16
    // it's read-only and inherited from the source Contact at creation
    // (matching Test Bed's own Account field), not writable through any
    // path, this one included.
    'lead', 'commercial', 'technical', 'legal',
    'customerLead', 'commAddress',
    'summary', 'oppType',
    'actualClose', 'estGoLive', 'actualGoLive',
    'notes',
    // name (Round 3 Phase 3, 2026-08-17): the header's Opportunity Name
    // was static text with no save path at all until now, same field
    // Contact detail's own click-to-edit header already treats as a
    // plain payload key.
    'name',
    // bidCurrency/proposalCurrency/fxContingency (Round 3 Phase 6,
    // 2026-08-17): the Structural Terms Currency card, confirmed scope
    // data entry only - never read by loadDealInputsFromOpportunity
    // below or calculateDeal, not wired into any calculation yet.
    'bidCurrency', 'proposalCurrency', 'fxContingency',
    // techBuyer/commBuyer/legalBuyer/itBuyer removed from this allowlist
    // (Round 3 Phase 3) - no longer free text. Replaced by
    // POST /opportunities/:id/buyer-contacts, a real record_contacts
    // link filtered to Contacts already linked to this Opportunity's own
    // Account, same mechanism as Test Bed's existing Client Buyer roles
    // (test-beds.js's buyer-contacts endpoint). Confirmed safe to drop
    // outright rather than migrate: a live query found zero Opportunities
    // (of 3 total) with any of these 4 fields set, so there was no real
    // free-text data to carry forward.
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
    // Past-date restriction (Round 3 Phase 3, 2026-08-17): estGoLive only -
    // actualClose/actualGoLive deliberately excluded, they record things
    // that already happened and must allow the past. Est. Close Date gets
    // the identical restriction below, in close-date-move, since it's a
    // real column, not a payload key, and moves through its own endpoint.
    if ('estGoLive' in payload && !isNotPastIsoDate(payload.estGoLive)) {
      return reply.code(400).send({ error: 'estGoLive cannot be in the past' })
    }
    if ('duration' in payload && !isValidNonNegativeInteger(payload.duration)) {
      return reply.code(400).send({ error: 'duration must be a non-negative whole number' })
    }

    // Round 3 Phase 4 (2026-08-17), corrected twice the same day: every
    // numeric entry field on the Commercials tab was originally forced
    // through isValidNonNegativeInteger, whole-numbers-only. That was
    // right for genuine counts (units, months) but wrong for margins/
    // rates - a real percentage like 12.5% has no business being
    // rejected, and it broke the factoring rate's own 1.5% default
    // outright (first correction). lumpSumCost and the milestone/
    // contractorMilestones usd amounts were left integer-only in that
    // first correction, flagged rather than assumed - real dollar
    // figures need cents too, same as the margin/rate fields need
    // fractional percent, so they're on COMMERCIAL_PERCENT_KEYS/the
    // percent branch below now (second correction, confirmed explicitly
    // requested, not a scope guess). recoveryMonths/factoring.termMonths/
    // milestones[].month are the only real counts left.
    const COMMERCIAL_INTEGER_KEYS = ['ssExisting', 'ssNew', 'aqm', 'hemir', 'recoveryMonths']
    for (const key of COMMERCIAL_INTEGER_KEYS) {
      if (key in payload && !isValidNonNegativeInteger(payload[key])) {
        return reply.code(400).send({ error: `${key} must be a non-negative whole number` })
      }
    }
    const COMMERCIAL_PERCENT_KEYS = ['targetMargin', 'warrantyPct', 'whtPct', 'gstPct', 'lumpSumCost']
    for (const key of COMMERCIAL_PERCENT_KEYS) {
      if (key in payload && !isValidNonNegativePercent(payload[key])) {
        return reply.code(400).send({ error: `${key} must be a non-negative number with at most 2 decimal places` })
      }
    }
    // marginOverrides (Unit Cost/Warranty, Hosting, and Installation
    // "Margin %" columns, all 11 line keys) - every entry is a percentage,
    // none are counts, so unlike the two lists above this object has no
    // integer members to split out.
    if (payload.marginOverrides && typeof payload.marginOverrides === 'object') {
      for (const [key, value] of Object.entries(payload.marginOverrides)) {
        if (!isValidNonNegativePercent(value)) {
          return reply.code(400).send({ error: `marginOverrides.${key} must be a non-negative number with at most 2 decimal places` })
        }
      }
    }
    // milestones/contractorMilestones: month is a real count (integer),
    // usd is a dollar figure (percent validator, i.e. up to 2 decimal
    // places, despite the name - same shared non-negative/precision rule
    // as an actual percentage, just applied to currency here).
    for (const listKey of ['milestones', 'contractorMilestones']) {
      if (!Array.isArray(payload[listKey])) continue
      for (const m of payload[listKey]) {
        if (!isValidNonNegativeInteger(m?.month)) {
          return reply.code(400).send({ error: `${listKey} month must be a non-negative whole number` })
        }
        if (!isValidNonNegativePercent(m?.usd)) {
          return reply.code(400).send({ error: `${listKey} usd must be a non-negative number with at most 2 decimal places` })
        }
      }
    }
    // factoring: ratePct is the one percentage in this object ("Rate %
    // (monthly)"), termMonths is a genuine month count.
    if (payload.factoring && typeof payload.factoring === 'object') {
      if ('ratePct' in payload.factoring && !isValidNonNegativePercent(payload.factoring.ratePct)) {
        return reply.code(400).send({ error: 'factoring.ratePct must be a non-negative number with at most 2 decimal places' })
      }
      if ('termMonths' in payload.factoring && !isValidNonNegativeInteger(payload.factoring.termMonths)) {
        return reply.code(400).send({ error: 'factoring.termMonths must be a non-negative whole number' })
      }
    }
    // Currency (Round 3 Phase 6, 2026-08-17): bidCurrency/proposalCurrency
    // are a real picklist (Terminus Ops.dc.html:5406, currencyOptions),
    // not free text - validated the same way VALID_SOURCES/
    // VALID_SITE_OWNERSHIP are elsewhere in this codebase. fxContingency
    // is a percentage, same isValidNonNegativePercent as every other
    // rate/percentage field.
    const VALID_CURRENCIES = ['USD', 'GBP', 'EUR', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR']
    for (const key of ['bidCurrency', 'proposalCurrency']) {
      if (key in payload && !VALID_CURRENCIES.includes(payload[key])) {
        return reply.code(400).send({ error: `${key} must be one of: ${VALID_CURRENCIES.join(', ')}` })
      }
    }
    if ('fxContingency' in payload && !isValidNonNegativePercent(payload.fxContingency)) {
      return reply.code(400).send({ error: 'fxContingency must be a non-negative number with at most 2 decimal places' })
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

  // POST /api/opportunities/:id/link-account removed entirely
  // (2026-08-16) - Account became read-only and inherited, matching
  // Test Bed's own Account field (no Link-to-Account UI there either).
  // This was its only caller (opportunity-reference.js's
  // performLinkRefAccount, also removed); confirmed via grep before
  // removing that nothing else in the app calls this endpoint. account_id
  // is still set once, at creation, from the source Contact's own linked
  // Account - that path (POST /contacts/:id/create-opportunity) is
  // unrelated and untouched.

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
    // Format + past-date validation, added Round 3 Phase 3 (2026-08-17) -
    // this endpoint previously had neither, confirmed by direct read
    // before this fix (unlike actualClose/estGoLive/actualGoLive on the
    // generic PATCH above, which already had isValidIsoDate). A past
    // "estimate" is nonsensical, same reasoning as estGoLive; unlike
    // Actual Close Date this always represents a forward-looking forecast,
    // never something already past, so this restriction applies
    // unconditionally, not just on a genuine change.
    if (!isValidIsoDate(date)) {
      return reply.code(400).send({ error: 'date must be a valid date (YYYY-MM-DD)' })
    }
    if (!isNotPastIsoDate(date)) {
      return reply.code(400).send({ error: 'date cannot be in the past' })
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

  // POST /api/opportunities/:id/buyer-contacts
  //
  // Round 3 Phase 3 (2026-08-17): Technical/Commercial/Legal/IT-Security
  // Buyer become real record_contacts links, filtered to Contacts already
  // linked to this Opportunity's own Account, direct port of Test Bed's
  // existing POST /test-beds/:id/buyer-contacts (test-beds.js) - same
  // save-time re-validation (a role/contact_id pair the client couldn't
  // even construct from the UI's own filtered dropdown is still rejected
  // here independently), same real 422 on an Account mismatch, not a soft
  // warning. Deliberately its own small allowlist, not a general-purpose
  // "link any contact with any role" action - matches the brief's
  // "confirmed small scope" note, not the full mandatory-core/admin-
  // catalog/escape-valve model DESIGN_PRINCIPLES.md's Deferred scope
  // describes as a separate, not-yet-scoped piece.
  const VALID_OPPORTUNITY_BUYER_ROLES = ['Technical Buyer', 'Commercial Buyer', 'Legal Buyer', 'IT / Security Buyer']

  app.post('/opportunities/:id/buyer-contacts', async (request, reply) => {
    const { role, contact_id } = request.body ?? {}

    if (!VALID_OPPORTUNITY_BUYER_ROLES.includes(role)) {
      return reply.code(400).send({ error: `role must be one of: ${VALID_OPPORTUNITY_BUYER_ROLES.join(', ')}` })
    }
    if (!contact_id) {
      return reply.code(400).send({ error: 'contact_id is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: opp } = await db
      .from('records')
      .select('id, account_id')
      .eq('id', request.params.id)
      .eq('record_type', 'opportunity')
      .is('deleted_at', null)
      .maybeSingle()

    if (!opp) return reply.code(404).send({ error: 'opportunity not found' })

    const { data: contact } = await db
      .from('records')
      .select('id, parent_record_id')
      .eq('id', contact_id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (!contact) return reply.code(404).send({ error: 'contact not found' })

    if (!contact.parent_record_id || contact.parent_record_id !== opp.account_id) {
      return reply.code(422).send({
        error: 'Contact is not linked to this Opportunity\'s Account'
      })
    }

    const { error: insertErr } = await db
      .from('record_contacts')
      .insert({ record_id: opp.id, contact_id, role, created_by: request.user.id })

    if (insertErr) {
      request.log.error({ err: insertErr }, 'failed to link buyer contact')
      return reply.code(500).send({ error: insertErr.message })
    }

    await db.from('audit_log').insert({
      record_id: opp.id,
      record_type: 'opportunity',
      action: 'buyer_contact_linked',
      actor_id: request.user.id,
      detail: { role, contact_id }
    })

    return reply.code(201).send({ ok: true, role, contact_id })
  })
}
