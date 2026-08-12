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
  // Mandatory at creation (DESIGN_PRINCIPLES Section 2): Name, Company (an
  // Account link — either account_id for an existing Account, or
  // new_account_name for inline "+ New Account" creation, name only at
  // that point), Email, Mobile, industry_id, Source, Summary. This
  // guarantees a complete starting record; the Unqualified -> Qualified
  // payload_field_required gate is a separate safety net for the case
  // where one of these gets cleared by a later edit, not the primary
  // enforcement point.
  app.post('/contacts', async (request, reply) => {
    const { name, account_id, new_account_name, email, mobile, industry_id, source, summary } = request.body ?? {}

    const missing = []
    if (!name?.trim()) missing.push('name')
    if (!account_id && !new_account_name?.trim()) missing.push('account_id or new_account_name')
    if (!email?.trim()) missing.push('email')
    if (!mobile?.trim()) missing.push('mobile')
    if (!industry_id) missing.push('industry_id')
    if (!source) missing.push('source')
    if (!summary?.trim()) missing.push('summary')
    if (missing.length) {
      return reply.code(400).send({ error: 'missing required fields', missing })
    }
    if (!VALID_SOURCES.includes(source)) {
      return reply.code(400).send({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` })
    }

    const db = createUserClient(request.jwt)

    let resolvedAccountId = account_id ?? null

    if (!resolvedAccountId) {
      const { data: newAccount, error: accountErr } = await db
        .from('records')
        .insert({ record_type: 'account', status: 'active', owner_id: request.user.id })
        .select()
        .single()

      if (accountErr) {
        request.log.error({ err: accountErr }, 'failed to create inline account')
        return reply.code(500).send({ error: accountErr.message })
      }

      const { error: acctRevErr } = await db
        .from('record_revisions')
        .insert({
          record_id: newAccount.id,
          revision_number: 1,
          payload: { name: new_account_name.trim() },
          created_by: request.user.id
        })

      if (acctRevErr) {
        request.log.error({ err: acctRevErr }, 'failed to insert inline account revision')
        return reply.code(500).send({ error: acctRevErr.message })
      }

      resolvedAccountId = newAccount.id
    }

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'contact',
        status: 'Unqualified',
        owner_id: request.user.id,
        parent_record_id: resolvedAccountId,
        industry_id
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert contact')
      return reply.code(500).send({ error: recordErr.message })
    }

    const payload = { name: name.trim(), email: email.trim(), mobile: mobile.trim(), source, summary: summary.trim() }

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
      detail: { name: name.trim(), account_id: resolvedAccountId }
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
  const CONTACT_WRITABLE_KEYS = new Set(['name', 'email', 'mobile', 'source', 'summary', 'address', 'legalEntity', 'followUpDate'])

  app.patch('/contacts/:id', async (request, reply) => {
    const { payload, industry_id, account_id } = request.body ?? {}

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
    if (account_id !== undefined) columnUpdate.parent_record_id = account_id
    if (Object.keys(columnUpdate).length) {
      const { error: updateErr } = await db.from('records').update(columnUpdate).eq('id', record.id)
      if (updateErr) return reply.code(500).send({ error: updateErr.message })
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

    const { error: updateErr } = await db
      .from('records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', record.id)

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to soft-delete contact')
      return reply.code(500).send({ error: updateErr.message })
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
}
