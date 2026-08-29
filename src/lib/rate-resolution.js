// Where a rate comes from. Round 40 Phase 1b, 2026-08-29.
//
// ── ONE PLACE, BEFORE THE CALCULATOR ──────────────────────────────────────
//
// The business's ruling, and both halves matter:
//
//   THE CALCULATOR DOES NOT REACH FOR THE CATALOG. "Where does this rate come
//   from" is POLICY, not arithmetic. Policy inside calculateDeal would mean
//   every caller must supply a catalog AND the right catalog for that deal's
//   as_of, which is a second thing every caller has to get right. The resolver
//   answers the policy question and hands the calculator numbers.
//
//   THE APPROVAL PAGE'S "WHICH LINES ARE OVERRIDDEN AND BY HOW FAR" IS A
//   BY-PRODUCT, not a second computation. Verification 20 by construction
//   rather than by discipline: there is no second place that could disagree,
//   because the same call that prices the deal is the one that reports it.
//
// ── WHICH RATES MAY BE OVERRIDDEN, AND THE TEST THAT DECIDES ──────────────
//
// From DESIGN_PRINCIPLES.md, ruled by the business at the Round 40 Phase 1
// close, stated as a test so the next cost key is not argued from scratch:
//
//   Is this cost the same wherever the deal happens, or quoted for this job?
//     Same everywhere -> a catalog fact. Non-editable.
//     Quoted per job  -> a per-deal figure. Overridable, recorded, and visible
//                        on the approval page.
//
// Hardware and hosting pass the first test: a SafeSight camera costs what it
// costs everywhere. Installation fails it: a city-centre deployment with
// traffic management is not a business park, so the catalog figure is a
// planning default rather than the truth for this job.
export const OVERRIDABLE_RATE_KEYS = ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir'];

// The other six. Named rather than derived, so a new catalog key is a decision
// somebody takes against the test above rather than something that acquires a
// permission by being added to a list.
export const CATALOG_ONLY_RATE_KEYS = [
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'hoSafesight', 'hoAqm', 'hoHemir',
];

export const ALL_RATE_KEYS = [...CATALOG_ONLY_RATE_KEYS, ...OVERRIDABLE_RATE_KEYS];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The effective rate for every key, and where each one came from.
 *
 * ── IT KILLS THE `?? 0` PROPERLY ────────────────────────────────────────
 *
 * Three outcomes, never two. `buildDealInputs` read `payload.inSsExisting ?? 0`,
 * so a rate nobody had set priced at zero and a genuinely free installation
 * looked identical to a missing one. That is the FOURTH appearance of the
 * confident-zero shape in this module - after gstPct, whtPct and duration - and
 * this is meant to be the last of them here.
 *
 *   overridden -> somebody quoted this job. The number is theirs.
 *   catalog    -> nobody quoted it. The number is the current batch's.
 *   absent     -> nobody quoted it AND the catalog has no batch. There is no
 *                 number, and it must not become one.
 *
 * `absent` feeds the missing-batch warning that already exists rather than
 * inventing a second one.
 *
 * @param {object} payload the record's payload, holding overrides only
 * @param {object} catalog rate keys to numbers, from catalogToRates
 */
export function resolveRates(payload, catalog = {}) {
  const rates = {};
  const lines = [];

  for (const key of ALL_RATE_KEYS) {
    const overridable = OVERRIDABLE_RATE_KEYS.includes(key);
    // A non-overridable key is never read from the payload, whatever it holds.
    // That is the enforcement, not the allowlist: even a payload that somehow
    // carried ssUnitCost cannot price a deal with it.
    const override = overridable ? num(payload?.[key]) : null;
    const catalogRate = num(catalog?.[key]);

    const source = override !== null ? 'overridden' : catalogRate !== null ? 'catalog' : 'absent';
    const value = override !== null ? override : catalogRate;

    if (value !== null) rates[key] = value;
    lines.push({
      key,
      source,
      value,
      catalogRate,
      overridable,
      // How far this job's quote sits from the planning default. Null when
      // there is nothing to compare against, which is not the same as zero.
      diff: source === 'overridden' && catalogRate !== null ? override - catalogRate : null,
      diffPct: source === 'overridden' && catalogRate ? ((override - catalogRate) / catalogRate) * 100 : null,
    });
  }

  return {
    rates,
    lines,
    overridden: lines.filter((l) => l.source === 'overridden'),
    absent: lines.filter((l) => l.source === 'absent'),
  };
}

/**
 * What a version freezes. The business's ruling on artefact B:
 *
 *   the record holds the DECISION - overridden, or not. It changes when
 *   somebody decides differently.
 *   the version holds the PRICE - priced at these rates. It never changes.
 *
 * One computation, two artefacts: the record stores the resolver's INPUT, the
 * version stores its OUTPUT.
 *
 * AND IT RECORDS WHICH WERE OVERRIDDEN, not only the effective numbers. Once
 * the catalog moves, an approver reading an old version cannot otherwise tell
 * whether $4,000 was a quotation somebody obtained or the catalog figure of the
 * day. The approval page needs that distinction and the version is the only
 * place it survives.
 */
export function frozenRates(resolution) {
  return {
    rates: { ...resolution.rates },
    overridden: resolution.overridden.map((l) => ({
      key: l.key, value: l.value, catalogRate: l.catalogRate, diff: l.diff,
    })),
    absent: resolution.absent.map((l) => l.key),
  };
}

/**
 * The test that keeps the two artefacts honest, runnable at version time:
 * a version's stored rates equal what the resolver produces from that record
 * and that catalog at that moment.
 */
export function frozenRatesAgree(frozen, resolution) {
  const a = frozen?.rates ?? {};
  const b = resolution.rates;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const differing = keys.filter((k) => a[k] !== b[k]);
  const frozenOverridden = (frozen?.overridden ?? []).map((o) => o.key).sort();
  const nowOverridden = resolution.overridden.map((l) => l.key).sort();
  return {
    agree: differing.length === 0 && String(frozenOverridden) === String(nowOverridden),
    differing,
    frozenOverridden,
    nowOverridden,
  };
}
