import { createUserClient } from '../supabase.js'

export default async function leadsRoutes(app) {
  // GET /api/leads
  app.get('/leads', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: leads, error } = await db
      .from('records')
      .select('*')
      .eq('record_type', 'lead')
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list leads')
      return reply.code(500).send({ error: error.message })
    }
    if (!leads.length) return []

    const ids = leads.map(l => l.id)
    const { data: revs } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    return leads.map(l => ({ ...l, payload: latestPayload[l.id] ?? {} }))
  })

  // POST /api/leads
  app.post('/leads', async (request, reply) => {
    const { company_name, contact_name, source, notes } = request.body ?? {}

    if (!company_name?.trim()) {
      return reply.code(400).send({ error: 'company_name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({ record_type: 'lead', status: 'new', owner_id: request.user.id })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert lead')
      return reply.code(500).send({ error: recordErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: record.id,
        revision_number: 1,
        payload: {
          company_name: company_name.trim(),
          contact_name: contact_name?.trim() ?? null,
          source: source ?? null,
          notes: notes?.trim() ?? null
        },
        created_by: request.user.id
      })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert lead revision')
      return reply.code(500).send({ error: revErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: 'lead',
      action: 'created',
      actor_id: request.user.id,
      detail: { company_name: company_name.trim() }
    })

    return reply.code(201).send(record)
  })

  // POST /api/leads/:id/convert
  // Converts a lead to an Opportunity.
  app.post('/leads/:id/convert', async (request, reply) => {
    const { name } = request.body ?? {}

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: lead, error: leadErr } = await db
      .from('records')
      .select('id, status, record_type')
      .eq('id', request.params.id)
      .eq('record_type', 'lead')
      .maybeSingle()

    if (leadErr || !lead) return reply.code(404).send({ error: 'lead not found' })
    if (lead.status === 'converted') {
      return reply.code(409).send({ error: 'lead is already converted' })
    }

    const { data: leadRev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', lead.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const leadPayload = leadRev?.payload ?? {}

    const { data: probDefault } = await db
      .from('stage_probability_defaults')
      .select('default_probability_pct')
      .eq('record_type', 'opportunity')
      .is('variant', null)
      .eq('stage', 'Discovery')
      .maybeSingle()

    // TODO M3: wrap in a Postgres function for atomicity
    const { data: opp, error: oppErr } = await db
      .from('records')
      .insert({
        record_type: 'opportunity',
        status: 'Discovery',
        owner_id: request.user.id,
        parent_record_id: lead.id
      })
      .select()
      .single()

    if (oppErr) {
      request.log.error({ err: oppErr }, 'failed to create opportunity from lead')
      return reply.code(500).send({ error: oppErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: opp.id,
        revision_number: 1,
        payload: {
          name: name.trim(),
          company_name: leadPayload.company_name ?? ''
        },
        created_by: request.user.id
      })

    if (revErr) return reply.code(500).send({ error: revErr.message })

    const { error: detErr } = await db
      .from('opportunity_details')
      .insert({
        record_id: opp.id,
        probability_pct: probDefault?.default_probability_pct ?? null
      })

    if (detErr) return reply.code(500).send({ error: detErr.message })

    await db.from('records').update({ status: 'converted' }).eq('id', lead.id)

    await db.from('audit_log').insert([
      {
        record_id: lead.id,
        record_type: 'lead',
        action: 'converted',
        actor_id: request.user.id,
        detail: { to_opportunity_id: opp.id }
      },
      {
        record_id: opp.id,
        record_type: 'opportunity',
        action: 'created_from_lead',
        actor_id: request.user.id,
        detail: { from_lead_id: lead.id, initial_stage: 'Discovery' }
      }
    ])

    return reply.code(201).send(opp)
  })

  // POST /api/leads/:id/convert-to-test-bed
  // Converts a lead to a Test Bed, starting at the first Planning sub-stage (NDA).
  app.post('/leads/:id/convert-to-test-bed', async (request, reply) => {
    const { name } = request.body ?? {}

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: lead, error: leadErr } = await db
      .from('records')
      .select('id, status, record_type')
      .eq('id', request.params.id)
      .eq('record_type', 'lead')
      .maybeSingle()

    if (leadErr || !lead) return reply.code(404).send({ error: 'lead not found' })
    if (lead.status === 'converted') {
      return reply.code(409).send({ error: 'lead is already converted' })
    }

    const { data: leadRev } = await db
      .from('record_revisions')
      .select('payload')
      .eq('record_id', lead.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const leadPayload = leadRev?.payload ?? {}

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({
        record_type: 'test_bed',
        status: 'NDA',
        owner_id: request.user.id,
        parent_record_id: lead.id
      })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to create test bed from lead')
      return reply.code(500).send({ error: recordErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: record.id,
        revision_number: 1,
        payload: {
          name: name.trim(),
          client_organisation: leadPayload.company_name ?? '',
          notes: null,
          accumulated_cost: 0
        },
        created_by: request.user.id
      })

    if (revErr) return reply.code(500).send({ error: revErr.message })

    await db.from('records').update({ status: 'converted' }).eq('id', lead.id)

    await db.from('audit_log').insert([
      {
        record_id: lead.id,
        record_type: 'lead',
        action: 'converted',
        actor_id: request.user.id,
        detail: { to_test_bed_id: record.id }
      },
      {
        record_id: record.id,
        record_type: 'test_bed',
        action: 'created_from_lead',
        actor_id: request.user.id,
        detail: { from_lead_id: lead.id, initial_stage: 'NDA' }
      }
    ])

    return reply.code(201).send(record)
  })
}
