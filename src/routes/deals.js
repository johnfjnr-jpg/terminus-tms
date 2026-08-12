/**
 * Fastify routes for deal calculation.
 * Register with: app.register(dealsRoutes, { prefix: '/api/deals' })
 *
 * Two endpoints, matching the two moments that matter:
 *   POST /calculate - called on every input change for live preview.
 *                      No auth requirement beyond being logged in, no
 *                      persistence, just returns numbers.
 *   POST /submit     - called when the user commits an Opportunity's
 *                      figures (e.g. moving a stage, saving a snapshot).
 *                      Recomputes server-side from the same raw inputs
 *                      the client sent, and rejects if the client's
 *                      displayed totals do not match the recompute.
 *                      This is the non-negotiable principle from the
 *                      original spec: never trust client-submitted
 *                      numbers for something an approval decision
 *                      rests on.
 */

import { createUserClient } from '../supabase.js';
import { calculateDeal } from '../lib/deal-calculator.js';

/**
 * Loads an Opportunity's complete pricing state from Supabase and
 * builds the full input object calculateDeal() expects. This is the
 * one function /submit relies on for correctness, everything it
 * returns comes from the database, not the client.
 *
 * Storage decision, per John (2026-08-11): deal-calculator inputs live in
 * record_revisions.payload (jsonb), the same generic-engine pattern
 * leads.js/opportunities.js already use for other Opportunity fields -
 * there is no separate opportunities table or dedicated pricing columns.
 *
 * Field names below are not yet confirmed against any real persisted
 * Opportunity (no code path writes this payload shape today - see the
 * gap this leaves, noted where lumpSumDeal is derived below). They're
 * reconstructed from Prototype-110826/Terminus Ops.dc.html, the file
 * deal-calculator.js was ported from, specifically the oppUnits/
 * oppMargins/oppTerms/oppPayment/oppFactoring state shapes and
 * buildOppDetail() (search that file for the same key names to verify).
 *
 * Margin model, per John (2026-08-11): every Opportunity starts from
 * a target margin, but the salesperson can override the percentage
 * on individual lines - confirmed as one JSON object keyed by line
 * (marginOverrides), e.g. { hwSs: 30, inSsEx: 20, hoSs: 30 }. Missing
 * keys fall back to the Opportunity's target margin. Hardware lines
 * (hwSs/hwAqm/hwHemir/hwWarranty) override independently, same as
 * install/hosting lines - this mirrors the prototype's mg[k] object
 * exactly (Terminus Ops.dc.html:6459, marginOf()).
 *
 * @param {object} db - user-scoped Supabase client (createUserClient(request.jwt))
 * @param {string} opportunityId
 */
