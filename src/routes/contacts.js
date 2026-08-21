import { createUserClient } from '../supabase.js'
import { sendWriteError, sendRefusal } from '../lib/write-errors.js'
import { appendRecordRevision } from '../lib/record-revision.js'
import { isValidMobile } from '../lib/field-validation.js'
import { issueReferenceNumber, issueAccountNumber } from '../lib/reference-number.js'
import { countryToCode } from '../lib/country-code.js'

const VALID_SOURCES = ['Web', 'Email Inquiry', 'Referral', 'Direct Outreach', 'Marketing Campaign']

export default async function contactsRoutes(app) {
  // GET /api/contacts — excludes soft-deleted rows.
  // ?account_id= added Round 11 Phase 5, 2026-08-19. A NEW CAPABILITY, not an
  // existing parameter: this endpoint took no query parameters at all and
  // returned every non-deleted contact, which every caller then filtered
  // client-side. Phase 5 needs Contacts of the INSTALLER's Account, which is
  // a different Account from the record's own, so the filter has to be
  // expressed rather than assumed from context.
  //
  // Also the first half of the recorded open item that this endpoint fetches
  // every contact and filters in the browser, which is a scaling problem
  // rather than a fixed cost. Existing callers are untouched and still get
  // the full list, so this is a strict superset of the previous behaviour.
  app.get('/contacts', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const accountId = request.query?.account_id

    let query = db
      .from('records')
      .select('*')
      .eq('record_type', 'contact')
      .is('deleted_at', null)
    if (accountId) query = query.eq('parent_record_id', accountId)

    const { data: contacts, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list contacts')
      return reply.code(500).send({ error: error.message })
    }
    if (!contacts.length) return []

    const ids = contacts.map(c => c.id)
    const { data: revs } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    // Linked Test Beds/Opportunities (2026-08-15, Contacts list count
    // feature). Matched on (record_id, contact_id) only, any role - a
    // Contact gets linked at creation with role 'commercial buyer'
    // (lowercase, linkContact() above), separately from the later buyer-
    // assignment UI's capitalized VALID_CLIENT_BUYER_ROLES
    // ('Client Commercial Buyer' etc., src/routes/test-beds.js) - filtering
    // by role string would silently miss whichever set wasn't checked.
    // records!record_contacts_record_id_fkey is explicit, not inferred:
    // record_contacts has two FKs to records (record_id AND contact_id),
    // an unqualified embed is genuinely ambiguous to PostgREST, the same
    // shape as the real bug found and fixed on opportunity_details in
    // Milestone 5 - confirmed this exact constraint name resolves
    // correctly before relying on it.
    const { data: links, error: linksErr } = await db
      .from('record_contacts')
      .select('contact_id, records!record_contacts_record_id_fkey(id, record_type, reference_code, deleted_at)')
      .in('contact_id', ids)

    if (linksErr) {
      request.log.error({ err: linksErr }, 'failed to load linked test beds/opportunities for contacts list')
      return reply.code(500).send({ error: linksErr.message })
    }

    const relevantLinks = (links ?? []).filter(l =>
      l.records && !l.records.deleted_at && ['test_bed', 'opportunity'].includes(l.records.record_type)
    )
    const linkedRecordIds = [...new Set(relevantLinks.map(l => l.records.id))]

    let linkedName = {}
    if (linkedRecordIds.length) {
      const { data: linkedRevs, error: linkedRevsErr } = await db
        .from('record_revisions')
        .select('record_id, payload')
        .in('record_id', linkedRecordIds)
        .order('revision_number', { ascending: false })

      if (linkedRevsErr) {
        request.log.error({ err: linkedRevsErr }, 'failed to load names for linked test beds/opportunities')
        return reply.code(500).send({ error: linkedRevsErr.message })
      }
      for (const rev of linkedRevs ?? []) {
        if (!(rev.record_id in linkedName)) linkedName[rev.record_id] = rev.payload?.name ?? null
      }
    }

    // Map keyed by record id per contact (not an array push) so a Contact
    // holding two roles on the same record (both the creation-time role
    // and a later buyer-assignment role) still counts that record once,
    // not twice - the unique constraint on record_contacts is
    // (record_id, contact_id, role), so duplicate (record_id, contact_id)
    // pairs with different roles are a real, expected case, not an edge
    // case to ignore.
    const byContact = {}
    for (const l of relevantLinks) {
      if (!byContact[l.contact_id]) byContact[l.contact_id] = { test_bed: new Map(), opportunity: new Map() }
      const bucket = byContact[l.contact_id][l.records.record_type]
      bucket.set(l.records.id, {
        id: l.records.id,
        name: linkedName[l.records.id] || l.records.reference_code || 'Untitled',
      })
    }

    return contacts.map(c => ({
      ...c,
      payload: latestPayload[c.id] ?? {},
      linked_test_beds: byContact[c.id] ? [...byContact[c.id].test_bed.values()] : [],
      linked_opportunities: byContact[c.id] ? [...byContact[c.id].opportunity.values()] : [],
    }))
  })

  // POST /api/contacts
  // Mandatory at creation: Name, Company, Industry, Email, Mobile, Source.
  // The first five are the prototype's real leadMandatoryFields (Terminus
  // Ops.dc.html:7529); Source is a confirmed deliberate departure from
  // that list (2026-08-13 business decision), not a drift - noted here so
  // it isn't mistaken for a future re-extraction bug. Company is plain
  // free text - matching how Name/Email work, not an Account link. The
  // real Account link (parent_record_id) is deliberately left unset at
  // creation and becomes a genuine qualification requirement instead,
  // resolved via POST /contacts/:id/link-account sometime before
  // Unqualified -> Qualified succeeds, not before - fast lead entry
  // shouldn't be gated on reconciling company names against the Account
  // list. Job Role/Address/City/Postcode/Country/Region/LinkedIn/Summary
  // are still only mandatory at qualification (leadQualifyRequired,
  // :5844), enforced by the Unqualified -> Qualified payload_field_required
  // gate, not here - all accepted as optional fields if provided. Notes,
  // if filled, seeds the real Notes History array's first entry rather
  // than being its own field - see below.
  app.post('/contacts', async (request, reply) => {
    const {
      name, company, email, mobile, industry_id, source,
      summary, jobRole, linkedin, address, address2, city, postcode, country, region, notes,
    } = request.body ?? {}

    const missing = []
    if (!name?.trim()) missing.push('name')
    if (!company?.trim()) missing.push('company')
    if (!email?.trim()) missing.push('email')
    if (!mobile?.trim()) missing.push('mobile')
    if (!industry_id) missing.push('industry_id')
    if (!source) missing.push('source')
    if (missing.length) {
      return reply.code(400).send({ error: 'missing required fields', missing })
    }
    if (!VALID_SOURCES.includes(source)) {
      return reply.code(400).send({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` })
    }
    // Round 10 Phase 4 item 1: mobile was accepted as free text on both
    // write paths. Enforced here rather than only in the browser, per the
    // standing rule against trusting client-only validation for anything
    // persisted - and this is the creation path the inline buyer-contact
    // dialogue also goes through.
    if (!isValidMobile(mobile)) {
      return reply.code(400).send({ error: 'mobile must be a phone number: an optional leading +, then 7 to 15 digits, with spaces, hyphens, brackets or dots as separators' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'contact',
        status: 'Unqualified',
        owner_id: request.user.id,
        parent_record_id: null,
        industry_id
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert contact')
      return sendWriteError(reply, recordErr)
    }

    const payload = { name: name.trim(), company: company.trim(), email: email.trim(), mobile: mobile.trim() }
    const optionalStringFields = { source, summary, jobRole, linkedin, address, address2, city, postcode, country, region }
    for (const [key, value] of Object.entries(optionalStringFields)) {
      if (typeof value === 'string' && value.trim()) payload[key] = value.trim()
    }
    // Notes (New Lead modal, Terminus Ops.dc.html:4945) seeds the real
    // Notes History array's first entry when filled, same {text, at, by}
    // shape every later entry uses - not a separate static field, the
    // prototype's own Lead-editing convention already treats "a note on
    // what changed" as part of this one running history, not its own
    // thing (2026-08-13, confirmed). Left blank, nothing is seeded, no
    // placeholder entry.
    if (typeof notes === 'string' && notes.trim()) {
      payload.notes = [{ text: notes.trim(), at: new Date().toISOString(), by: request.user.email }]
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: 1, payload, created_by: request.user.id })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert contact revision')
      return sendWriteError(reply, revErr)
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'contact',
      action: 'created',
      actor_id: request.user.id,
      detail: { name: name.trim(), company: company.trim() }
    })

    return reply.code(201).send({ ...record, payload })
  })

  // GET /api/contacts/:id
  app.get('/contacts/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: contact, error } = await db
      .from('records')
      .select('*')
      .eq('id', request.params.id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !contact) {
      return reply.code(404).send({ error: 'not found' })
    }

    const { data: rev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', contact.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    return { ...contact, payload: rev?.payload ?? {} }
  })

  // PATCH /api/contacts/:id — ordinary field edits only. Stage changes go
  // through the generic POST /api/records/:id/transition, including
  // Parked, which is gated on followUpDate already being saved here first
  // (see transitions.js's payload_field_required check).
  const CONTACT_WRITABLE_KEYS = new Set([
    'name', 'company', 'email', 'mobile', 'source', 'summary', 'address', 'legalEntity', 'followUpDate',
    'jobRole', 'linkedin', 'address2', 'city', 'postcode', 'country', 'region',
    'notes', // append-only Notes History, same shape/convention as Opportunity's
  ])

  // account_id is deliberately NOT accepted here (2026-08-13) - linking
  // the real Account is its own business event (may create a new Account
  // record, always writes a Notes History entry), not a plain field edit.
  // See POST /contacts/:id/link-account below, the only way to set
  // parent_record_id post-creation now.
  app.patch('/contacts/:id', async (request, reply) => {
    const { payload, industry_id } = request.body ?? {}

    // Round 7 Phase 2 (2026-08-18): reject a body this endpoint cannot
    // act on, rather than returning 200 {ok:true} having done nothing.
    // Previously `if (payload)` simply fell through, so a caller that
    // misspelled the wrapper - or sent bare fields instead of
    // {payload:{...}} - got a success response and no write. That cost a
    // real false result during Round 7 Phase 2's own verification, where
    // every value appeared to be accepted because none of them ever
    // reached the validation block. opportunities.js already guarded this
    // correctly; this brings the rest into line with it.
    if (payload !== undefined && (payload === null || typeof payload !== 'object' || Array.isArray(payload))) {
      return reply.code(400).send({ error: 'payload must be an object' })
    }
    if (payload === undefined && industry_id === undefined) {
      return reply.code(400).send({ error: 'request body must contain payload or industry_id' })
    }

    if (payload) {
      const disallowed = Object.keys(payload).filter(k => !CONTACT_WRITABLE_KEYS.has(k))
      if (disallowed.length) {
        return reply.code(400).send({
          error: 'payload contains fields that cannot be set from this endpoint',
          disallowed
        })
      }
      // Guarded on the SUBMITTED key, never the merged payload - the same
      // shape as installationEnvironment and siteOwnership on test-beds.js.
      // Existing contacts hold free-text mobiles written before this rule
      // existed, and validating the merged result would fail every
      // unrelated save on those records permanently.
      if ('mobile' in payload && !isValidMobile(payload.mobile)) {
        return reply.code(400).send({ error: 'mobile must be a phone number: an optional leading +, then 7 to 15 digits, with spaces, hyphens, brackets or dots as separators' })
      }
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    const columnUpdate = {}
    if (industry_id !== undefined) columnUpdate.industry_id = industry_id
    if (Object.keys(columnUpdate).length) {
      // records_select is team-wide, records_update is still owner-only -
      // a non-owner's update() is filtered by RLS to zero affected rows
      // rather than erroring, so updateErr alone can't tell success from
      // a silent no-op. Check the write result itself.
      const { data: updated, error: updateErr } = await db
        .from('records')
        .update(columnUpdate)
        .eq('id', record.id)
        .select('id')
      if (updateErr) return sendWriteError(reply, updateErr)
      if (!updated?.length) return sendRefusal(reply)
    }

    if (payload) {
      // Round 17A Phase 1: the read that used to stand here existed only to
      // build the merge, and the merge now happens inside the write, so both
      // the read and the gap the race lived in are gone.
      //
      // WHAT THAT READ WAS PROTECTING, since deleting it must not delete the
      // lesson: a 2026-08-15 fix added an explicit error check because an
      // unchecked one made a failed fetch indistinguishable from "no prior
      // revision", which silently reduced the payload to this PATCH's own
      // keys. That failure mode is now structurally unreachable rather than
      // guarded against - there is no client-side read left to fail, and
      // append_record_revision does the lookup and the insert in one
      // statement, so it cannot see "no prior revision" for a record that
      // has one.
      const { error: revErr } = await appendRecordRevision(db, record.id, payload, request.user.id)

      if (revErr) return sendWriteError(reply, revErr)
    }

    return reply.send({ ok: true })
  })

  // POST /api/contacts/:id/link-account
  // Resolves the real Account link (parent_record_id) - the
  // reconciliation step "Link to Account" on the detail page performs,
  // distinct from and never touching the free-text company field. Accepts
  // either account_id (link to an existing Account, found by the
  // detail page's own search) or new_account_name (create one, then
  // link) - the same two shapes POST /contacts used to accept inline
  // before company became plain text (2026-08-13). Always writes a Notes
  // History entry, same as every other write on this record.
  //
  // account_details (Round 4 Phase 3, 2026-08-17, optional): the fuller
  // Account Details panel's own fields (terminusLead, websiteUrl,
  // billing/shipping addresses, parentAccountId) - genuinely optional,
  // an old-style call with just new_account_name still creates a
  // name-only Account exactly as before, this endpoint's only real
  // caller (contact-detail.js's performLinkCdAccount) is the one being
  // upgraded to send it, not a hard requirement of the endpoint itself.
  // "Pre-fill Billing/Shipping from the Contact's own address" (the
  // brief's own requirement) is a client-side concern - the panel opens
  // pre-populated from the Contact's address fields, editable before
  // submit, so whatever arrives here in account_details.billing/shipping
  // is already the user-confirmed values, this endpoint doesn't need to
  // know it came from a Contact's address at all.
  app.post('/contacts/:id/link-account', async (request, reply) => {
    const { account_id, new_account_name, account_details } = request.body ?? {}

    if (!account_id && !new_account_name?.trim()) {
      return reply.code(400).send({ error: 'account_id or new_account_name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: contact, error: contactErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (contactErr || !contact) {
      return reply.code(404).send({ error: 'not found' })
    }

    let resolvedAccountId = account_id ?? null
    let accountName = null

    if (resolvedAccountId) {
      const { data: existingRev } = await db
        .from('record_revisions')
        .select('payload')
        .eq('record_id', resolvedAccountId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      accountName = existingRev?.payload?.name ?? null
    } else {
      accountName = new_account_name.trim()
      const d = account_details ?? {}
      const b = d.billing ?? {}
      const s = d.shipping ?? {}

      // Same log-and-continue convention as create-opportunity's own
      // issueReferenceNumber call - a genuine generation failure doesn't
      // block the Account from being created, but it's logged, never
      // silently dropped.
      let reference_code = null
      if (b.country) {
        try {
          const countryCode = countryToCode(b.country)
          if (countryCode) reference_code = await issueAccountNumber(db, countryCode, accountName)
        } catch (err) {
          request.log.error({ err }, 'failed to issue Account Number for account created via link-account')
        }
      }

      const { data: newAccount, error: accountErr } = await db
        .from('records')
        .insert({
          record_type: 'account',
          status: 'active',
          owner_id: request.user.id,
          parent_account_id: d.parentAccountId ?? null,
          reference_code,
        })
        .select()
        .single()

      if (accountErr) {
        request.log.error({ err: accountErr }, 'failed to create account for link-account')
        return sendWriteError(reply, accountErr)
      }

      const acctPayload = {
        name: accountName,
        terminusLead: d.terminusLead ?? null,
        websiteUrl: d.websiteUrl ?? null,
        billingAddress: b.address ?? null, billingAddress2: b.address2 ?? null,
        billingCity: b.city ?? null, billingPostcode: b.postcode ?? null,
        billingCountry: b.country ?? null, billingRegion: b.region ?? null,
        shippingAddress: s.address ?? null, shippingAddress2: s.address2 ?? null,
        shippingCity: s.city ?? null, shippingPostcode: s.postcode ?? null,
        shippingCountry: s.country ?? null, shippingRegion: s.region ?? null,
      }
      const { error: acctRevErr } = await db
        .from('record_revisions')
        .insert({
          record_id: newAccount.id,
          revision_number: 1,
          payload: acctPayload,
          created_by: request.user.id
        })

      if (acctRevErr) {
        request.log.error({ err: acctRevErr }, 'failed to insert account revision for link-account')
        return sendWriteError(reply, acctRevErr)
      }

      resolvedAccountId = newAccount.id
    }

    // Same write-result-checking discipline as every other write path
    // fixed earlier this session - records_select is team-wide,
    // records_update is still owner-only, so a non-owner's update is
    // verified by its returned rows, not assumed successful just because
    // no error was thrown.
    const { data: updated, error: updateErr } = await db
      .from('records')
      .update({ parent_record_id: resolvedAccountId })
      .eq('id', contact.id)
      .select('id')

    if (updateErr) return sendWriteError(reply, updateErr)
    if (!updated?.length) return sendRefusal(reply)

    // Real bug found and fixed (2026-08-15): a failed fetch here would have
    // wiped the Contact down to just the new note, silently, on the very save
    // that is supposed to be recording an Account link. The check stays and
    // still matters: Round 17A Phase 1 moved the merge into the write, but
    // this read survives because prepending to notes needs the existing
    // array, so it can still fail and must still be checked.
    const { data: revRow, error: revRowErr } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', contact.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (revRowErr) {
      request.log.error({ err: revRowErr }, 'failed to load current revision before link-account merge')
      return reply.code(500).send({ error: revRowErr.message })
    }

    const note = {
      text: `Linked to Account: ${accountName ?? 'Unknown'}.`,
      at: new Date().toISOString(),
      by: request.user.email,
    }
    // Round 17A Phase 1: the read above STAYS, because prepending to notes
    // needs the existing array. Only the `notes` key is sent, so every other
    // key is merged server-side from the current payload rather than from
    // this read. Two writers prepending a note to the SAME record can still
    // lose one, which is same-key last-writer-wins and is Phase 2's concern,
    // not this one.
    const { error: revErr } = await appendRecordRevision(
      db, contact.id, { notes: [note, ...(revRow?.payload?.notes ?? [])] }, request.user.id)

    if (revErr) return sendWriteError(reply, revErr)

    await db.from('audit_log').insert({
      record_id: contact.id,
      record_type: 'contact',
      action: 'linked_account',
      actor_id: request.user.id,
      detail: { account_id: resolvedAccountId, account_name: accountName }
    })

    return reply.send({ ok: true, account_id: resolvedAccountId, account_name: accountName })
  })

  // DELETE /api/contacts/:id — soft delete only. record_revisions and
  // audit_log are untouched, no cascading, no new DELETE RLS policy —
  // deleted_at is filtered at the application query level (here, in the
  // list endpoint above, and in the Account roll-up). Distinct from
  // Parked: this is for genuinely time-wasting or out-of-space entries,
  // not real-but-not-viable-yet ones.
  app.delete('/contacts/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    // records_select is team-wide, records_update is still owner-only - a
    // non-owner's update() is filtered by RLS to zero affected rows
    // rather than erroring, so updateErr alone can't tell a genuine
    // soft-delete from a silent no-op. Checking the write result itself
    // (not an extra owner-checking SELECT beforehand) is what stops a
    // false "ok:true" and a fabricated audit_log entry for a delete that
    // never happened.
    const { data: updated, error: updateErr } = await db
      .from('records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', record.id)
      .select('id')

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to soft-delete contact')
      return sendWriteError(reply, updateErr)
    }
    if (!updated?.length) {
      return sendRefusal(reply)
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'contact',
      action: 'deleted',
      actor_id: request.user.id,
      detail: {}
    })

    return reply.send({ ok: true })
  })

  // Shared by create-opportunity/create-test-bed below. Both require the
  // Contact to be Qualified - server-enforced here, not just a UI gate,
  // since the retired /leads/:id/convert* endpoints had no equivalent
  // check at all. Both replace the old parent_record_id link with a
  // record_contacts row instead: a fresh Opportunity/Test Bed created
  // from a Contact has no parent, Contact attachment is many-to-many
  // (DESIGN_PRINCIPLES.md Section 2), not exclusive single-parent
  // ownership.
  async function loadQualifiedContact(db, id) {
    const { data: contact, error } = await db
      .from('records')
      .select('id, status, parent_record_id, industry_id')
      .eq('id', id)
      .eq('record_type', 'contact')
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !contact) return { error: { code: 404, body: { error: 'not found' } } }
    if (contact.status !== 'Qualified') {
      return {
        error: {
          code: 422,
          body: { error: `Contact must be Qualified before creating an Opportunity or Test Bed (current stage: ${contact.status})` }
        }
      }
    }

    // Account name seeds the new record's name/company field - there is
    // no per-creation form here (the prototype's "+ Create" is a single
    // click, :305-312), so this always reads the real linked Account,
    // never the free-text company field. Stale comment corrected
    // 2026-08-17: this used to say "Account is the only company-name
    // source left now that Contact has no free-text company field of
    // its own" - true when this function was first written (commit
    // 66b99be), false since company was reintroduced as a free-text
    // creation field the same evening (commit fbbeb22) and never
    // reconciled here. Since Round 3 Phase 1 makes the Account link a
    // hard, guided part of qualifying, every Qualified Contact reaching
    // this point has one, so the behaviour itself was always correct -
    // only the reasoning in this comment was out of date.
    let accountName = null
    if (contact.parent_record_id) {
      const { data: acctRev } = await db
        .from('record_revisions')
        .select('payload')
        .eq('record_id', contact.parent_record_id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      accountName = acctRev?.payload?.name ?? null
    }

    // contactPayload (2026-08-15, Milestone 4): create-test-bed needs the
    // Contact's own stored country to resolve a reference_code - Country
    // is a real Qualification-gate field (20260812000005), so every
    // Qualified Contact is guaranteed to have one.
    const { data: contactRev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', contact.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    return { contact, accountName, contactPayload: contactRev?.payload ?? {} }
  }

  // Default role 'commercial buyer' for every Contact linked this way -
  // same default used for the record_contacts backfill of the 8
  // historically-converted Leads (2026-08-12). A one-click "+ Create"
  // action has no role picker; this is a starting default, not a
  // verified fact, correctable per-record later without touching
  // existing rows.
  async function linkContact(db, recordId, contactId, actorId) {
    const { error } = await db
      .from('record_contacts')
      .insert({ record_id: recordId, contact_id: contactId, role: 'commercial buyer', created_by: actorId })
    if (error) throw new Error(`failed to link contact: ${error.message}`)
  }

  // POST /contacts/:id/create-opportunity
  // reference_code (2026-08-15, Milestone 6): confirmed by direct
  // inspection this path never called issueReferenceNumber - the
  // identical gap Test Bed had before Milestone 2. POST /test-beds/:id/
  // convert (the other Opportunity creation path) is deliberately left
  // untouched - it already carries a Test Bed's reference_code unchanged
  // (Milestone 5) and must never call the generator itself. Same
  // country/industry resolution as create-test-bed: countryToCode() on
  // the Contact's own stored country (a real Qualification-gate field,
  // so always present), industries.short_code from contact.industry_id.
  //
  // account_id (2026-08-15, Milestone 6 close-out): direct copy from the
  // Contact's own Account link (contact.parent_record_id), same as
  // create-test-bed. Deliberately NOT a hard precondition here the way
  // it is for Test Bed (Milestone 3) - that requirement is specific to
  // Test Bed's own confirmed creation rules, never stated for
  // Opportunity. If the Contact has no Account link, the Opportunity is
  // created with account_id absent - the same honest-absence convention
  // this build uses everywhere else, not a forced block.
  app.post('/contacts/:id/create-opportunity', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { contact, accountName, contactPayload, error } = await loadQualifiedContact(db, request.params.id)
    if (error) return reply.code(error.code).send(error.body)

    const name = accountName ?? 'New Opportunity'

    const { data: probDefault } = await db
      .from('stage_probability_defaults')
      .select('default_probability_pct')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage', 'Discovery')
      .maybeSingle()

    let referenceCode = null
    if (contact.industry_id) {
      const { data: industry } = await db
        .from('industries')
        .select('short_code')
        .eq('id', contact.industry_id)
        .maybeSingle()

      const countryCode = countryToCode(contactPayload.country)

      if (industry && countryCode) {
        try {
          referenceCode = await issueReferenceNumber(db, countryCode, industry.short_code)
        } catch (refErr) {
          request.log.error({ err: refErr }, 'failed to issue reference number for opportunity created from contact')
        }
      }
    }

    const { data: opp, error: oppErr } = await db
      .from('records')
      .insert({
        record_type: 'opportunity',
        status: 'Discovery',
        owner_id: request.user.id,
        reference_code: referenceCode,
        account_id: contact.parent_record_id ?? null
      })
      .select()
      .single()

    if (oppErr) {
      request.log.error({ err: oppErr }, 'failed to create opportunity from contact')
      return sendWriteError(reply, oppErr)
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: opp.id,
        revision_number: 1,
        // customerLead (Round 2 Phase 1, 2026-08-16): Opportunity's own
        // origin-contact field, same concept and same fix as Test Bed's
        // initialLead above - set once, here, at creation, protected from
        // a later silent overwrite by PATCH /opportunities/:id's own
        // freshness check (saveRefFields), not by this insert.
        payload: { name, company_name: accountName ?? '', customerLead: contactPayload.name ?? null },
        created_by: request.user.id
      })
    if (revErr) return sendWriteError(reply, revErr)

    const { error: detErr } = await db
      .from('opportunity_details')
      .insert({ record_id: opp.id, probability_pct: probDefault?.default_probability_pct ?? null })
    if (detErr) return sendWriteError(reply, detErr)

    try {
      await linkContact(db, opp.id, contact.id, request.user.id)
    } catch (err) {
      request.log.error({ err }, 'failed to link contact to new opportunity')
      return reply.code(500).send({ error: err.message })
    }

    await db.from('audit_log').insert([
      { record_id: contact.id, record_type: 'contact', action: 'created_opportunity', actor_id: request.user.id, detail: { opportunity_id: opp.id } },
      { record_id: opp.id, record_type: 'opportunity', action: 'created_from_contact', actor_id: request.user.id, detail: { contact_id: contact.id, initial_stage: 'Discovery' } }
    ])

    return reply.code(201).send(opp)
  })

  // POST /contacts/:id/create-test-bed
  //
  // account_id (2026-08-15, Milestone 3): a linked Account is a hard
  // precondition at Test Bed creation (PROTOTYPE_SPECIFICATION.md
  // Section 6, "Account link"). When creating via Contact conversion,
  // the source Contact's own Account link (parent_record_id) must
  // already be resolved - reject here, don't create the Test Bed in a
  // half-linked state. loadQualifiedContact already selects
  // parent_record_id, so this reuses that, no extra query.
  //
  // status (2026-08-15, Milestone 3): this was still hardcoded to 'NDA',
  // a stage name that no longer exists anywhere in test_bed's corrected
  // 8-stage stage_definitions (20260815000000) - a real bug, found while
  // adding the account_id check to this exact function, not touched by
  // the earlier POST /test-beds fix since that's a separate creation
  // path. Fixed to 'Qualification' here for the same reason it was fixed
  // there.
  // reference_code / country (2026-08-15, Milestone 4): this path never
  // called issueReferenceNumber at all - only the direct-creation
  // POST /test-beds did (Milestone 3's smaller, scoped addition). Every
  // Contact-conversion Test Bed got reference_code: null indefinitely,
  // exactly the gap TESTBED_BUILD_BRIEF.md's Milestone 4 section calls
  // out. Country is resolved via countryToCode() (src/lib/country-code.js,
  // ported from the prototype, no mapping existed anywhere before this).
  // Country is a real Qualification-gate field, so every Qualified
  // Contact has one - the null-safe handling below covers only the
  // theoretical case where issueReferenceNumber's own country_code
  // validation still rejects an unmapped/empty value.
  //
  // region IS now carried over (2026-08-15, reverses the Milestone 4
  // decision above it used to sit next to). That decision was correct at
  // the time: Contact's region was a continent-scale picklist, Test
  // Bed's own Region was UK-sub-national free text, genuinely different
  // scales, carrying one into the other would have been misleading. Test
  // Bed's Region is now the identical fixed picklist as Contact's
  // (Americas/Europe & UK/Middle East/APAC/Africa, see REGION_OPTIONS in
  // test-bed-detail.js) - same scale, same values, so carrying it over
  // is now the honest, correct default, not the mistake it would have
  // been before.
  // ONE computation path for the Test Bed naming rule, per the standing
  // rule that a second path which agrees today will disagree later. Both
  // the creation endpoint below and the read-only suggestion endpoint
  // that populates the creation dialogue's default call this, so the name
  // a user is offered is by construction the name they would have got.
  //
  // Count-then-suffix, deliberately not the atomic reference-number
  // generator: this is a display label with no uniqueness constraint
  // anywhere, unlike reference_code, so a rare race between two
  // simultaneous creates producing the same suffix is cosmetic, not a
  // data-integrity risk. That reasoning is unchanged from Round 5 Phase 2.
  async function suggestTestBedName(db, accountId, accountName, log) {
    if (!accountName) return 'New Test Bed'
    const { count, error } = await db
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('record_type', 'test_bed')
      .eq('account_id', accountId)
      .is('deleted_at', null)
    if (error) {
      // Log and fall back to the unsuffixed name rather than failing the
      // create outright - the same log-and-continue convention this file
      // already uses for reference-number issuance.
      log?.error({ err: error }, 'failed to count sibling test beds for name suffix')
      return accountName
    }
    return count ? `${accountName} (${count + 1})` : accountName
  }

  // GET /contacts/:id/test-bed-name-suggestion
  //
  // Read-only. Supplies the creation dialogue with the value it should
  // pre-fill, so the suffix is offered rather than applied silently
  // (Round 10 Phase 1, reversing Round 5 Phase 2 - see DESIGN_PRINCIPLES).
  // Deliberately its own endpoint rather than computing the suffix in the
  // browser: a client-side count would be a second implementation of the
  // naming rule, and the two would drift.
  app.get('/contacts/:id/test-bed-name-suggestion', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { contact, accountName, error } = await loadQualifiedContact(db, request.params.id)
    if (error) return reply.code(error.code).send(error.body)
    if (!contact.parent_record_id) {
      return reply.code(422).send({ error: 'Contact must be linked to an Account before creating a Test Bed' })
    }
    const suggestedName = await suggestTestBedName(db, contact.parent_record_id, accountName, request.log)
    return reply.send({ suggestedName })
  })

  app.post('/contacts/:id/create-test-bed', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { contact, accountName, contactPayload, error } = await loadQualifiedContact(db, request.params.id)
    if (error) return reply.code(error.code).send(error.body)

    if (!contact.parent_record_id) {
      return reply.code(422).send({
        error: 'Contact must be linked to an Account before creating a Test Bed'
      })
    }

    // Round 5 Phase 2 (2026-08-17): distinguish siblings under the same
    // Account. Previously every Test Bed created from a Contact inherited
    // the identical, unsuffixed Account name - a known, previously-
    // flagged gap (DESIGN_PRINCIPLES.md Deferred scope, Round 2) that
    // surfaced as a real problem once "Add Another" made creating a
    // second Test Bed under the same Account a real, common action, not
    // a theoretical one. Investigated before building: Test Bed's own
    // `name` field has no editable UI anywhere today, unlike
    // Opportunity's equivalent field (made editable Round 3) - so
    // "the user can just rename it after" is not a real escape valve
    // here the way it is for Opportunity, the name has to be
    // distinguishing at creation time, not fixable later. Chosen:
    // append a sequence number automatically, consistent with this
    // build's established "no friction at fast entry" precedent
    // (Company stays free text, Lead's Company field is autocomplete-
    // only, and so on) - a name-prompt modal would add a real
    // interruption to what is today a single click, for a field the UI
    // gives no way to fix afterward if the prompt were skipped or left
    // blank. Only genuinely distinguishing siblings get a suffix, the
    // first Test Bed under an Account keeps the clean, unsuffixed name,
    // matching how a natural "first, then (2), (3)..." sequence reads.
    // Count-then-suffix, not the atomic TT- reference-number generator,
    // deliberately: this is a display-only distinguishing label with no
    // uniqueness constraint anywhere, unlike reference_code, so a rare
    // race between two simultaneous creates producing the same suffix is
    // a cosmetic possibility, not a data-integrity risk, not worth the
    // extra atomic-counter machinery that field's real uniqueness
    // guarantee requires.
    // Round 10 Phase 1 (2026-08-19): the suffixed value is now a DEFAULT
    // offered in the creation dialogue, not something applied silently.
    // A caller supplying its own name gets that name; a caller supplying
    // none keeps the pre-Round-10 behaviour exactly, which is what every
    // existing test and any direct API caller relies on.
    const suggested = await suggestTestBedName(db, contact.parent_record_id, accountName, request.log)
    const supplied = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
    if (request.body && 'name' in request.body && !supplied) {
      return reply.code(400).send({ error: 'name, when supplied, cannot be blank' })
    }
    const name = supplied || suggested

    let referenceCode = null
    if (contact.industry_id) {
      const { data: industry } = await db
        .from('industries')
        .select('short_code')
        .eq('id', contact.industry_id)
        .maybeSingle()

      const countryCode = countryToCode(contactPayload.country)

      if (industry && countryCode) {
        try {
          referenceCode = await issueReferenceNumber(db, countryCode, industry.short_code)
        } catch (refErr) {
          request.log.error({ err: refErr }, 'failed to issue reference number for test bed created from contact')
        }
      }
    }

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'test_bed',
        status: 'Qualification',
        owner_id: request.user.id,
        account_id: contact.parent_record_id,
        industry_id: contact.industry_id ?? null,
        reference_code: referenceCode
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to create test bed from contact')
      return sendWriteError(reply, recordErr)
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: record.id,
        revision_number: 1,
        payload: {
          name, client_organisation: accountName ?? '', notes: null, accumulated_cost: 0,
          country: contactPayload.country ?? null,
          region: contactPayload.region ?? null,
          // Origin-contact field (Round 2 Phase 1, 2026-08-16): the
          // client-side person who originated this engagement, per
          // PROTOTYPE_SPECIFICATION.md Section 6 - documented intent,
          // never actually auto-populated until now. Set once, here, at
          // creation; PATCH /test-beds/:id's own freshness check (see
          // saveTbFields) is what protects it from a later silent
          // overwrite, not this insert.
          initialLead: contactPayload.name ?? null
        },
        created_by: request.user.id
      })
    if (revErr) return sendWriteError(reply, revErr)

    try {
      await linkContact(db, record.id, contact.id, request.user.id)
    } catch (err) {
      request.log.error({ err }, 'failed to link contact to new test bed')
      return reply.code(500).send({ error: err.message })
    }

    await db.from('audit_log').insert([
      { record_id: contact.id, record_type: 'contact', action: 'created_test_bed', actor_id: request.user.id, detail: { test_bed_id: record.id } },
      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact', actor_id: request.user.id, detail: { contact_id: contact.id, initial_stage: 'Qualification', account_id: contact.parent_record_id } }
    ])

    return reply.code(201).send(record)
  })
}
