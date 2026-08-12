import { createUserClient } from '../supabase.js'

export default async function accountsRoutes(app) {
  // GET /api/accounts — list, used by Contact's "+ New Account" picker and
  // general account browsing. Account has no soft-delete concept in this
  // build (only Contact does), so nothing is excluded here.
  app.get('/accounts', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: accounts, error } = await db
      .from('records')
      .select('id, created_at, industry_id')
      .eq('record_type', 'account')
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

  // POST /api/accounts — the full creation form (name, address,
  // industry_id). Contact's own "+ New Account" inline flow doesn't call
  // this directly, it inserts a bare account (name only) itself, since it
  // needs the new id back inline as part of creating the Contact in one
  // request — see POST /contacts.
  app.post('/accounts', async (request, reply) => {
    const { name, address, industry_id } = request.body ?? {}

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'account',
        status: 'active',
        owner_id: request.user.id,
        industry_id: industry_id ?? null
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert account')
      return reply.code(500).send({ error: recordErr.message })
    }

    const payload = { name: name.trim(), address: address?.trim() ?? null }

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

    return { ...account, payload: rev?.payload ?? {}, contacts: contactsWithPayload }
  })

  // PATCH /api/accounts/:id
  const ACCOUNT_WRITABLE_KEYS = new Set(['name', 'address'])

  app.patch('/accounts/:id', async (request, reply) => {
    const { payload, industry_id } = request.body ?? {}

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
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'account')
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    if (industry_id !== undefined) {
      const { error: updateErr } = await db.from('records').update({ industry_id }).eq('id', record.id)
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
}