async function loadDealInputsFromOpportunity(db, opportunityId) {
  const { data: record, error: recordErr } = await db
    .from('records')
    .select('id')
    .eq('id', opportunityId)
    .eq('record_type', 'opportunity')
    .maybeSingle();

  if (recordErr || !record) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  const { data: revision, error: revErr } = await db
    .from('record_revisions')
    .select('revision_number, payload')
    .eq('record_id', opportunityId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (revErr || !revision) {
    throw new Error(`Opportunity ${opportunityId} has no revisions`);
  }

  const payload = revision.payload ?? {};

  const targetMargin = payload.targetMargin ?? 30;
  const overrides = payload.marginOverrides ?? {};
  const marginFor = (key) => overrides[key] ?? targetMargin;

  const ssExisting = payload.ssExisting ?? 0;
  const ssNew = payload.ssNew ?? 0;
  const aqmUnits = payload.aqm ?? 0;
  const hemirUnits = payload.hemir ?? 0;

  // The prototype derives this from the free-text install-responsibility
  // field containing 'Lump Sum' (Terminus Ops.dc.html:6497). Flagging
  // since a free-text substring match is fragile as a persisted field -
  // worth confirming installResp stays a fixed set of values.
  const lumpSumDeal = (payload.installResp ?? '').includes('Lump Sum');

  // Lump Sum must be its own branch, not folded into the isPerUnit check -
  // isPerUnit is only true for 'Terminus Installation Team', so Lump Sum
  // was previously falling through to the zero-cost 'inNone' line, meaning
  // installGroup (and everything downstream) silently priced Lump Sum
  // installation at $0 server-side too. Kept identical to the client-side
  // buildDealInputs() in frontend/opportunity-deal.js - the submit-recompute
  // architecture depends on both branching the same way for the same input.
  const installLineItems = lumpSumDeal ? [
    { key: 'inLump', cost: payload.lumpSumCost ?? 0, marginPct: marginFor('inLump') },
  ] : payload.isPerUnit ? [
    { key: 'inSsEx', cost: (payload.inSsExisting ?? 0) * ssExisting, marginPct: marginFor('inSsEx') },
    { key: 'inSsNew', cost: (payload.inSsNew ?? 0) * ssNew, marginPct: marginFor('inSsNew') },
    { key: 'inAqm', cost: (payload.inAqm ?? 0) * aqmUnits, marginPct: marginFor('inAqm') },
    { key: 'inHemir', cost: (payload.inHemir ?? 0) * hemirUnits, marginPct: marginFor('inHemir') },
  ] : [
    { key: 'inNone', cost: 0, marginPct: marginFor('inNone') },
  ];

  const hostingLineItems = [
    { key: 'hoSs', cost: (payload.hoSafesight ?? 0) * (ssExisting + ssNew), marginPct: marginFor('hoSs') },
    { key: 'hoAqm', cost: (payload.hoAqm ?? 0) * aqmUnits, marginPct: marginFor('hoAqm') },
    { key: 'hoHemir', cost: (payload.hoHemir ?? 0) * hemirUnits, marginPct: marginFor('hoHemir') },
  ];

  const factoring = payload.factoring ?? {};

  const dealInputs = {
    ssUnitCost: payload.ssUnitCost ?? 0,
    ssUnits: ssExisting + ssNew,
    aqUnitCost: payload.aqUnitCost ?? 0,
    aqUnits: aqmUnits,
    hemirUnitCost: payload.hemirUnitCost ?? 0,
    hemirUnits,
    warrantyPct: payload.warrantyPct ?? 2,
    installLineItems,
    hostingLineItems,
    hardwareMargins: {
      hwSs: marginFor('hwSs'),
      hwAqm: marginFor('hwAqm'),
      hwHemir: marginFor('hwHemir'),
      hwWarranty: marginFor('hwWarranty'),
    },
    months: payload.duration ?? 0,
    structure: payload.structure ?? 'twoPhase',
    recoveryMonths: payload.recoveryMonths,
    annualInvoicing: (payload.invoicing ?? 'annual') === 'annual',
    milestones: payload.milestones ?? [],
    lumpSumDeal,
    lumpCost: payload.lumpSumCost ?? 0,
    contractorMilestones: payload.contractorMilestones ?? [],
    factoringEnabled: factoring.enabled ?? false,
    factoringRatePct: factoring.ratePct ?? 1.5,
    factoringTermMonths: factoring.termMonths,
    factoringMethod: factoring.method ?? 'straight',
    whtPct: payload.whtPct ?? 0,
    gstPct: payload.gstPct ?? 0,
    grossUp: payload.grossUp ?? false,
  };

  return { dealInputs, revisionNumber: revision.revision_number, payload };
}

// Adjust this import to wherever your existing JWT verification helper
// lives. jose is already a dependency, so this is likely a thin wrapper
// you already have, or a few lines using jose directly.
// import { verifyRequestToken } from '../lib/auth.js';

const dealInputSchema = {
  type: 'object',
  required: [
    'ssUnitCost', 'ssUnits', 'aqUnitCost', 'aqUnits', 'hemirUnitCost', 'hemirUnits',
    'months', 'structure',
  ],
  properties: {
    ssUnitCost: { type: 'number' },
    ssUnits: { type: 'number' },
    aqUnitCost: { type: 'number' },
    aqUnits: { type: 'number' },
    hemirUnitCost: { type: 'number' },
    hemirUnits: { type: 'number' },
    warrantyPct: { type: 'number' },
    installLineItems: { type: 'array' },
    hostingLineItems: { type: 'array' },
    hardwareMargins: {
      type: 'object',
      properties: {
        hwSs: { type: 'number' },
        hwAqm: { type: 'number' },
        hwHemir: { type: 'number' },
        hwWarranty: { type: 'number' },
      },
    },
    months: { type: 'number' },
    structure: { type: 'string', enum: ['single', 'twoPhase', 'hybrid'] },
    recoveryMonths: { type: 'number' },
    annualInvoicing: { type: 'boolean' },
    milestones: { type: 'array' },
    lumpSumDeal: { type: 'boolean' },
    lumpCost: { type: 'number' },
    contractorMilestones: { type: 'array' },
    factoringEnabled: { type: 'boolean' },
    factoringRatePct: { type: 'number' },
    factoringTermMonths: { type: 'number' },
    factoringMethod: { type: 'string', enum: ['straight', 'declining'] },
    whtPct: { type: 'number' },
    gstPct: { type: 'number' },
    grossUp: { type: 'boolean' },
  },
};

export default async function dealsRoutes(app) {
  // Live preview, no persistence, no server-authoritative claim.
  // Auth is enforced by the requireAuth onRequest hook this module is
  // registered under in server.js, not per-route here.
  app.post('/calculate', { schema: { body: dealInputSchema } }, async (request, reply) => {
    const result = calculateDeal(request.body);
    return reply.send(result);
  });

  // Authoritative recompute on submit. This is the one that actually
  // protects the integrity principle. The client sends only the
  // Opportunity ID (and optionally what it displayed, for the mismatch
  // check below), every figure used in the calculation is loaded fresh
  // from the database, none of it is trusted from the request body.
  app.post('/submit', {
    schema: {
      body: {
        type: 'object',
        required: ['opportunityId'],
        properties: {
          opportunityId: { type: 'string' },
          clientReportedTotals: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const { opportunityId, clientReportedTotals } = request.body;
    const db = createUserClient(request.jwt);

    let dealInputs, revisionNumber, payload;
    try {
      ({ dealInputs, revisionNumber, payload } = await loadDealInputsFromOpportunity(db, opportunityId));
    } catch (err) {
      request.log.warn({ err, opportunityId }, 'Deal submit: could not load Opportunity');
      return reply.code(404).send({ error: err.message });
    }

    const serverResult = calculateDeal(dealInputs);

    if (clientReportedTotals) {
      const tolerance = 1; // whole dollar rounding differences are acceptable
      const mismatch = Math.abs(
        (clientReportedTotals.contractNet ?? 0) - serverResult.totals.contractNet
      ) > tolerance
        || Math.abs(
          (clientReportedTotals.achievedMargin ?? 0) - serverResult.achievedMargin
        ) > 0.1;

      if (mismatch) {
        request.log.warn(
          { clientReportedTotals, serverTotals: serverResult.totals, oppId: opportunityId },
          'Deal submit rejected: client-reported totals did not match server recompute'
        );
        return reply.code(409).send({
          error: 'recompute_mismatch',
          message: 'The figures you submitted do not match the server recompute. Refresh and try again.',
          serverResult,
        });
      }
    }

    // Immutable-snapshot principle: re-stamp the same payload as a new
    // revision rather than updating the existing one (record_revisions
    // has no UPDATE/DELETE RLS policy - deny-by-default). This gives the
    // submitted figures their own revision_number for the approvals
    // table to reference, same pattern transitions.js relies on.
    const { data: newRevision, error: revErr } = await db
      .from('record_revisions')
      .insert({
        record_id: opportunityId,
        revision_number: revisionNumber + 1,
        payload,
        created_by: request.user.id,
      })
      .select('revision_number')
      .single();

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to persist deal submit snapshot');
      return reply.code(500).send({ error: revErr.message });
    }

    await db.from('audit_log').insert({
      record_id: opportunityId,
      record_type: 'opportunity',
      action: 'deal_submitted',
      actor_id: request.user.id,
      detail: {
        revision_number: newRevision.revision_number,
        contractNet: serverResult.totals.contractNet,
        achievedMargin: serverResult.achievedMargin,
      },
    });

    return reply.send({ ...serverResult, revision_number: newRevision.revision_number });
  });
}
