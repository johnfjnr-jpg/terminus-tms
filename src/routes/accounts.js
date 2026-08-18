import { createUserClient } from '../supabase.js'
import { issueAccountNumber } from '../lib/reference-number.js'
import { countryToCode } from '../lib/country-code.js'

// Round 4 Phase 3 (2026-08-17): Billing/Shipping Address, same structured
// shape as Contact's own Address panel (CD_ADDRESS_FIELDS,
// contact-detail.js), just prefixed billing.../shipping... - two
// independent copies of the same 6-field shape, not shared state, so
// editing one never touches the other (confirmed by real test, see
// PATCH handler below).
const ADDRESS_SUFFIXES = ['Address', 'Address2', 'City', 'Postcode', 'Country', 'Region']
const BILLING_KEYS = ADDRESS_SUFFIXES.map(s => `billing${s}`)
const SHIPPING_KEYS = ADDRESS_SUFFIXES.map(s => `shipping${s}`)

// Same non-negotiable validation for both creation and later edits - a
// shared helper rather than duplicated inline, so the two call sites
// can't drift apart on what counts as a valid Parent Account.
async function validateParentAccountId(db, accountId, parentAccountId) {
  if (!parentAccountId) return { ok: true }

  if (parentAccountId === accountId) {
    return { error: 'Parent Account cannot be the account itself' }
  }

  const { data: parent, error: parentErr } = await db
    .from('records')
    .select('id, parent_account_id')
    .eq('id', parentAccountId)
    .eq('record_type', 'account')
    .is('deleted_at', null)
    .maybeSingle()

  if (parentErr) return { error: parentErr.message }
  if (!parent) return { error: 'Parent Account must be a real, non-deleted Account' }

  // Direct A<->B guard (Round 4 Phase 1/3): single-level only for this
  // phase, but nothing stops two Accounts being edited independently
  // into a two-record cycle (A's parent set to B, then separately B's
  // parent set to A) unless checked here explicitly - each individual
  // FK reference is valid on its own, the problem only exists as a pair,
  // which is exactly why this can't be a plain CHECK/FK constraint (see
  // the migration's own comment) and has to be a real query at write
  // time instead.
  //
  // Real bug found and fixed, Round 5 Phase 3 (2026-08-17), while
  // building on top of this function, not part of that phase's own
  // brief: at creation (POST /accounts), accountId is null, this
  // account doesn't have an id yet. The check as originally written,
  // `parent.parent_account_id === accountId`, evaluated `null === null`
  // whenever the chosen parent had no parent of its own - the single
  // most common case - incorrectly rejecting every normal Parent Account
  // selection made at creation time with a false "circular reference"
  // error, confirmed live via a direct API call. The `accountId &&`
  // guard below restores the behaviour the original comment already
  // claimed ("harmless, parent_account_id can never equal an id that
  // doesn't exist yet" - true for every other case, just not this
  // null-equality one), skipping the check entirely when there's no real
  // id yet for anything to have circled back to.
  if (accountId && parent.parent_account_id === accountId) {
    return { error: `Parent Account cannot be set to an Account whose own Parent Account is this Account (direct circular reference)` }
  }

  return { ok: true }
}

// Round 4 Phase 3: Account Number, reusing the reference_code column and
// the same TT- generator every Opportunity/Test Bed already draws from
// (issueAccountNumber, 'account' scheme, see
// src/lib/reference-number.js and DESIGN_PRINCIPLES.md Section 9's
// Account Number entry - namespaced so it can never collide with the
// industry-code keyspace). Only Account Name is mandatory at creation
// (per the brief), so a country code may genuinely not exist yet.
// Generates immediately when one is available; otherwise reference_code
// stays null, the same honest "not yet generated" state Opportunity's
// own reference_code used before Milestone 1, not a fabricated
// placeholder. PATCH below generates it lazily the first time a country
// becomes available on a record that doesn't have one yet, and never
// regenerates once issued (immutable, matching every other reference
// code in this system) - confirmed by direct test, see
// DESIGN_PRINCIPLES.md.
//
// Billing Country specifically, not Shipping Country, deliberately: the
// brief gives both fields the identical shape, so this was a build-time
// choice, not something specified. Billing Address is the invoicing/
// legal address of record for the company itself - the closest analogue
// to "what jurisdiction is this Account," matching how Opportunity/Test
// Bed's own reference code ties to the engagement's own country. Shipping
// Address is an operational/delivery detail that can legitimately differ
// from the entity's registered address and doesn't represent the
// Account's own identity the way Billing does.
// No try/catch here, deliberately - a thrown error (a real RPC/DB
// failure, not "no country available yet", that case is already handled
// by returning null before ever calling issueAccountNumber) propagates
// to the caller rather than being silently swallowed, matching this
// project's own established rule against treating "we don't know" as
// equivalent to "no result" (DESIGN_PRINCIPLES.md's unchecked-Supabase-
// error-scan entry). Callers decide what a genuine generation failure
// means for their own request, not this helper.
async function maybeIssueAccountNumber(db, accountName, billingCountry) {
  if (!billingCountry) return null
  const countryCode = countryToCode(billingCountry)
  if (!countryCode) return null
  return issueAccountNumber(db, countryCode, accountName)
}

