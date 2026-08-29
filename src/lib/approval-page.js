/**
 * The commercial approval page, assembled. Round 38.
 *
 * Five blocks, in the order the business set, derived from what approval exists
 * to catch rather than from the order the calculation happens in:
 *
 *   1  THE ASK                  what is being asked for, and by whom
 *   2  WHAT MOVED IT            delta against the last approved version, and
 *                               against target
 *   3  RISK TERMS AS EXPOSURES  not as inputs
 *   4  COST BASIS AND ITS AGE   what these prices are built on, and how old
 *   5  WHAT IS NOT RECORDED     the absences, stated
 *
 * ─────────────────────────────────────────────────────────────
 * BLOCKS 4 AND 5 TREAT DEFAULTS THE OPPOSITE WAY TO THE INPUT SCREEN
 * ─────────────────────────────────────────────────────────────
 *
 * The input screen shows what WILL happen if you do nothing, so an unset field
 * renders as a placeholder: grey, obviously not a value, correct as built.
 *
 * The approval page shows what DID happen, so a default is a VALUE WITH ITS
 * PROVENANCE and never an absence. "30% (system default, set 29 August 2026)",
 * never a blank and never a bare 30%. An approver is accepting an assumption
 * somebody else made and cannot accept what they cannot see.
 *
 * THE PLACEHOLDER CONVENTION DOES NOT TRAVEL to this page or to any other
 * read-only surface. That is a rule about surfaces, not about this file.
 *
 * ─────────────────────────────────────────────────────────────
 * PURE, AND THAT IS WHAT MAKES IT TESTABLE
 * ─────────────────────────────────────────────────────────────
 *
 * Everything arrives as an argument: the current payload, the last approved
 * version, the catalog, the record. No database, no clock except the one the
 * caller passes. The route reads; this decides what the page says.
 */

import { buildDealInputs } from './deal-inputs.js';
import { calculateDeal } from './deal-calculator.js';
import { NUMERIC_DEFAULTS, defaultProvenance, toNumberOrNull } from './numeric-payload.js';

// ─────────────────────────────────────────────────────────────
// Block 2: the bridge
// ─────────────────────────────────────────────────────────────

/**
 * THE ORDER IS PRINTED ON THE PAGE, and it is a convention rather than a choice
 * made per deal. Units first because a bigger deal explains everything after it;
 * risk terms last because they are the least discretionary. This is the shape of
 * a price/volume/mix/FX bridge in any P&L pack, and an approver has seen it.
 *
 * SEQUENTIAL, so the bridge reconciles. Each step is measured on top of the one
 * before, which means the steps telescope and sum EXACTLY to the total movement.
 * The alternative, measuring each change independently against the current
 * state, is more defensible per line and leaves a residual that was measured at
 * 7% of the movement on an ordinary three-change re-price. A page that
 * reconciles beats one that is purer and leaves 7% unexplained.
 *
 * Order-dependence is real, known and accepted: the same three changes in the
 * reverse order move individual steps by up to 0.19 points while the total is
 * identical. That is why the order is stated on the page rather than implied.
 */
export const BRIDGE_STEPS = [
  { step: 'units', label: 'Units', keys: ['ssExisting', 'ssNew', 'aqm', 'hemir'] },
  { step: 'term', label: 'Term', keys: ['duration', 'recoveryMonths', 'invoicing', 'milestones', 'structure'] },
  {
    step: 'cost basis',
    label: 'Cost basis',
    keys: ['ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'inSsExisting', 'inSsNew',
      'inAqm', 'inHemir', 'hoSafesight', 'hoAqm', 'hoHemir'],
  },
  {
    step: 'discount or override',
    label: 'Discount or override',
    keys: ['targetMargin', 'marginOverrides', 'installResp', 'lumpSumCost'],
  },
  {
    step: 'risk terms',
    label: 'Risk terms',
    keys: ['warrantyPct', 'whtPct', 'gstPct', 'grossUp', 'fxContingency', 'factoring', 'contractorMilestones'],
  },
];

