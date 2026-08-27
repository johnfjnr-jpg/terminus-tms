import { createUserClient } from '../supabase.js'
import { resolveCurrentBatches, catalogToRates } from '../lib/base-costs.js'

// Deal Sheet versions. Round 37 Phase 3.
//
// Four operations, and the shape of each follows a business decision rather
// than a convention:
//
//   GET    /opportunities/:id/deal-sheet-versions        list, newest first
//   POST   /opportunities/:id/deal-sheet-versions        save a version, reason required
//   POST   /deal-sheet-versions/:vid/issue               a draft BECOMES the issued version
//   POST   /deal-sheet-versions/:vid/restore             recall overwrites current pricing
//
// There is no DELETE, at any level. A version is the record that a decision was
// made, and the table carries no delete policy either, so the rule is stated
// twice: in the schema and in the absence of a handler.

// The sections a version can carry today. Recorded ON the version rather than
// inferred when it is read, because inferring it later would answer "what does
// the Deal Sheet show now", and the question is "what existed then".
//
// Round 37 Phase 0 measured the input set as complete except one field, so this
// list is longer than the brief expected. `warrantyTreatment` is deliberately
// absent and its absence is the point: it is the one input with no field
// anywhere, so no version can claim to carry it.
const SECTIONS = ['units', 'rates', 'margins', 'terms', 'installation', 'milestones', 'tax', 'payment']

