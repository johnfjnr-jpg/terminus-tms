import { createUserClient } from '../supabase.js'
import { recordScoreEntry } from '../lib/score-entry.js'
import { sendWriteError, sendRefusal } from '../lib/write-errors.js'
import { appendRecordRevision } from '../lib/record-revision.js'
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
        // Round 34 Phase 5: the account's SHIPPING address travels with the
        // name, and it costs nothing: this handler already reads the account's
        // latest revision payload to get the name.
        //
        // IT IS RETURNED, NEVER COPIED. The proposal address on an Opportunity
        // is a flag saying "this deal uses the account's address", so the panel
        // renders the account's current value rather than a snapshot taken when
        // somebody ticked a box. A copy would go stale the day the account
        // moves and nothing would say so.
        //
        // SHIPPING rather than billing, confirmed with the business: shipping
        // is the delivery address, and the separate-PO-box case is what the
        // override exists for.
        const ap = acctRev?.payload ?? {}
        account = {
          id: acctRec.id,
          name: ap.name ?? null,
          shippingAddress: ap.shippingAddress ?? null,
          shippingAddress2: ap.shippingAddress2 ?? null,
          shippingCity: ap.shippingCity ?? null,
          shippingPostcode: ap.shippingPostcode ?? null,
          shippingCountry: ap.shippingCountry ?? null,
          shippingRegion: ap.shippingRegion ?? null,
        }
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
    // Round 34 Phase 4: region and country, which Test Bed has carried as
    // ordinary payload keys since Milestone 4 and Opportunity has never had.
    // Converging the Terminus Details panel needs them writable here before
    // the panel can offer them; without this the fields would render, accept
    // a value, and be refused by the allowlist on save.
    'region', 'country',
    // Round 34 Phase 5: the proposal address becomes six fields matching the
    // Account, plus the flag that says to use the account's instead.
    //
    // A DELIBERATE EXCEPTION to this round's organising principle, recorded as
    // one rather than left to read as drift. Everything else here converges on
    // Test Bed, and Test Bed's Site Address is ONE line plus a city because a
    // test bed is one deployment at one place. An Opportunity's proposal
    // address is a company's address, so it takes the Account's six-field
    // shape. The business overruled "consistent with Test Bed" on this field
    // and this is their reasoning.
    //
    // commAddress is unchanged and becomes line 1, so the one live record
    // carrying a value keeps it.
    'commAddress2', 'commCity', 'commPostcode', 'commCountry', 'commRegion',
    'commAddressSameAsAccount',
    // Round 20 Phase 5: the exit-criteria fields the new gate rules name.
    // A gate whose field cannot be written is not a gate, it is a wall, so
    // these land in the same change as the rules that require them. There
    // is no UI to tick them yet and that is stated in the phase report:
    // this makes them settable, not visible.
    // Round 26 Phase 2. Written by POST /opportunities/:id/assessment-reviewed
  // rather than by a PATCH, but named here anyway: Round 20 Phase 5 found a
  // gate whose field is not writable is a wall rather than a gate, and leaving
  // it out would make that true again the first time anyone reaches for a
  // PATCH.
  'assessmentReviewed',
  'exitQualBudget', 'exitQualTimeline', 'exitQualCommitment',
    'exitSolTechnicalSolution', 'exitSolBuyersKnown', 'exitSolKeyStakeholders', 'exitSolTermsReviewed',
    'exitPropPricingApproved', 'exitPropContractTerms', 'exitPropImplSchedule', 'exitPropDocumentation',
    'exitEvalClarificationsResponded', 'exitEvalRevisedPricing', 'exitEvalTechnicalClarifications',
    'exitNegScopeAgreed', 'exitNegPricingAgreed', 'exitNegLegalResolved',
    'exitNegCommercialsApproved', 'exitNegContractExecuted',
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

    // ── Round 34 Phase 2: the two date orderings ──────────────────────────
    //
    // A deal cannot go live before it closes. The business set both directions
    // of that one constraint: Actual Go Live cannot precede Actual Close, and
    // Est Go Live cannot precede Est Close. ACTUAL-VERSUS-ESTIMATE PAIRS ARE
    // DELIBERATELY UNCONSTRAINED, because beating a forecast is not an error.
    //
    // The shape is Round 15 Phase 1's on Test Bed, which this mirrors rather
    // than reinvents: guarded on the SUBMITTED keys so a save touching no date
    // is never checked, read from the MERGED values because the violation is
    // reachable from either end, and a record already violating stays saveable
    // for anything else while any edit touching a date must leave the pair
    // valid.
    //
    // THIS READ IS NOT THE ONE ROUND 17A REMOVED, and the difference is what
    // makes it safe. That read built the payload that got WRITTEN, so a failed
    // fetch looked like "no existing payload" and a save wiped every field down
    // to the submitted keys. This one feeds a VALIDATION and nothing else: it
    // is never merged into the write, and its error is checked and refused, so
    // "could not find out" can never be mistaken for "nothing there".
    //
    // It costs one round trip, and only on a save that touches a date.
    const DATE_ORDER_KEYS = ['actualClose', 'actualGoLive', 'estGoLive']
    if (DATE_ORDER_KEYS.some(k => k in payload)) {
      const [revRowResult, detailsResult] = await Promise.all([
        db.from('record_revisions').select('payload')
          .eq('record_id', record.id).order('revision_number', { ascending: false })
          .limit(1).maybeSingle(),
        db.from('opportunity_details').select('forecast_close_date')
          .eq('record_id', record.id).maybeSingle(),
      ])
      if (revRowResult.error) {
        request.log.error({ err: revRowResult.error }, 'failed to load current revision for date ordering')
        return reply.code(500).send({ error: revRowResult.error.message })
      }
      if (detailsResult.error) {
        request.log.error({ err: detailsResult.error }, 'failed to load forecast close date for date ordering')
        return reply.code(500).send({ error: detailsResult.error.message })
      }
      const merged = { ...(revRowResult.data?.payload ?? {}), ...payload }
      // Est. Close Date is not a payload key: it is opportunity_details
      // .forecast_close_date, written through close-date-move. So this rule
      // spans two endpoints, and the other half lives in that handler.
      const estClose = detailsResult.data?.forecast_close_date ?? null

      // THE MESSAGES NAME THE LABELS a user sees, not the payload keys, which
      // is the one thing Round 15's own comment says it fixed here and left
      // unfixed in seven other messages across this file.
      if (merged.actualClose && merged.actualGoLive && merged.actualGoLive < merged.actualClose) {
        return reply.code(400).send({ error: 'Actual Go Live cannot be before Actual Close Date' })
      }
      if (estClose && merged.estGoLive && merged.estGoLive < estClose) {
        return reply.code(400).send({ error: 'Est. Go Live cannot be before Est. Close Date' })
      }
    }

    // Round 17A Phase 1: the read that stood here existed only to build the
    // merge, which now happens inside the write. The response still needs the
    // resulting revision number and merged payload, and the function returns
    // both, so this route's contract is unchanged.
    //
    // WHAT THAT READ WAS PROTECTING, kept because deleting the code must not
    // delete the lesson: a Milestone 5 fix added an explicit error check here
    // because an unchecked one made a failed fetch look like "no existing
    // payload", so a save would silently wipe every other field down to this
    // PATCH's own keys. That failure mode is now structurally unreachable
    // rather than guarded: there is no client-side read left to fail.
    const { data: newRevision, error: revErr } = await appendRecordRevision(
      db, record.id, payload, request.user.id)

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to save opportunity payload')
      return sendWriteError(reply, revErr)
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

    // Round 34 Phase 2: the other end of "Est Go Live cannot precede Est
    // Close". Moving the close date LATER than a stored go-live date is the
    // same violation approached from the other side, and this endpoint is the
    // only way that field moves.
    //
    // THE SAME MESSAGE either way, because it is one constraint. Test Bed
    // states its equivalent once for both directions and a user who reads two
    // different sentences for one rule has to work out that they are the same
    // rule.
    //
    // No extra read: this handler already loads both the forecast date and the
    // latest revision, for the move note and the counter.
    const existingGoLive = (revRowResult.data?.payload ?? {}).estGoLive
    if (existingGoLive && existingGoLive < date) {
      return reply.code(400).send({ error: 'Est. Go Live cannot be before Est. Close Date' })
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
    // Round 17A Phase 1: the read above STAYS, because closeMoves increments
    // and notes prepends, and both need the current values. Only those two
    // keys are sent; everything else is merged server-side from the current
    // payload rather than from this read.
    const { data: newRevision, error: revErr } = await appendRecordRevision(
      db, request.params.id, { closeMoves, notes: [note, ...(payload.notes ?? [])] }, request.user.id)

    if (revErr) {
      // record_revisions_select is team-wide, so the existence check
      // above no longer 404s a non-owner. This insert's own RLS check is
      // what stops them, and sendWriteError turns that into the readable
      // refusal. See src/lib/write-errors.js.
      request.log.error({ err: revErr }, 'failed to save close-date-move revision')
      return sendWriteError(reply, revErr)
    }

    // opportunity_details_update is owner-only, and an UPDATE is not
    // refused loudly: RLS filters the row out, so this succeeds and
    // affects zero rows. The insert above already fails first for a
    // non-owner today, but checking this write's own result does not
    // depend on that ordering holding.
    const { data: updatedDetails, error: updateErr } = await db
      .from('opportunity_details')
      .update({ forecast_close_date: date.trim() })
      .eq('record_id', request.params.id)
      .select('record_id')

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to update forecast_close_date')
      return sendWriteError(reply, updateErr)
    }
    if (!updatedDetails?.length) {
      return sendRefusal(reply)
    }

    await db.from('audit_log').insert({
      record_id: request.params.id,
      record_type: 'opportunity',
      action: 'close_date_moved',
      actor_id: request.user.id,
      detail: { from: oldDate, to: date.trim(), reason: reason.trim() },
    })

    // Round 17A Phase 1: the number and the merged payload now come back from
    // the write itself rather than from figures computed before it, which is
    // the only way the response can describe what was actually stored.
    return reply.send({ revision_number: newRevision.revision_number, payload: newRevision.payload, forecast_close_date: date.trim() })
  })

  // PUT /api/opportunities/:id/probability-override (Round 20 Phase 4)
  //
  // Sets or clears the per-record probability override. Author and
  // timestamp are written SERVER-SIDE from the authenticated session and
  // are never accepted from the client, which is the rule Round 11 settled
  // for score attribution and the same reason applies: an attribution the
  // caller supplies is a claim, not a record.
  //
  // A reason is required to SET and required to CLEAR. Removing a
  // judgement is itself a judgement, and a cleared override silently
  // hands the record back to the stage default, which is exactly the kind
  // of change that is invisible afterwards without a line saying why.
  app.put('/opportunities/:id/probability-override', async (request, reply) => {
    const { probability_pct, reason } = request.body ?? {}

    if (!reason?.trim()) {
      return reply.code(400).send({ error: 'reason is required' })
    }

    const clearing = probability_pct === null
    if (!clearing) {
      if (!Number.isInteger(probability_pct) || probability_pct < 0 || probability_pct > 100) {
        return reply.code(400).send({ error: 'probability_pct must be an integer from 0 to 100, or null to clear' })
      }
    }

    const db = createUserClient(request.jwt)

    const { data: details, error: readErr } = await db
      .from('opportunity_details')
      .select('probability_pct, probability_override_pct')
      .eq('record_id', request.params.id)
      .maybeSingle()

    if (readErr) {
      request.log.error({ err: readErr }, 'failed to read opportunity_details for probability override')
      return reply.code(500).send({ error: readErr.message })
    }
    if (!details) {
      return reply.code(404).send({ error: 'not found' })
    }

    // Clearing hands the record back to whatever its current stage says,
    // computed here rather than left stale. Without this the record would
    // keep displaying the overridden number until its next transition,
    // which is the same class of fault as the override being erased by one.
    let restoredDefault = null
    if (clearing) {
      const { data: record } = await db
        .from('records').select('status, variant').eq('id', request.params.id).maybeSingle()
      if (record) {
        let q = db.from('stage_probability_defaults')
          .select('default_probability_pct')
          .eq('record_type', 'opportunity')
          .eq('stage', record.status)
        q = record.variant ? q.eq('variant', record.variant) : q.is('variant', null)
        const { data: def } = await q.maybeSingle()
        restoredDefault = def?.default_probability_pct ?? null
      }
    }

    const patch = clearing
      ? {
          probability_override_pct: null,
          probability_override_reason: null,
          probability_override_by: null,
          probability_override_at: null,
          ...(restoredDefault !== null ? { probability_pct: restoredDefault } : {}),
        }
      : {
          probability_override_pct: probability_pct,
          probability_override_reason: reason.trim(),
          probability_override_by: request.user.id,
          probability_override_at: new Date().toISOString(),
          probability_pct,
        }

    const { data: updated, error: updateErr } = await db
      .from('opportunity_details')
      .update(patch)
      .eq('record_id', request.params.id)
      .select('record_id')

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to write probability override')
      return sendWriteError(reply, updateErr)
    }
    if (!updated?.length) {
      return sendRefusal(reply)
    }

    await db.from('audit_log').insert({
      record_id: request.params.id,
      record_type: 'opportunity',
      action: clearing ? 'probability_override_cleared' : 'probability_override_set',
      actor_id: request.user.id,
      detail: {
        from: details.probability_override_pct,
        to: clearing ? null : probability_pct,
        previous_probability_pct: details.probability_pct,
        reason: reason.trim(),
      },
    })

    return reply.send({
      probability_override_pct: clearing ? null : probability_pct,
      probability_pct: clearing ? restoredDefault : probability_pct,
    })
  })

  // POST /api/opportunities/:id/close-lost (Round 21 Phase 7)
  //
  // Losing a deal is ONE act, not a transition plus a note. A path that
  // records the status without the reason leaves a lost deal nobody can
  // report on, which is the whole point of the reason list, so both are
  // written by this route and the ordering is chosen so that a failure
  // cannot produce that state.
  //
  // ORDER, and why: the reason, the stage at death and the probability go
  // first, in one UPDATE, and the status change follows. If the status write
  // fails, the record is still in its working stage carrying reason columns,
  // which is visibly odd and recoverable. The reverse ordering would produce
  // a deal marked lost with no reason, which reads as complete and is not.
  //
  // WHAT THIS DOES NOT DUPLICATE. Closed Lost carries zero gate rules,
  // asserted rather than assumed at Round 20 Phase 5 and again here, so
  // there is no gate evaluation to bypass. It is reached through
  // reachable_from_any_stage, so there is no adjacency to satisfy either.
  // What this route repeats from the transition endpoint is the status
  // write, the revision and the audit row, and nothing that decides whether
  // the move is allowed.
  // POST /api/opportunities/:id/assessment-reviewed
  //
  // Round 26 Phase 2. Appends {at, by, stage} to an append-only series.
  //
  // NOT the generic exit-criteria tick, which PATCHes a single ISO timestamp.
  // A timestamp cannot satisfy min_length, and more importantly one timestamp
  // cannot say WHICH stages have been reviewed: the four rules each name their
  // own stage through entry_stage_at_or_after, so the record has to carry one
  // entry per stage reviewed.
  //
  // APPEND ONLY, with no clear. Every other tick toggles, and this one cannot:
  // "I read the assessment at Solution Alignment" is an event, and un-saying
  // it is not a thing a person does. The same reasoning makes score entries
  // append-only.
  //
  // The stage is the RECORD'S OWN, read server-side, never taken from the
  // client. A client-supplied stage would let a review be attributed to a
  // stage the record was never in, which is the one thing the currency clause
  // exists to prevent.
  app.post('/opportunities/:id/assessment-reviewed', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recErr } = await db
      .from('records')
      .select('id, status')
      .eq('id', request.params.id)
      .eq('record_type', 'opportunity')
      .is('deleted_at', null)
      .maybeSingle()
    if (recErr) return reply.code(500).send({ error: recErr.message })
    if (!record) return reply.code(404).send({ error: 'opportunity not found' })

    const { data: revRow, error: revReadErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (revReadErr) return reply.code(500).send({ error: revReadErr.message })
    if (!revRow) return reply.code(404).send({ error: 'opportunity has no revision' })

    const existing = Array.isArray(revRow.payload?.assessmentReviewed) ? revRow.payload.assessmentReviewed : []

    // Reviewing the same stage twice is a no-op rather than a second entry.
    // The gate asks whether this stage has been reviewed, not how often, and a
    // second row would be noise in a history a person reads.
    if (existing.some(e => e?.stage === record.status)) {
      return reply.code(200).send({ entries: existing.length, alreadyReviewed: true, stage: record.status })
    }

    const entry = { at: new Date().toISOString(), by: request.user.email, stage: record.status }
    const { error: revErr } = await appendRecordRevision(
      db, record.id, { assessmentReviewed: [...existing, entry] }, request.user.id)
    if (revErr) {
      request.log.error({ err: revErr }, 'failed to record assessment review')
      return sendWriteError(reply, revErr)
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'opportunity',
      action: 'assessment_reviewed',
      actor_id: request.user.id,
      detail: { stage: entry.stage },
    })

    return reply.code(201).send({ entry, entries: existing.length + 1 })
  })

  // POST /api/opportunities/:id/scores
  //
  // Round 25 Phase 3. The second caller of the shared score handler, and the
  // first Opportunity-side scoring code of any kind.
  //
  // This route and POST /test-beds/:id/scores are the SAME CODE with two
  // arguments. Rounds 21 and 22 found five separate cases of Test Bed-specific
  // code that silently did nothing for Opportunity, one live in production
  // since Round 9; a copied route would have been a sixth, agreeing on the day
  // it was written and drifting afterwards.
  app.post('/opportunities/:id/scores', async (request, reply) => {
    const result = await recordScoreEntry({
      db: createUserClient(request.jwt),
      recordType: 'opportunity',
      recordId: request.params.id,
      body: request.body,
      user: request.user,
      messages: { notFound: 'opportunity not found', noRevision: 'opportunity has no revision' },
      logError: (err, msg) => request.log.error({ err }, msg),
    })
    return reply.code(result.status).send(result.body)
  })

  app.post('/opportunities/:id/close-lost', async (request, reply) => {
    const { reason_id, note } = request.body ?? {}

    // Enforced here AND by a database CHECK. A route-level check is correct
    // for every caller that exists and silent for the next one, which this
    // project has recorded five times.
    if (!reason_id) {
      return reply.code(400).send({ error: 'reason_id is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: reason, error: reasonErr } = await db
      .from('closed_lost_reasons')
      .select('id, label, active')
      .eq('id', reason_id)
      .maybeSingle()

    if (reasonErr) {
      request.log.error({ err: reasonErr }, 'failed to read closed lost reason')
      return reply.code(500).send({ error: reasonErr.message })
    }
    if (!reason || !reason.active) {
      return reply.code(400).send({ error: 'reason_id is not a current Closed Lost reason' })
    }

    const { data: record, error: recErr } = await db
      .from('records')
      .select('id, status, record_type, deleted_at')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recErr) {
      request.log.error({ err: recErr }, 'failed to read record for close-lost')
      return reply.code(500).send({ error: recErr.message })
    }
    if (!record || record.deleted_at || record.record_type !== 'opportunity') {
      return reply.code(404).send({ error: 'not found' })
    }

    // A terminal stage cannot be left, and that includes being lost from
    // one. transitions.js refuses this for the generic path; refusing it
    // here keeps the two paths agreeing rather than leaving this one open.
    const { data: stageRow } = await db
      .from('stage_definitions')
      .select('is_terminal')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage_name', record.status)
      .maybeSingle()

    if (stageRow?.is_terminal) {
      return reply.code(400).send({ error: `${record.status} is a terminal stage and cannot be left` })
    }

    const lostAt = new Date().toISOString()

    // The configured default for Closed Lost, read rather than hardcoded.
    const { data: probDefault } = await db
      .from('stage_probability_defaults')
      .select('default_probability_pct')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage', 'Closed Lost')
      .maybeSingle()

    // The override is CLEARED here, and this is a deliberate exception to
    // Round 20's rule that an override survives a stage change. That rule
    // exists because a judgement does not expire when the stage moves. A
    // lost deal is the one case where it does: the judgement was about a
    // deal that might close, and it did not. Leaving a 63 percent override
    // on a lost deal would put a number in the pipeline that is not merely
    // stale but false.
    const { data: updatedDetails, error: detErr } = await db
      .from('opportunity_details')
      .update({
        closed_lost_reason_id: reason.id,
        closed_lost_from_stage: record.status,
        closed_lost_note: note?.trim() ? note.trim() : null,
        closed_lost_at: lostAt,
        probability_pct: probDefault?.default_probability_pct ?? 0,
        probability_override_pct: null,
        probability_override_reason: null,
        probability_override_by: null,
        probability_override_at: null,
      })
      .eq('record_id', request.params.id)
      .select('record_id')

    if (detErr) {
      request.log.error({ err: detErr }, 'failed to record the loss')
      return sendWriteError(reply, detErr)
    }
    if (!updatedDetails?.length) {
      return sendRefusal(reply)
    }

    const { data: updatedRecord, error: statusErr } = await db
      .from('records')
      .update({ status: 'Closed Lost' })
      .eq('id', request.params.id)
      .select('id')

    if (statusErr) {
      request.log.error({ err: statusErr }, 'failed to set Closed Lost after recording the loss')
      return sendWriteError(reply, statusErr)
    }
    if (!updatedRecord?.length) {
      return sendRefusal(reply)
    }

    await db.from('audit_log').insert({
      record_id: request.params.id,
      record_type: 'opportunity',
      action: 'closed_lost',
      actor_id: request.user.id,
      detail: {
        from: record.status,
        to: 'Closed Lost',
        reason: reason.label,
        reason_id: reason.id,
        ...(note?.trim() ? { note: note.trim() } : {}),
      },
    })

    return reply.send({
      record_id: request.params.id,
      from: record.status,
      to: 'Closed Lost',
      reason: reason.label,
      probability_pct: probDefault?.default_probability_pct ?? 0,
    })
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
      return sendWriteError(reply, insertErr)
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