export const BRIDGE_ORDER_SENTENCE =
  'Units, then term, then cost basis, then discount or override, then risk terms. '
  + 'Each step is measured on top of the one before, so the steps add up to the total.';

/**
 * Every payload key the bridge accounts for, so an unassigned one is visible.
 *
 * A FUNCTION, NOT A CONSTANT, and the difference is not stylistic. It was a Set
 * built once at module load, which is a snapshot of a mutable definition: a test
 * that removed a key from a step to prove the check could fire got an empty
 * result, because the snapshot still held the key. A constant derived from
 * something that can change is the same shape as a literal that was true when it
 * was written.
 */
export function bridgeKeys() {
  return new Set(BRIDGE_STEPS.flatMap((s) => s.keys));
}

/**
 * Which payload keys the calculation actually reads, asked of the calculation.
 *
 * A Proxy records every property buildDealInputs touches. That is derivable, so
 * it cannot go stale the way a written-down list would: add a key to the
 * translation and this set grows on its own, which is the difference between a
 * claim about configuration and a measurement of it.
 *
 * Cached, because it is a fixed property of the code rather than of any payload.
 */
let PRICED_KEYS = null;
export function pricedKeys() {
  if (PRICED_KEYS) return PRICED_KEYS;
  const touched = new Set();
  // EVERY BRANCH, or the answer depends on which one the probe happened to take.
  // installResp selects between three different installLineItems arrays, and a
  // single pass with it undefined takes the zero-cost branch and never touches
  // inSsExisting, inSsNew, inAqm or inHemir at all. Measured: one pass returned
  // 25 keys, the union returns 29.
  const BRANCHES = [
    undefined,
    'Terminus Contractor - Lump Sum',
    'Terminus Contractor - Per Unit',
    'Client Own Installation Team',
    'Terminus - Reseller Installation',
  ];
  for (const installResp of BRANCHES) {
    const probe = new Proxy({}, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined;
        touched.add(prop);
        return prop === 'installResp' ? installResp : undefined;
      },
      has(_t, prop) { if (typeof prop === 'string') touched.add(prop); return false; },
    });
    try { buildDealInputs(probe); } catch { /* the shape is what matters, not the result */ }
  }
  PRICED_KEYS = touched;
  return PRICED_KEYS;
}