export default async function dealSheetVersionsRoutes(app) {
  // Resolve the catalog the same way the tab and deals.js do, through the one
  // shared file, so a version freezes what the screen priced against rather
  // than a second reading of the same table.
  async function currentRates(db) {
    const { data, error } = await db
      .from('base_cost_batches')
      .select('id, product, batch_label, effective_from, unit_cost, install_cost_existing, install_cost_new, hosting_cost_month')
    if (error) throw new Error(`Base Cost Data could not be read: ${error.message}`)
    const asOf = new Date().toISOString().slice(0, 10)
    const products = resolveCurrentBatches(data ?? [], asOf)
    const { rates, missing, batches } = catalogToRates(products)
    return { rates, missing, batches, products, asOf }
  }

  app.get('/opportunities/:id/deal-sheet-versions', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { data, error } = await db
      .from('deal_sheet_versions')
      .select('id, major, minor, status, reason, sections, batch_id, created_by, created_at, issued_by, issued_at')
      .eq('record_id', request.params.id)
      .order('major', { ascending: false })
      .order('minor', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list deal sheet versions')
      return reply.code(500).send({ error: error.message })
    }
    return data ?? []
  })

  // One version's full contents, for restore and for reading an old one.
  // Separate from the list deliberately: the list is read on every tab open and
  // the payloads are large.
  app.get('/deal-sheet-versions/:vid', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { data, error } = await db
      .from('deal_sheet_versions')
      .select('*')
      .eq('id', request.params.vid)
      .maybeSingle()

    if (error) {
      request.log.error({ err: error }, 'failed to read deal sheet version')
      return reply.code(500).send({ error: error.message })
    }
    if (!data) return reply.code(404).send({ error: 'version not found' })
    return data
  })

  app.post('/opportunities/:id/deal-sheet-versions', async (request, reply) => {
    const { inputs, reason } = request.body ?? {}

    // Refused here as well as by the NOT NULL and the length CHECK. The schema
    // is what makes it true; this is what makes it a sentence the user reads
    // rather than a constraint-violation string.
    if (typeof reason !== 'string' || !reason.trim()) {
      return reply.code(400).send({ error: 'A reason is required: what changed in this version, and why.' })
    }
    if (!inputs || typeof inputs !== 'object') {
      return reply.code(400).send({ error: 'inputs is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recErr } = await db
      .from('records')
      .select('id')
      .eq('id', request.params.id)
      .eq('record_type', 'opportunity')
      .is('deleted_at', null)
      .maybeSingle()
    if (recErr) return reply.code(500).send({ error: recErr.message })
    if (!record) return reply.code(404).send({ error: 'opportunity not found' })

    let catalog
    try {
      catalog = await currentRates(db)
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }

    // The number. major carries forward; minor increments. major = 0 until
    // something is issued, which is the business's own reading of the scheme:
    // "major is issued, and zero means nothing has been".
    const { data: latest, error: latestErr } = await db
      .from('deal_sheet_versions')
      .select('major, minor')
      .eq('record_id', request.params.id)
      .order('major', { ascending: false })
      .order('minor', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestErr) return reply.code(500).send({ error: latestErr.message })

    const major = latest?.major ?? 0
    const minor = (latest?.minor ?? 0) + 1

    // batch_id: every product currently resolves to one batch, and the schema
    // holds a single pointer. Where products come from different batches the
    // pointer records the SafeSight one and `rates` carries all of them, which
    // is stated rather than left to be discovered - the alternative is a join
    // table this round does not need.
    const batchId = catalog.batches.safesight?.batch_id ?? Object.values(catalog.batches)[0]?.batch_id ?? null

    const { data: created, error: insErr } = await db
      .from('deal_sheet_versions')
      .insert({
        record_id: request.params.id,
        major,
        minor,
        status: 'draft',
        reason: reason.trim(),
        inputs,
        rates: { rates: catalog.rates, batches: catalog.batches, missing: catalog.missing, as_of: catalog.asOf },
        sections: SECTIONS,
        batch_id: batchId,
        created_by: request.user.id,
      })
      .select()
      .single()

    if (insErr) {
      request.log.error({ err: insErr }, 'failed to save deal sheet version')
      return reply.code(500).send({ error: insErr.message })
    }

    await db.from('audit_log').insert({
      record_id: request.params.id, record_type: 'opportunity',
      action: 'deal_sheet_version_saved', actor_id: request.user.id,
      detail: { version_id: created.id, label: `V${major}.${minor}` },
    })

    return reply.code(201).send(created)
  })

  // A DRAFT BECOMES THE ISSUED VERSION. An UPDATE that relabels, never a copy:
  // a copy would leave V0.4 and V1 holding the same figures, which is two
  // records of one fact.
  app.post('/deal-sheet-versions/:vid/issue', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: version, error: readErr } = await db
      .from('deal_sheet_versions')
      .select('id, record_id, major, minor, status')
      .eq('id', request.params.vid)
      .maybeSingle()
    if (readErr) return reply.code(500).send({ error: readErr.message })
    if (!version) return reply.code(404).send({ error: 'version not found' })
    if (version.status !== 'draft') {
      return reply.code(409).send({ error: 'This version has already been issued. An issued version cannot be changed.' })
    }

    // V0.4 becomes V1: the next major, minor back to zero.
    const { data: updated, error: updErr } = await db
      .from('deal_sheet_versions')
      .update({
        major: version.major + 1,
        minor: 0,
        status: 'issued',
        issued_by: request.user.id,
        issued_at: new Date().toISOString(),
      })
      .eq('id', version.id)
      .select()

    if (updErr) {
      request.log.error({ err: updErr }, 'failed to issue deal sheet version')
      return reply.code(500).send({ error: updErr.message })
    }
    // An update refused by RLS returns success with an empty set rather than an
    // error, which is the Verification 8 shape. The row count is the signal.
    if (!updated?.length) {
      return reply.code(409).send({ error: 'This version could not be issued. It may already have been issued.' })
    }

    await db.from('audit_log').insert({
      record_id: version.record_id, record_type: 'opportunity',
      action: 'deal_sheet_version_issued', actor_id: request.user.id,
      detail: { version_id: version.id, from: `V${version.major}.${version.minor}`, to: `V${version.major + 1}` },
    })

    return updated[0]
  })

  // RESTORE, not a read-only view. It overwrites the current pricing, which is
  // what the business asked for during a negotiation.
  //
  // The unsaved-work question is answered on the CLIENT, using the discard
  // dialogue Round 28 built and Round 34 extended, rather than by a second
  // mechanism here. This endpoint is the write; refusing to reach it while
  // there are unsaved changes is the guard's job, and adding a server-side
  // "are you sure" would be the third pattern that instruction warns against.
  app.post('/deal-sheet-versions/:vid/restore', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: version, error: readErr } = await db
      .from('deal_sheet_versions')
      .select('id, record_id, major, minor, inputs')
      .eq('id', request.params.vid)
      .maybeSingle()
    if (readErr) return reply.code(500).send({ error: readErr.message })
    if (!version) return reply.code(404).send({ error: 'version not found' })

    return {
      version_id: version.id,
      record_id: version.record_id,
      label: version.major === 0 ? `V0.${version.minor}` : (version.minor === 0 ? `V${version.major}` : `V${version.major}.${version.minor}`),
      inputs: version.inputs,
    }
  })
}
