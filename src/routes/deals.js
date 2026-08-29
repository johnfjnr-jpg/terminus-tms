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
import { resolveCurrentBatches, catalogToRates } from '../lib/base-costs.js';
import { sendWriteError } from '../lib/write-errors.js'
import { appendRecordRevision, SINGLE_KEY_RMW, CLIENT_UNWIRED } from '../lib/record-revision.js';
import { calculateDeal } from '../lib/deal-calculator.js';
import { buildDealInputs } from '../lib/deal-inputs.js';
import { resolveRates } from '../lib/rate-resolution.js';

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

  // Milestone 5: this loader never queried opportunity_details at all
  // before now (confirmed by direct inspection - test_bed_cost was
  // written on conversion but nothing downstream ever read it). Missing
  // row or null value both mean "not converted from a Test Bed", 0 cost,
  // not an error - most Opportunities have no opportunity_details.test_bed_cost.
  const { data: details } = await db
    .from('opportunity_details')
    .select('test_bed_cost')
    .eq('record_id', opportunityId)
    .maybeSingle();
  const testBedCost = details?.test_bed_cost ?? 0;

  if (revErr || !revision) {
    throw new Error(`Opportunity ${opportunityId} has no revisions`);
  }

  const payload = revision.payload ?? {};

  // Base Cost Data, Round 36 Phase 2. The rates were read from the payload
  // until this round, where nothing ever wrote them, so every recompute this
  // function fed was arithmetic on absent inputs.
  //
  // CHANGED HERE AS WELL AS ON THE TAB, and not because anything calls it
  // today. POST /api/deals/submit has been unreachable from the UI since Round
  // 3 Phase 4 removed its button. That is exactly the Architecture rule 8
  // shape: leaving this reading the payload would be correct for every caller
  // that exists and wrong the moment submit is wired, and the failure would be
  // a live preview and an authoritative snapshot disagreeing about the price of
  // a deal, which is the one thing this function exists to prevent.
  //
  // The error is checked. An unchecked read here would degrade to "no rates",
  // which renders as $0 and is indistinguishable from a genuinely free product.
  const { data: batchRows, error: batchErr } = await db
    .from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost, install_cost_existing, install_cost_new, hosting_cost_month');

  if (batchErr) {
    throw new Error(`Base Cost Data could not be read: ${batchErr.message}`);
  }

  const asOf = new Date().toISOString().slice(0, 10);
  const { rates: catalogRates, missing: catalogMissing } =
    catalogToRates(resolveCurrentBatches(batchRows ?? [], asOf));

  // ── ONE TRANSLATION ──────────────────────────────────────────────────
  //
  // Round 38: the eighty lines that stood here were a second copy of
  // frontend/opportunity-deal.js's buildDealInputs, and the comment above them
  // said so - "kept identical to the client-side buildDealInputs()". Measured
  // across eight payload shapes before merging, including every installResp
  // branch, blanks-as-null and numeric strings: the two agreed on all eight. The
  // claim held. It is still a second path, and Architecture rule 3 is about the
  // one that has not disagreed yet.
  //
  // The shared function reads rates as ordinary payload keys, which is what
  // readPayload() on the tab writes. This caller merges TODAY'S catalog in,
  // which is what it has always done and is right for an authoritative
  // recompute: submit prices at current rates, not at whatever was stored.
  //
  // RATES WIN OVER THE PAYLOAD, deliberately, and the spread order is the whole
  // rule. Round 36 found the payload's own rate keys were never written by
  // anything, so every recompute was arithmetic on absent inputs; letting a
  // stale stored rate override the catalog here would put that back.
  // catalogToRates already keys its output by the payload's own rate names
  // (PRODUCT_RATE_KEYS), so the spread IS the merge. No adapter, and no second
  // place where a rate key could be renamed on one side only.
  // WAS { ...payload, ...catalogRates }: a merge at the call site, in one of
  // two places doing it, which is Verification 20 waiting to happen. The
  // resolver answers "where does this rate come from" once and the payload
  // never carries a catalog figure again.
  const resolution = resolveRates(payload, catalogRates);
  const dealInputs = buildDealInputs(payload, { testBedCost, rates: resolution.rates });

  // catalogMissing travels with the inputs rather than being swallowed. A
  // product with no batch prices at 0, and a caller that cannot see the
  // difference between that and a free product is the Phase 0 fault again.
  return { dealInputs, revisionNumber: revision.revision_number, payload, catalogMissing };
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
    testBedCost: { type: 'number' },
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

    let dealInputs, payload, revisionNumber;
    try {
      ({ dealInputs, payload, revisionNumber } = await loadDealInputsFromOpportunity(db, opportunityId));
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
    //
    // Round 17A Phase 1: written through the one atomic writer. The whole
    // payload goes in as the patch, which is what re-stamping means here.
    // The revision number this route used to compute came from
    // loadDealInputsFromOpportunity's read and is no longer destructured at
    // all: the number is the database's to choose, from its own read, inside
    // the same statement as the merge. The loader still returns it for any
    // other caller.
    const { data: newRevision, error: revErr } = await appendRecordRevision(
      db, opportunityId, payload, request.user.id, [],
      // NOT a single-key write and NOT append-only: `payload` is the record's
      // WHOLE payload as read by loadDealInputsFromOpportunity, re-stamped as a
      // new revision. Writing it back merges old values over every key, so a
      // concurrent write landing between that read and this one is lost
      // entirely - the worst shape of the six that carried the APPEND_ONLY
      // label.
      //
      // The revision it read is right there in the same return, so this is
      // conditional on it. Nothing about "no screen holds a revision" made this
      // safe; the server held one and was not using it.
      revisionNumber);

    if (revErr?.code === 'PT409') {
      return reply.code(409).send({
        error: 'The Opportunity changed while this submit was being prepared. Refresh and try again.',
        stale: true,
      });
    }
    if (revErr) {
      request.log.error({ err: revErr }, 'failed to persist deal submit snapshot');
      return sendWriteError(reply, revErr);
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
