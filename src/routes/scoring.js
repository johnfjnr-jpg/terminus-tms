import { createUserClient } from '../supabase.js'

export default async function scoringRoutes(app) {
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
      .select('id, record_type, criterion_key, name, asks, sort_order, rescore_through_stage')
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

    return criteria.map(c => {
      const versions = byCriterion[c.id] ?? {}
      const versionNumbers = Object.keys(versions).map(Number).sort((a, b) => a - b)
      return {
        ...c,
        anchors: versions,
        current_version: versionNumbers.length ? versionNumbers[versionNumbers.length - 1] : null,
      }
    })
  })
}
