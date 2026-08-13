import { createUserClient } from '../supabase.js'

const VALID_SOURCES = ['Web', 'Email Inquiry', 'Referral', 'Direct Outreach', 'Marketing Campaign']

export default async function contactsRoutes(app) {
  // GET /api/contacts — excludes soft-deleted rows.
  app.get('/contacts', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: contacts, error } = await db
      .from('records')
      .select('*')
      .eq('record_type', 'contact')
      .is('deleted_at', null)
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

    return contacts.map(c => ({ ...c, payload: latestPayload[c.id] ?? {} }))
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
      return reply.code(500).send({ error: recordErr.message })
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
      return reply.code(500).send({ error: revErr.message })
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

    if (payload) {
      const disallowed = Object.keys(payload).filter(k => !CONTACT_WRITABLE_KEYS.has(k))
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
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
      if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })
    }

    if (payload) {
      const { data: revRow } = await db
        .from('record_revisions')
        .select('revision_number, payload')
        .eq('record_id', record.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextRevision = (revRow?.revision_number ?? 0) + 1
      const mergedPayload = { ...(revRow?.payload ?? {}), ...payload }

      const { error: revErr } = await db
        .from('record_revisions')
        .insert({ record_id: record.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

      if (revErr) return reply.code(500).send({ error: revErr.message })
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
  app.post('/contacts/:id/link-account', async (request, reply) => {
    const { account_id, new_account_name } = request.body ?? {}

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

    if (updateErr) return reply.code(500).send({ error: updateErr.message })
    if (!updated?.length) return reply.code(403).send({ error: 'not permitted' })

    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number, payload')
      .eq('record_id', contact.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const note = {
      text: `Linked to Account: ${accountName ?? 'Unknown'}.`,
      at: new Date().toISOString(),
      by: request.user.email,
    }
    const mergedPayload = { ...(revRow?.payload ?? {}), notes: [note, ...(revRow?.payload?.notes ?? [])] }
    const nextRevision = (revRow?.revision_number ?? 0) + 1

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: contact.id, revision_number: nextRevision, payload: mergedPayload, created_by: request.user.id })

    if (revErr) return reply.code(500).send({ error: revErr.message })

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
      return reply.code(500).send({ error: updateErr.message })
    }
    if (!updated?.length) {
      return reply.code(403).send({ error: 'not permitted' })
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
      .select('id, status, parent_record_id')
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
    // click, :305-312), and Account is the only company-name source left
    // now that Contact has no free-text company field of its own.
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

    return { contact, accountName }
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
  app.post('/contacts/:id/create-opportunity', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { contact, accountName, error } = await loadQualifiedContact(db, request.params.id)
    if (error) return reply.code(error.code).send(error.body)

    const name = accountName ?? 'New Opportunity'

    const { data: probDefault } = await db
      .from('stage_probability_defaults')
      .select('default_probability_pct')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage', 'Discovery')
      .maybeSingle()

    const { data: opp, error: oppErr } = await db
      .from('records')
      .insert({ record_type: 'opportunity', status: 'Discovery', owner_id: request.user.id })
      .select()
      .single()

    if (oppErr) {
      request.log.error({ err: oppErr }, 'failed to create opportunity from contact')
      return reply.code(500).send({ error: oppErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: opp.id,
        revision_number: 1,
        payload: { name, company_name: accountName ?? '' },
        created_by: request.user.id
      })
    if (revErr) return reply.code(500).send({ error: revErr.message })

    const { error: detErr } = await db
      .from('opportunity_details')
      .insert({ record_id: opp.id, probability_pct: probDefault?.default_probability_pct ?? null })
    if (detErr) return reply.code(500).send({ error: detErr.message })

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
  app.post('/contacts/:id/create-test-bed', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { contact, accountName, error } = await loadQualifiedContact(db, request.params.id)
    if (error) return reply.code(error.code).send(error.body)

    const name = accountName ?? 'New Test Bed'

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({ record_type: 'test_bed', status: 'NDA', owner_id: request.user.id })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to create test bed from contact')
      return reply.code(500).send({ error: recordErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: record.id,
        revision_number: 1,
        payload: { name, client_organisation: accountName ?? '', notes: null, accumulated_cost: 0 },
        created_by: request.user.id
      })
    if (revErr) return reply.code(500).send({ error: revErr.message })

    try {
      await linkContact(db, record.id, contact.id, request.user.id)
    } catch (err) {
      request.log.error({ err }, 'failed to link contact to new test bed')
      return reply.code(500).send({ error: err.message })
    }

    await db.from('audit_log').insert([
      { record_id: contact.id, record_type: 'contact', action: 'created_test_bed', actor_id: request.user.id, detail: { test_bed_id: record.id } },
      { record_id: record.id, record_type: 'test_bed', action: 'created_from_contact', actor_id: request.user.id, detail: { contact_id: contact.id, initial_stage: 'NDA' } }
    ])

    return reply.code(201).send(record)
  })
}
