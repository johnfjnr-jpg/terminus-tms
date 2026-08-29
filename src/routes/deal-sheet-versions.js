import { createUserClient } from '../supabase.js'
import { versionApprovalState, liveVersionApproval, APPROVAL_TRACK } from '../lib/version-approval.js'
import { buildApprovalPage } from '../lib/approval-page.js'
import { scheduleReconciliation, refusalStatement } from '../lib/milestone-schedule.js';
import { resolveRates, frozenRates, frozenRatesAgree } from '../lib/rate-resolution.js';
import { toNumberOrNull } from '../lib/numeric-payload.js'
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
      .select('id, major, minor, status, reason, sections, batch_id, revision_number, created_by, created_by_email, created_at, issued_by, issued_by_email, issued_at')
      .eq('record_id', request.params.id)
      .order('major', { ascending: false })
      .order('minor', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list deal sheet versions')
      return reply.code(500).send({ error: error.message })
    }
    const versions = data ?? []
    if (!versions.length) return []

    // The two facts the approval state is derived from. Both reads are checked:
    // an unchecked read here would make "no approvals" and "the query failed"
    // the same answer, and the second one renders as an unapproved deal.
    const { data: latestRev, error: revErr } = await db
      .from('record_revisions')
      .select('revision_number')
      .eq('record_id', request.params.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (revErr) {
      request.log.error({ err: revErr }, 'failed to read the current revision for version approval state')
      return reply.code(500).send({ error: revErr.message })
    }

    const { data: approvals, error: apprErr } = await db
      .from('approvals')
      .select('revision_number, track, decision, approver_id, decided_at')
      .eq('record_id', request.params.id)
      .eq('track', APPROVAL_TRACK)
    if (apprErr) {
      request.log.error({ err: apprErr }, 'failed to read approvals for version approval state')
      return reply.code(500).send({ error: apprErr.message })
    }

    const latest = latestRev?.revision_number ?? null
    return versions.map((v) => ({
      ...v,
      // Derived on every read, never stored. See src/lib/version-approval.js.
      approval: versionApprovalState(v, approvals ?? [], latest),
    }))
  })

  // ── GET /api/opportunities/:id/approval-page ─────────────────────────────
  //
  // Everything a commercial approver needs on one page, derived from what
  // approval exists to CATCH rather than from the order the calculation runs in.
  // The five blocks and the reasoning are in src/lib/approval-page.js; this
  // route only reads.
  //
  // READ-ONLY AND DERIVED ON EVERY REQUEST. Nothing here is stored, because
  // every input to it already is: the record's payload, the approved version's
  // own inputs and rates, the catalog, the approvals. A stored approval page
  // would be a sixth thing to keep true.
  app.get('/opportunities/:id/approval-page', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recErr } = await db
      .from('records')
      .select('id, reference_code, status')
      .eq('id', request.params.id).eq('record_type', 'opportunity')
      .is('deleted_at', null).maybeSingle()
    if (recErr) return reply.code(500).send({ error: recErr.message })
    if (!record) return reply.code(404).send({ error: 'opportunity not found' })

    // The revision history, newest first. Used for the payload AND for dating
    // the last target change, so it is read once.
    //
    // THE WINDOW IS 200 AND IT IS STATED. A paged read that silently stops is
    // indistinguishable from one that found nothing (Verification 17), so when
    // the walk below exhausts this window without finding a different target,
    // it reports "not found in the last 200 revisions" rather than a date it
    // does not have.
    const REVISION_WINDOW = 200
    const { data: revisions, error: revErr } = await db
      .from('record_revisions')
      .select('revision_number, payload, created_at')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(REVISION_WINDOW)
    if (revErr) return reply.code(500).send({ error: revErr.message })
    if (!revisions?.length) return reply.code(409).send({ error: 'this Opportunity has no revisions' })

    const latest = revisions[0]
    const payload = latest.payload ?? {}

    const { data: details } = await db
      .from('opportunity_details').select('test_bed_cost')
      .eq('record_id', record.id).maybeSingle()

    let catalog
    try { catalog = await currentRates(db) } catch (err) {
      return reply.code(500).send({ error: err.message })
    }

    const { data: versions, error: vErr } = await db
      .from('deal_sheet_versions')
      .select('id, major, minor, status, reason, revision_number, inputs, rates, created_by_email, created_at')
      .eq('record_id', record.id)
      .order('major', { ascending: false }).order('minor', { ascending: false })
    if (vErr) return reply.code(500).send({ error: vErr.message })

    const { data: approvals, error: aErr } = await db
      .from('approvals')
      .select('revision_number, track, decision, approver_id, decided_at')
      .eq('record_id', record.id).eq('track', APPROVAL_TRACK)
    if (aErr) return reply.code(500).send({ error: aErr.message })

    const latestNumber = latest.revision_number
    const version = (versions ?? [])[0] ?? null

    // THROUGH THE SAME ENTRY POINT THE GATE USES. Verification 20, applied to
    // something this round created: liveVersionApproval was written for the
    // stage gate and this page kept assembling the same answer from the two
    // functions underneath it. Two paths, agreeing today. The page takes the
    // version it returns as block 2's baseline and its detail as the state.
    const live = liveVersionApproval({
      track: APPROVAL_TRACK, versions: versions ?? [], approvals: approvals ?? [], latestRevision: latestNumber,
    })
    const baseline = live.version
      ? { ...live.version, approval: live.detail ?? versionApprovalState(live.version, approvals ?? [], latestNumber) }
      : null

    // WHEN THE TARGET LAST MOVED. Walking newest to oldest, the first revision
    // holding a different target is the one before the change, so the change
    // landed on the revision after it.
    const currentTarget = toNumberOrNull(payload.targetMargin)
    let targetChangedAt = null
    let targetChangedWindowExhausted = false
    for (let i = 1; i < revisions.length; i++) {
      if (toNumberOrNull(revisions[i].payload?.targetMargin) !== currentTarget) {
        targetChangedAt = String(revisions[i - 1].created_at).slice(0, 10)
        break
      }
      if (i === revisions.length - 1 && revisions.length === REVISION_WINDOW) {
        targetChangedWindowExhausted = true
      }
    }

    const page = buildApprovalPage({
      // The catalog is merged in exactly as the tab and the submit route do it,
      // so the page prices the CURRENT deal at current rates. The baseline is
      // deliberately NOT re-rated: a version carries the rates it was priced at,
      // which is what makes the bridge's cost-basis step a real number.
      // The payload alone. The approval page resolves rates itself now, so
      // this stops being the second place that merges a catalog into a record.
      payload,
      testBedCost: details?.test_bed_cost ?? 0,
      version: version
        ? { ...version, approval: versionApprovalState(version, approvals ?? [], latestNumber) }
        : null,
      baseline,
      targetChangedAt,
      catalog: { batches: catalog.batches, missing: catalog.missing, asOf: catalog.asOf },
      record: { reference_code: record.reference_code, status: record.status },
    })

    return {
      ...page,
      meta: {
        revisionNumber: latestNumber,
        revisionsRead: revisions.length,
        targetChangedAt,
        targetChangeNotFoundWithin: targetChangedWindowExhausted ? REVISION_WINDOW : null,
      },
    }
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
    const { inputs, reason, rates: clientRates, expected_revision: expectedRevision } = request.body ?? {}

    // Refused here as well as by the NOT NULL and the length CHECK. The schema
    // is what makes it true; this is what makes it a sentence the user reads
    // rather than a constraint-violation string.
    if (typeof reason !== 'string' || !reason.trim()) {
      // NEUTRAL HERE, SPECIFIC ON THE SCREEN. The client asks a different
      // question on a first version than on a later one (src/lib/version-reason.js)
      // and refuses with the matching sentence before any request is made. This
      // is the fallback for a caller that is not that screen, and it must not
      // assert "what changed" at somebody pricing a deal for the first time.
      return reply.code(400).send({ error: 'A reason is required for every version.' })
    }
    if (!inputs || typeof inputs !== 'object') {
      return reply.code(400).send({ error: 'inputs is required' })
    }

    // THE REVISION THIS VERSION IS TAKEN FROM. Required, not optional, because
    // an approval of a version is an approval of the revision it names and a
    // version naming nothing cannot be approved at all.
    //
    // The client has this number without a read: taking a version saves the
    // record first, and that save returns the revision it wrote.
    if (!Number.isInteger(expectedRevision)) {
      return reply.code(400).send({
        error: 'expected_revision is required: a version records the revision it was taken from.',
      })
    }

    // ── A VERSION MAY NOT CARRY A SCHEDULE THAT DOES NOT RECONCILE ──────
    //
    // Round 39. The client refuses this too, earlier and with better wording,
    // and that is not the control: a control that only exists in a browser is
    // not one. Same evaluator as the screen, imported rather than restated,
    // because two implementations of "does this add up" would agree today.
    //
    // Scoped to a schedule that EXISTS. Only Lump Sum deals have a contractor
    // schedule at all, so an unconditional check would refuse almost every
    // version for a table that was never meant to be filled in.
    const contractorRec = scheduleReconciliation(inputs.contractorMilestones, inputs.lumpSumCost)
    if (contractorRec.hasSchedule && !contractorRec.reconciles) {
      return reply.code(400).send({
        error: refusalStatement(contractorRec, 'The contractor payment schedule'),
      })
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

    // ── THE VERSION MUST CARRY THE COSTS IT WAS PRICED AT ────────────────
    //
    // The database floor (deal_sheet_versions_has_cost_basis) refuses a version
    // with NO rate at all. This is the exact rule, and it lives here because
    // only this point knows which products actually resolved: every key the
    // catalog produced must be in inputs.
    //
    // WHY IT IS CHECKED RATHER THAN FILLED IN. Overwriting inputs with the
    // catalog read here would make every version reproducible by construction
    // and mean nothing: the version would record what the SERVER resolved at
    // save time, not what the screen priced against, and the two can differ
    // whenever a batch turns over mid-session. A version that silently disagrees
    // with what the salesperson saw is the fault versions exist to prevent.
    // ── THE HONESTY TEST, RUN AT VERSION TIME ────────────────────────────
    //
    // SUPERSEDES the check that required inputs to carry every catalog rate.
    // That was correct while rates lived in the payload; Round 40 Phase 1b took
    // them out, so the same check would now refuse every version. The REASON it
    // existed is unchanged and is preserved above: a version must record what
    // the salesperson's screen priced against, not what the server resolved a
    // moment later, and the two differ whenever a batch turns over mid-session.
    //
    // So the client sends the rates it priced with, and the server resolves the
    // same record against the same catalog and refuses if they disagree. The
    // business's own words: a version's stored rates equal what the resolver
    // produces from that record and that catalog at that moment.
    //
    // Absent client rates is not a pass. A caller that sends none is refused
    // rather than trusted, because "no disagreement" and "nothing to compare"
    // are the two states Verification 14 exists to separate.
    const resolution = resolveRates(inputs, catalog.rates ?? {})
    if (!clientRates || typeof clientRates !== 'object') {
      return reply.code(400).send({
        error: 'rates is required: a version records the rates its screen priced against, '
          + 'so the server can confirm they still agree with the catalog.',
      })
    }
    const agreement = frozenRatesAgree(clientRates, resolution)
    if (!agreement.agree) {
      return reply.code(409).send({
        error: 'The Base Cost Data changed while this deal was open, so the screen and the server '
          + 'disagree about what it costs. Reload the Commercials tab and take the version again.',
        differing: agreement.differing,
      })
    }

    // ── ONE STATEMENT, UNDER THE RECORD'S OWN LOCK ───────────────────────
    //
    // The numbering rule has moved with the numbering: major carries forward,
    // minor increments, and major = 0 until something is issued, which is the
    // business's own reading of the scheme - "major is issued, and zero means
    // nothing has been". It now lives in insert_deal_sheet_version because that
    // is where the read it depends on happens.
    //
    // The revision check, the version numbering and the insert all happen inside
    // insert_deal_sheet_version, which takes the same advisory lock
    // append_record_revision takes. Two things follow that the route could not
    // give on its own:
    //
    //   No revision can land between the check and the insert, so a version
    //   cannot be born naming a revision the record has already left.
    //
    //   Two concurrent versions cannot read the same highest number. That race
    //   was previously caught by the unique constraint and surfaced as a raw
    //   23505, which is a collision handled rather than removed.
    //
    // The route no longer reads the record's revision or the latest version
    // number at all. Both reads existed only to supply values the function now
    // computes inside the lock, and keeping them would be a second path that
    // agrees today.
    const batchId = catalog.batches.safesight?.batch_id ?? Object.values(catalog.batches)[0]?.batch_id ?? null

    const { data: created, error: insErr } = await db.rpc('insert_deal_sheet_version', {
      p_record_id: request.params.id,
      p_expected_revision: expectedRevision,
      p_reason: reason.trim(),
      p_inputs: inputs,
      // ── THE RECORD STORES THE INPUT, THE VERSION STORES THE OUTPUT ────
      //
      // The business's ruling, Round 40 Phase 1b. The two artefacts hold
      // different facts and neither is a copy of the other:
      //
      //   the record  -> the DECISION: overridden, or not. It changes when
      //                  somebody decides differently.
      //   the version -> the PRICE: priced at these rates. It never changes.
      //
      // "The record holds what the deal decided, the catalog holds what things
      // cost, a version holds both, frozen."
      //
      // AND IT RECORDS WHICH WERE OVERRIDDEN, not only the effective numbers.
      // Once the catalog moves, an approver reading an old version cannot
      // otherwise tell whether $4,000 was a quotation somebody obtained or the
      // catalog figure of the day. The approval page needs that distinction and
      // the version is the only place it survives.
      p_rates: {
        ...frozenRates(resolution),
        batches: catalog.batches,
        missing: catalog.missing,
        as_of: catalog.asOf,
      },
      p_sections: SECTIONS,
      p_batch_id: batchId,
      p_created_by: request.user.id,
      // The email beside the uuid, the same convention assessment entries and
      // Notes History already use, because auth.users is not readable from the
      // client and a version's author has to be legible in the list.
      p_created_by_email: request.user.email ?? null,
    })

    if (insErr?.code === 'PT409') {
      return reply.code(409).send({ error: insErr.message, stale: true })
    }
    if (insErr) {
      request.log.error({ err: insErr }, 'failed to save deal sheet version')
      return reply.code(500).send({ error: insErr.message })
    }

    await db.from('audit_log').insert({
      record_id: request.params.id, record_type: 'opportunity',
      action: 'deal_sheet_version_saved', actor_id: request.user.id,
      detail: { version_id: created.id, label: `V${created.major}.${created.minor}`, revision_number: created.revision_number },
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
        issued_by_email: request.user.email ?? null,
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