export default async function accountsRoutes(app) {
  // GET /api/accounts — list, used by Contact's "+ New Account" picker and
  // general account browsing. There is still no user-facing delete-Account
  // action in the app, but deleted_at is a generic column on records (not
  // Contact-specific) and this endpoint must respect it regardless of how
  // a row got soft-deleted - real test/debug Account rows were polluting
  // this exact picker (2026-08-13) precisely because this filter was
  // missing here.
  app.get('/accounts', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: accounts, error } = await db
      .from('records')
      .select('id, created_at, industry_id, reference_code, parent_account_id')
      .eq('record_type', 'account')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list accounts')
      return reply.code(500).send({ error: error.message })
    }
    if (!accounts.length) return []

    const ids = accounts.map(a => a.id)
    const { data: revs } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    return accounts.map(a => ({ ...a, payload: latestPayload[a.id] ?? {} }))
  })

  // POST /api/accounts — the full creation form. Contact's own
  // "+ New Account" inline flow doesn't call this directly, it inserts a
  // bare account itself via POST /contacts/:id/link-account, since it
  // needs the new id back inline as part of linking - see that route for
  // its own, symmetrical field handling (Round 4 Phase 3 extended both
  // the same way, not just one).
  app.post('/accounts', async (request, reply) => {
    const {
      name, address, industry_id, terminus_lead, website_url,
      billing, shipping, parent_account_id,
    } = request.body ?? {}

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }

    const db = createUserClient(request.jwt)

    // Confirmed at creation, not just on later edit - a bad Parent
    // Account shouldn't be possible to set even on the very first save.
    // accountId doesn't exist yet, so the self-reference/A<->B checks
    // below run against a not-yet-real id - harmless, parent_account_id
    // can never equal an id that doesn't exist yet, and the A<->B check
    // only matters once this account itself has an id another account
    // could point back at.
    const parentCheck = parent_account_id
      ? await validateParentAccountId(db, null, parent_account_id)
      : { ok: true }
    if (parentCheck.error) return reply.code(400).send({ error: parentCheck.error })

    const b = billing ?? {}
    const s = shipping ?? {}
    // Same log-and-continue convention as create-opportunity's own
    // issueReferenceNumber call (contacts.js) - a genuine generation
    // failure doesn't block the Account from being created, but it is
    // logged, never silently dropped. The record ends up with an honest
    // "not yet generated" reference_code either way (null, same as when
    // no Billing Country was given at all).
    let reference_code = null
    try {
      reference_code = await maybeIssueAccountNumber(db, name.trim(), b.country ?? null)
    } catch (err) {
      request.log.error({ err }, 'failed to issue Account Number at account creation')
    }

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'account',
        status: 'active',
        owner_id: request.user.id,
        industry_id: industry_id ?? null,
        parent_account_id: parent_account_id ?? null,
        reference_code,
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert account')
      return reply.code(500).send({ error: recordErr.message })
    }

    const payload = {
      name: name.trim(),
      address: address?.trim() ?? null,
      terminusLead: terminus_lead ?? null,
      websiteUrl: website_url ?? null,
      billingAddress: b.address ?? null, billingAddress2: b.address2 ?? null,
      billingCity: b.city ?? null, billingPostcode: b.postcode ?? null,
      billingCountry: b.country ?? null, billingRegion: b.region ?? null,
      shippingAddress: s.address ?? null, shippingAddress2: s.address2 ?? null,
      shippingCity: s.city ?? null, shippingPostcode: s.postcode ?? null,
      shippingCountry: s.country ?? null, shippingRegion: s.region ?? null,
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: 1, payload, created_by: request.user.id })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert account revision')
      return reply.code(500).send({ error: revErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'account',
      action: 'created',
      actor_id: request.user.id,
      detail: { name: name.trim() }
    })

    return reply.code(201).send({ ...record, payload })
  })

  // GET /api/accounts/:id — the account plus its Contact roll-up (every
  // non-deleted Contact whose parent_record_id is this Account). This is
  // the "view all Contacts for a given Account" requirement — a plain
  // parent_record_id filter, no join table needed.
  app.get('/accounts/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: account, error: accountErr } = await db
      .from('records')
      .select('*')
      .eq('id', request.params.id)
      .eq('record_type', 'account')
      .maybeSingle()

    if (accountErr || !account) {
      return reply.code(404).send({ error: 'not found' })
    }

    const { data: rev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', account.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: contacts, error: contactsErr } = await db
      .from('records')
      .select('id, status, created_at')
      .eq('record_type', 'contact')
      .eq('parent_record_id', account.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (contactsErr) {
      request.log.error({ err: contactsErr }, 'failed to load account contact roll-up')
      return reply.code(500).send({ error: contactsErr.message })
    }

    let contactsWithPayload = []
    if (contacts.length) {
      const ids = contacts.map(c => c.id)
      const { data: revs } = await db
        .from('record_revisions')
        .select('record_id, payload')
        .in('record_id', ids)
        .order('revision_number', { ascending: false })

      const latestPayload = {}
      for (const r of revs ?? []) {
        if (!latestPayload[r.record_id]) latestPayload[r.record_id] = r.payload
      }
      contactsWithPayload = contacts.map(c => ({ ...c, payload: latestPayload[c.id] ?? {} }))
    }

    // Parent Account, resolved to a name for display - same shape
    // opp.account/test_bed.account already use for their own read-only
    // linked-record displays.
    let parent = null
    if (account.parent_account_id) {
      const { data: parentRec } = await db.from('records').select('id, deleted_at').eq('id', account.parent_account_id).maybeSingle()
      if (parentRec && !parentRec.deleted_at) {
        const { data: parentRev } = await db
          .from('record_revisions')
          .select('payload')
          .eq('record_id', parentRec.id)
          .order('revision_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        parent = { id: parentRec.id, name: parentRev?.payload?.name ?? null }
      }
    }

    return { ...account, payload: rev?.payload ?? {}, contacts: contactsWithPayload, parent }
  })

  // PATCH /api/accounts/:id
  const ACCOUNT_WRITABLE_KEYS = new Set([
    'name', 'address', // address: legacy free-text field, kept writable for
    // back-compat, never surfaced in the new Account Details panel -
    // superseded by the structured Billing/Shipping Address below, not
    // migrated, existing values (if any) are left exactly as they are.
    'terminusLead', 'websiteUrl',
    ...BILLING_KEYS, ...SHIPPING_KEYS,
  ])

  app.patch('/accounts/:id', async (request, reply) => {
    const { payload, industry_id, parent_account_id } = request.body ?? {}

    if (payload) {
      const disallowed = Object.keys(payload).filter(k => !ACCOUNT_WRITABLE_KEYS.has(k))
      if (disallowed.length) {
        return reply.code(400).send({
          error: 'payload contains fields that cannot be set from this endpoint',
          disallowed
        })
      }
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, reference_code')
      .eq('id', request.params.id)
      .eq('record_type', 'account')
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    if (industry_id !== undefined) {
      // The existence check above only confirms the row is readable, not
      // writable - records_select is team-wide, records_update is still
      // owner-only. A non-owner's update() is filtered by RLS to zero
      // rows rather than erroring (Postgres/PostgREST silently no-ops
      // rather than raising), so absence of updateErr does not mean the
      // write happened - .select() and checking the returned rows is the
      // only way to know. Fix this at the write result itself, not by
      // adding a separate owner-checking SELECT beforehand, which would
      // just recreate the same "SELECT says yes, UPDATE says nothing"
      // gap in reverse.
      const { data: updated, error: updateErr } = await db
        .from('records')
        .update({ industry_id })
        .eq('id', record.id)
        .select('id')
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
      if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
    }

    if (parent_account_id !== undefined) {
      const parentCheck = await validateParentAccountId(db, record.id, parent_account_id)
      if (parentCheck.error) return reply.code(400).send({ error: parentCheck.error })

      const { data: updated, error: updateErr } = await db
        .from('records')
        .update({ parent_account_id })
        .eq('id', record.id)
        .select('id')
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
      if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
    }

    if (payload) {
      // Real bug found and fixed while extending this endpoint
      // (2026-08-17) - same unchecked-error shape already fixed on
      // PATCH /contacts/:id and PATCH /test-beds/:id (DESIGN_PRINCIPLES.md
      // Deferred scope, the "unchecked Supabase query errors" scan), but
      // this route was not one of the 3 files that scan covered. A
      // failed fetch here would have made mergedPayload below silently
      // wipe every other field on the Account down to just this one
      // PATCH's own keys, the identical risk already found and fixed
      // elsewhere.
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

      const mergedPayload = { ...(revRow?.payload ?? {}), ...payload }

      // Lazy Account Number generation (Round 4 Phase 3): only Account
      // Name is mandatory at creation, so an Account created without a
      // Billing Country has no reference_code yet (honest "not yet
      // generated", not fabricated). The first PATCH that supplies one,
      // on a record that still has none, issues it now - matching how
      // the field genuinely becomes available rather than forcing it to
      // exist before there's real data to generate it from.
      let reference_code
      if (!record.reference_code && mergedPayload.billingCountry) {
        try {
          reference_code = await maybeIssueAccountNumber(db, mergedPayload.name ?? '', mergedPayload.billingCountry)
        } catch (err) {
          request.log.error({ err }, 'failed to lazily issue Account Number on PATCH')
        }
      }

      const nextRevision = (revRow?.revision_number ?? 0) + 1
      const { error: revErr } = await db
        .from('record_revisions')
        .insert({ record_id: record.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

      if (revErr) return reply.code(500).send({ error: revErr.message })

      if (reference_code) {
        const { error: refErr } = await db.from('records').update({ reference_code }).eq('id', record.id)
        if (refErr) request.log.error({ err: refErr }, 'failed to save lazily-generated Account Number')
      }
    }

    return reply.send({ ok: true })
  })
}