function sameValue(a, b) {
  if (a === undefined || a === null || a === '') a = null;
  if (b === undefined || b === null || b === '') b = null;
  if (a === null && b === null) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = toNumberOrNull(a); const nb = toNumberOrNull(b);
    if (na !== null && nb !== null) return na === nb;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The bridge from a baseline payload to the current one.
 *
 * @param {object} basePayload
 * @param {object} nowPayload
 * @param {{ testBedCost?: number }} opts
 * @returns {{ opening, closing, total, steps, unexplained, unassignedKeys }}
 */
export function buildBridge(basePayload, nowPayload, { testBedCost = 0 } = {}) {
  const M = (p) => calculateDeal(buildDealInputs(p, { testBedCost }));
  const opening = M(basePayload);
  let state = { ...basePayload };
  let prev = opening;
  const steps = [];

  for (const def of BRIDGE_STEPS) {
    const moved = def.keys.filter((k) => !sameValue(nowPayload[k], basePayload[k]));
    if (!moved.length) continue;
    for (const k of moved) state = { ...state, [k]: nowPayload[k] };
    const after = M(state);
    steps.push({
      step: def.step,
      label: def.label,
      keys: moved,
      changes: moved.map((k) => ({ key: k, from: basePayload[k] ?? null, to: nowPayload[k] ?? null })),
      marginPoints: after.achievedMargin - prev.achievedMargin,
      contractNet: after.totals.contractNet - prev.totals.contractNet,
    });
    prev = after;
  }

  // Anything the current payload changed that no step claims AND that the
  // calculation actually reads. It cannot silently vanish from a bridge that is
  // supposed to reconcile, so it is reported.
  //
  // SCOPED TO WHAT MOVES THE NUMBER, and the scope is DERIVED rather than
  // listed. One payload carries every tab's fields, so an unfiltered check
  // reported `name`, `company_name` and `customerLead` as unaccounted for on the
  // first real deal it ran against - Reference tab text that cannot move a
  // margin. A hand-written exclusion list would have been a literal that rots
  // the first time a field is added; pricedKeys() asks the translation itself.
  const priced = pricedKeys();
  const claimed = bridgeKeys();
  const allKeys = new Set([...Object.keys(basePayload ?? {}), ...Object.keys(nowPayload ?? {})]);
  const unassignedKeys = [...allKeys]
    .filter((k) => priced.has(k) && !claimed.has(k) && !sameValue(nowPayload[k], basePayload[k]))
    .sort();

  // A BASELINE WITH NO COST BASIS CANNOT BE COMPARED, AND THE BRIDGE SAYS SO.
  //
  // Found by driving the page end to end: a version whose inputs carry no rate
  // keys prices every line at zero, so the cost-basis step reported the ENTIRE
  // value of the deal - $1.7m of contract net - as though the catalog had moved.
  // It had not. The baseline simply had no catalog in it.
  //
  // Every version the Commercials tab takes carries rates, because readPayload()
  // writes them. A version taken any other way, and the one version that
  // predates all of this, may not. That is not a fault to fix in the store; it
  // is a comparison that cannot be made, and the page must say which.
  const costBasisKeys = BRIDGE_STEPS.find((s) => s.step === 'cost basis').keys;
  const baselineHasCostBasis = costBasisKeys.some(
    (k) => basePayload?.[k] !== undefined && basePayload[k] !== null);

  const closing = M(nowPayload);
  const total = closing.achievedMargin - opening.achievedMargin;
  const summed = steps.reduce((s, r) => s + r.marginPoints, 0);

  return {
    opening: { marginPoints: opening.achievedMargin, contractNet: opening.totals.contractNet },
    closing: { marginPoints: closing.achievedMargin, contractNet: closing.totals.contractNet },
    total: { marginPoints: total, contractNet: closing.totals.contractNet - opening.totals.contractNet },
    steps,
    // Sequential attribution telescopes, so this is zero unless a step was
    // applied out of order or a key moved that no step claims. It is reported
    // rather than assumed, because a bridge that does not reconcile is the one
    // thing this shape exists to make impossible.
    unexplained: total - summed,
    unassignedKeys,
    baselineHasCostBasis,
    comparable: baselineHasCostBasis,
  };
}

// ─────────────────────────────────────────────────────────────
// Block 3: exposures
// ─────────────────────────────────────────────────────────────

/**
 * Risk terms restated as money at risk, not as the percentages that produced it.
 *
 * A percentage is an input. "10% withholding tax" tells an approver nothing
 * about the size of the deal it is 10% of, and the input screen already shows
 * the percentage. This block shows what it comes to.
 */
export function buildExposures(payload, result) {
  const grossUp = payload.grossUp ?? false;
  const out = [];

  out.push({
    key: 'wht',
    label: 'Withholding tax',
    amount: result.tax.whtBorne,
    basis: `${payload.whtPct ?? NUMERIC_DEFAULTS.whtPct}% of the invoice base`,
    note: grossUp
      ? `Grossed up, so Terminus bears none of it. The invoice to the client rises to `
        + `${result.tax.invoiceBase} to carry ${result.tax.whtAmount} of tax. If the client refuses the `
        + `gross-up, the exposure is ${result.tax.whtAmount}.`
      : 'Borne by Terminus. Not grossed up.',
    bornByTerminus: !grossUp,
  });

  out.push({
    key: 'gst',
    label: 'GST',
    amount: result.tax.gstAmount,
    basis: `${payload.gstPct ?? NUMERIC_DEFAULTS.gstPct}% of the invoice base`,
    note: 'Collected and remitted, not a cost. Shown because it changes what the client is invoiced.',
    bornByTerminus: false,
  });

  out.push({
    key: 'warranty',
    label: 'Warranty provision',
    amount: result.hardware.warrantyCost,
    basis: `${payload.warrantyPct ?? NUMERIC_DEFAULTS.warrantyPct}% of ${result.hardware.totalUnits} units `
      + `= ${result.hardware.warrantyUnits} spare unit${result.hardware.warrantyUnits === 1 ? '' : 's'}`,
    note: 'Priced in as cost. An under-provision surfaces as margin now and a loss later.',
    bornByTerminus: true,
  });

  out.push({
    key: 'finance',
    label: 'Finance cost',
    amount: result.financeCost,
    basis: (payload.factoring?.enabled ?? false)
      ? `PO factoring at ${payload.factoring?.ratePct ?? NUMERIC_DEFAULTS.factoringRatePct}% per month`
      : 'No factoring',
    note: 'Interest on financed working capital, already inside total cost.',
    bornByTerminus: true,
  });

  const minCash = result.cashFlow.minCash ?? 0;
  out.push({
    key: 'cash',
    label: 'Peak cash exposure',
    amount: Math.min(0, minCash),
    basis: minCash < 0
      ? `Worst month is month ${result.cashFlow.minCashMonth ?? 0}`
      : 'No month goes cash negative',
    note: minCash < 0
      ? 'The most Terminus is out of pocket at any point. Not a cost; a funding requirement.'
      : 'This deal funds itself throughout. Nothing to fund.',
    bornByTerminus: minCash < 0,
  });

  out.push({
    key: 'testBed',
    label: 'Test Bed cost carried in',
    amount: result.testBedCost,
    basis: 'Sunk R&D from the Test Bed this Opportunity converted from',
    note: 'Reduces margin and is not billed to the client.',
    bornByTerminus: true,
  });

  return out;
}

// ─────────────────────────────────────────────────────────────
// Block 4: cost basis and its age
// ─────────────────────────────────────────────────────────────

/**
 * @param {object} batches - catalogToRates().batches, product -> { batch_label, effective_from }
 * @param {string[]} missing - products with no batch at all
 * @param {string} asOfISO - the date the catalog was resolved for
 */
export function buildCostBasis(batches, missing, asOfISO) {
  const asOf = new Date(`${asOfISO}T00:00:00Z`);
  const products = Object.entries(batches ?? {}).map(([product, b]) => {
    const from = b.effective_from ? new Date(`${String(b.effective_from).slice(0, 10)}T00:00:00Z`) : null;
    const ageDays = from ? Math.round((asOf - from) / 86400000) : null;
    return { product, batchLabel: b.batch_label ?? null, effectiveFrom: b.effective_from ?? null, ageDays };
  }).sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));

  return {
    asOf: asOfISO,
    products,
    // The oldest is the one that dates the whole quote: a deal is only as
    // current as its stalest input.
    oldest: products[0] ?? null,
    missing: missing ?? [],
  };
}

