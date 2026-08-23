import { createUserClient } from '../supabase.js'
import { DEFAULT_LEVELS, resolveLevels } from '../lib/scoring-levels.js'

export default async function scoringRoutes(app) {
  // GET /api/scoring-lenses
  //
  // Round 25 Phase 5. The lens vocabulary, for the Assessment tab's sub-tabs.
  //
  // A route rather than four names in the frontend. Round A made lenses a
  // table precisely so the set is data: hardcoding them here would contradict
  // that on the first screen that renders them, and a fifth lens would then
  // need a deploy rather than a row.
  //
  // Not scoped by record_type: a lens is a way of reading criteria and is not
  // owned by a record type. Test Bed's five criteria carry a null lens_id and
  // simply never ask.
  app.get('/scoring-lenses', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { data, error } = await db
      .from('scoring_lenses')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list scoring lenses')
      return reply.code(500).send({ error: error.message })
    }
    return data ?? []
  })

  // GET /api/scoring-criteria?record_type=test_bed
  //
  // Round 11 Phase 1/2, 2026-08-19. Admin-managed reference data, read-only
  // from this API, edited directly via Supabase's own editor for now - the
  // same deferral industries and terminus_staff already carry, and the same
  // shape as GET /api/industries rather than a new convention.
  //
  // Anchors are returned WITH their criterion and grouped by version, so a
  // caller can resolve the wording a historical score was made against
  // without a second round trip. The current version is max(version),
  // computed here rather than stored, so changing the wording is an insert
  // and never an update to a "current" flag that could drift.
  app.get('/scoring-criteria', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const recordType = request.query?.record_type ?? 'test_bed'

    const { data: criteria, error } = await db
      .from('scoring_criteria')
      .select('id, record_type, criterion_key, name, asks, sort_order, rescore_through_stage, scale_id, lens_id')
      .eq('record_type', recordType)
      .order('sort_order', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list scoring criteria')
      return reply.code(500).send({ error: error.message })
    }
    if (!criteria.length) return []

    const { data: anchors, error: anchorErr } = await db
      .from('scoring_anchors')
      .select('criterion_id, version, score, wording')
      .in('criterion_id', criteria.map(c => c.id))

    // A read whose error is unchecked is at least visibly empty, but this one
    // would present as "this criterion has no anchors", which is materially
    // different from "the anchors could not be read" - and the score endpoint
    // refuses to record against a criterion with no anchors.
    if (anchorErr) {
      request.log.error({ err: anchorErr }, 'failed to list scoring anchors')
      return reply.code(500).send({ error: anchorErr.message })
    }

    const byCriterion = {}
    for (const a of anchors ?? []) {
      (byCriterion[a.criterion_id] ??= {})
      ;(byCriterion[a.criterion_id][a.version] ??= {})[a.score] = a.wording
    }

    // Round 24 Phase 2: LEVELS, resolved here and nowhere else.
    //
    // This is the single place the 1-to-5 default lives. It was previously
    // written twice in the frontend and once as a range check on the server,
    // and a criterion with a different number of levels could not be
    // expressed. Callers now read `levels` and never assume a count.
    //
    // A null scale_id means the legacy 1 to 5, with the level number as its
    // own label, which is exactly what the panel rendered before this. That
    // default is applied to ANY criterion without a scale, so it holds for
    // rows created long after this migration rather than only for the five
    // that existed when it ran.
    // Round 24 Phase 3: resolved through the shared helper, so the default and
    // its reason-required flags have ONE definition rather than one per route.
    //
    // Checked, and not merely because every error should be. An unchecked
    // failure here would present as "this scale has no levels", and a
    // criterion with no levels renders a select with nothing in it, which
    // reads as a criterion that cannot be scored rather than as a read that
    // did not happen.
    // Round 24 Phase 5: the stages a criterion is shown and scoreable at.
    //
    // Returned WITH the criteria rather than behind a ?stage= filter, because
    // the panel caches this response once per record and re-renders per stage
    // tab. A per-stage endpoint would turn one fetch into eight.
    const { data: stageRows, error: stageErr } = await db
      .from('scoring_criterion_stages')
      .select('criterion_id, stage, required')
      .in('criterion_id', criteria.map(c => c.id))

    // An unchecked failure here would present as "this criterion appears at no
    // stage", which renders an empty panel: indistinguishable from a stage
    // that genuinely has no criteria, and wrong in a way nobody would query.
    if (stageErr) {
      request.log.error({ err: stageErr }, 'failed to list scoring criterion stages')
      return reply.code(500).send({ error: stageErr.message })
    }
    const stagesByCriterion = {}
    for (const r of stageRows ?? []) {
      (stagesByCriterion[r.criterion_id] ??= []).push({ stage: r.stage, required: r.required })
    }

    const scaleIds = [...new Set(criteria.map(c => c.scale_id).filter(Boolean))]
    const levelsByScale = {}
    for (const scaleId of scaleIds) {
      const { levels, error: levelErr } = await resolveLevels(db, scaleId)
      if (levelErr) {
        request.log.error({ err: levelErr }, 'failed to list scoring scale levels')
        return reply.code(500).send({ error: levelErr.message })
      }
      levelsByScale[scaleId] = levels
    }

    return criteria.map(c => {
      const versions = byCriterion[c.id] ?? {}
      const versionNumbers = Object.keys(versions).map(Number).sort((a, b) => a - b)
      return {
        ...c,
        levels: c.scale_id ? (levelsByScale[c.scale_id] ?? []) : DEFAULT_LEVELS,
        stages: stagesByCriterion[c.id] ?? [],
        anchors: versions,
        current_version: versionNumbers.length ? versionNumbers[versionNumbers.length - 1] : null,
      }
    })
  })
}