// ─────────────────────────────────────────────────────────────
// Block 5: what is not recorded
// ─────────────────────────────────────────────────────────────

/**
 * Fields taking a default, and things captured but not used.
 *
 * NOT "blank fields". A field taking a default is not blank on this page: it
 * carries the default's value and where the default came from, per the
 * surface rule at the top of this file.
 */
export function buildNotRecorded(payload, { missingProducts = [], versionReason = null } = {}) {
  const out = [];

  for (const key of Object.keys(NUMERIC_DEFAULTS)) {
    const raw = payload?.[key];
    if (raw !== undefined && raw !== null && raw !== '') continue;
    out.push({
      kind: 'default',
      key,
      ...defaultProvenance(key),
      note: 'Nobody entered a value. This is the assumption being approved.',
    });
  }

  for (const product of missingProducts) {
    out.push({
      kind: 'missing cost',
      key: product,
      note: `${product} has no current Base Cost batch, so it priced at zero. `
        + 'A zero here is an absent cost, not a free product.',
    });
  }

  // Captured and never applied. Round 3 Phase 6 recorded these as data entry
  // only, and neither buildDealInputs nor calculateDeal reads them, so an
  // approver seeing "FX contingency 3%" on the input screen would reasonably
  // believe it is priced in. It is not.
  const CAPTURED_NOT_APPLIED = [
    ['fxContingency', 'FX contingency', 'is recorded and does NOT affect any figure on this page'],
    ['bidCurrency', 'Bid currency', 'is recorded and does not convert anything'],
    ['proposalCurrency', 'Proposal currency', 'is recorded and does not convert anything'],
  ];
  for (const [key, label, what] of CAPTURED_NOT_APPLIED) {
    const raw = payload?.[key];
    if (raw === undefined || raw === null || raw === '' || raw === 0) continue;
    out.push({ kind: 'captured, not applied', key, value: raw, note: `${label} ${what}.` });
  }

  if (!versionReason) {
    out.push({
      kind: 'absent',
      key: 'reason',
      note: 'This version carries no stated reason for the pricing.',
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Block 2's second half: target
// ─────────────────────────────────────────────────────────────

/**
 * TARGET MEANS targetMargin AS IT STANDS NOW.
 *
 * Target is policy: set by the business, current, external to the deal.
 * Per-line marginOverrides are deal decisions, not targets, and folding the last
 * approval's overrides into "target" would give two baselines both meaning "last
 * time" and none meaning policy, collapsing the distinction blocks 2 and 3 exist
 * to draw.
 *
 * AND IF POLICY MOVED, THAT GETS ITS OWN LINE. Without it the page shows "below
 * target" while implying the deal got worse when only the target changed. The
 * same fact appears in the bridge as a discount-or-override step, which is not
 * double counting: the step says what it did to the margin, this says what the
 * margin is now measured against.
 */
export function buildTarget(payload, result, { baselinePayload = null, changedAt = null } = {}) {
  const stated = toNumberOrNull(payload?.targetMargin);
  const target = stated === null ? NUMERIC_DEFAULTS.targetMargin : stated;
  const provenance = stated === null ? defaultProvenance('targetMargin', (n) => `${n}%`) : null;

  const wasRaw = baselinePayload ? toNumberOrNull(baselinePayload.targetMargin) : null;
  const was = baselinePayload ? (wasRaw === null ? NUMERIC_DEFAULTS.targetMargin : wasRaw) : null;
  const moved = was !== null && was !== target;

  const overrides = payload?.marginOverrides ?? {};
  const below = Object.entries(overrides)
    .map(([key, pct]) => ({ key, pct: toNumberOrNull(pct) }))
    .filter((o) => o.pct !== null && o.pct < target)
    .map((o) => ({ ...o, gapPoints: target - o.pct }))
    .sort((a, b) => b.gapPoints - a.gapPoints);

  return {
    target,
    provenance,
    achieved: result.achievedMargin,
    gapPoints: result.achievedMargin - target,
    moved,
    was,
    changedAt,
    movedSentence: moved
      ? `Target ${target}% (was ${was}% at last approval${changedAt ? `, changed ${changedAt}` : ''}).`
      : null,
    linesBelowTarget: below,
  };
}

// ─────────────────────────────────────────────────────────────
// The whole page
// ─────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {object} p.payload         the current record payload, rates merged in
 * @param {number} p.testBedCost
 * @param {object|null} p.version    the version being approved
 * @param {object|null} p.baseline   the last approved version, or null
 * @param {string|null} p.targetChangedAt  ISO date the target last moved, if known
 * @param {object} p.catalog         { batches, missing, asOf }
 * @param {object} p.record          { reference_code, name, stage }
 */
export function buildApprovalPage({
  payload, testBedCost = 0, version = null, baseline = null,
  targetChangedAt = null, catalog = {}, record = {},
}) {
  const result = calculateDeal(buildDealInputs(payload, { testBedCost }));
  const costBasis = buildCostBasis(catalog.batches, catalog.missing, catalog.asOf);
  const target = buildTarget(payload, result, {
    baselinePayload: baseline?.inputs ?? null,
    changedAt: targetChangedAt,
  });

  // GROUPED, because this sentence is the first thing read and the row beneath
  // it already shows $1,818,111. Looking at the rendered page is what caught it:
  // every assertion passed on "a contract net of 1818111", which is correct to
  // the dollar and is the least legible figure on a page whose purpose is that
  // this number reads first.
  const grouped = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const versionLabel = version
    ? (version.major === 0 ? `V0.${version.minor}` : (version.minor === 0 ? `V${version.major}` : `V${version.major}.${version.minor}`))
    : null;

  // ── 1. THE ASK ────────────────────────────────────────────────────────
  const ask = {
    record: {
      reference: record.reference_code ?? null,
      name: record.name ?? null,
      stage: record.status ?? null,
    },
    version: version ? {
      label: versionLabel,
      status: version.status,
      revisionNumber: version.revision_number,
      reason: version.reason ?? null,
      author: version.created_by_email ?? null,
      takenAt: version.created_at ?? null,
    } : null,
    contractNet: result.totals.contractNet,
    totalCost: result.totalDealCostAll,
    achievedMargin: result.achievedMargin,
    months: toNumberOrNull(payload.duration) ?? NUMERIC_DEFAULTS.duration,
    units: result.hardware.totalUnits,
    sentence: version
      ? `Approve ${versionLabel} at ${result.achievedMargin.toFixed(1)}% margin on a contract net of $${grouped(result.totals.contractNet)}.`
      : `No version has been taken. There is nothing to approve yet.`,
  };

  // ── 2. WHAT MOVED IT ──────────────────────────────────────────────────
  //
  // NO BASELINE MEANS NO BRIDGE, AND A STATED ABSENCE RATHER THAN A GAP.
  //
  // A delta against V0.1 was considered and rejected by the business: it is
  // internal drafting churn, it invites an approver to interrogate abandoned
  // drafts, and it turns working iterations into auditable commercial history.
  //
  // But a blank block reads as a rendering failure, and a stated absence reads
  // as information. So the block says what it has instead of a baseline.
  const moved = baseline
    ? {
      baseline: {
        label: baseline.major === 0 ? `V0.${baseline.minor}` : (baseline.minor === 0 ? `V${baseline.major}` : `V${baseline.major}.${baseline.minor}`),
        revisionNumber: baseline.revision_number,
        approvedAt: baseline.approval?.decidedAt ?? null,
        reason: baseline.reason ?? null,
      },
      order: BRIDGE_ORDER_SENTENCE,
      bridge: buildBridge(baseline.inputs ?? {}, payload, { testBedCost }),
      absence: null,
      caveat: null,
    }
    : {
      baseline: null,
      order: null,
      bridge: null,
      absence: 'First approval. No prior approved version. '
        + `Priced against target ${target.target}%`
        + (target.provenance ? ` (${target.provenance.source}, set ${target.provenance.since})` : '')
        + (costBasis.oldest?.effectiveFrom ? ` and cost basis dated ${String(costBasis.oldest.effectiveFrom).slice(0, 10)}` : '')
        + '.',
    };

  // The caveat is set after the bridge exists, because it depends on what the
  // bridge found rather than on what the baseline looked like from outside.
  if (moved.bridge && !moved.bridge.comparable) {
    moved.caveat = `${moved.baseline.label} carries no cost basis, so its lines priced at zero. `
      + 'The steps below are not a comparison of two priced deals and must not be read as one. '
      + 'Take a fresh version from the Commercials tab and have that approved.';
  }

  return {
    ask,
    moved,
    target,
    exposures: buildExposures(payload, result),
    costBasis,
    notRecorded: buildNotRecorded(payload, {
      missingProducts: catalog.missing ?? [],
      versionReason: version?.reason ?? null,
    }),
  };
}
