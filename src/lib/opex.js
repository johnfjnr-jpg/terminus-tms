// ── R-OX3: THE OPEX TABLE'S ALL-IN MONTHLY FEE ──────────────────────────
//
// One row per product type, carrying what a customer pays per unit per month
// for EVERYTHING: hardware, its warranty share, installation, and hosting,
// with the one-off part amortised over the contract term.
//
// ── THIS IS A CALLER OF THE DERIVATION, NOT A SECOND PRICING PATH ───────
//
// Every figure here is read out of `calculateDeal`'s own groups and reshaped.
// Nothing is priced again. A second path that agrees today will disagree the
// first time a margin, a rate or a rule moves, and this estate has recorded
// that fault more often than any other.
//
// ── THE TWO ALLOCATIONS, MEASURED IN PHASE 0 RATHER THAN ASSUMED ────────
//
//   THE WARRANTY IS SAFESIGHT'S ALONE. `warrantyBasisUnits` reads 32 on a
//   20 + 12 SafeSight deal and does not move when AQ Sensor goes to 400 or
//   HEMIR to 300. So it is not spread: it rides with SafeSight.
//
//   SAFESIGHT SPANS TWO INSTALLATION ROWS, existing infra and new infra, and
//   two unit counts. Both belong to the one row the sketch draws.
//
// ── THE ONE GAP IN THE DESIGN OF RECORD, AND THE POSITION TAKEN ─────────
//
// Under lump-sum installation the install group is a SINGLE line for the whole
// deal and there is no per-type figure to read. 3 of 18 live real or walk
// opportunities use it. The lump sum is therefore allocated across types in the
// proportions the CATALOG'S OWN per-unit installation rates would have
// produced, falling back to unit count where those rates are absent.
//
// A flat per-unit split would overcharge an AQ Sensor install at 500 against a
// HEMIR at 5,000. This is a position, reported to John rather than buried, and
// it is his to overturn.

/** The three rows, in the order the sketch lists them. */
export const OPEX_FEE_KEYS = ['ss', 'aq', 'hemir'];

const LABELS = { ss: 'SafeSight', aq: 'AQ Sensor', hemir: 'HEMIR' };

// Which calculator line keys feed each row. SafeSight takes both infra rows.
const HARDWARE = { ss: ['hwSs'], aq: ['hwAqm'], hemir: ['hwHemir'] };
const INSTALL = { ss: ['inSsEx', 'inSsNew'], aq: ['inAqm'], hemir: ['inHemir'] };
const HOSTING = { ss: ['hoSs'], aq: ['hoAqm'], hemir: ['hoHemir'] };
// The catalog rate each type's installation is quoted at, for the lump-sum
// allocation. SafeSight carries two, matched to its two unit counts.
const INSTALL_RATES = {
  ss: [['inSsExisting', 'ssExisting'], ['inSsNew', 'ssNew']],
  aq: [['inAqm', 'aqm']],
  hemir: [['inHemir', 'hemir']],
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const sum = (rows, keys, field) =>
  keys.reduce((a, k) => a + num((rows ?? []).find((r) => r.key === k)?.[field]), 0);

/**
 * @param {object} result   what `calculateDeal` returned for this deal
 * @param {object} payload  the deal's own inputs, for the counts and the term
 * @param {object} rates    the RESOLVED rates, for the lump-sum allocation only.
 *   Passed explicitly because `calculateDeal` does not return them: reading
 *   `result.rates` gave `undefined`, every weight came out zero, and the
 *   allocation fell silently through to its unit-count fallback. The test
 *   caught it; nothing in the output said so.
 * @returns {Array<{key:string,label:string,units:number,monthlyFee:number|null,
 *   marginPct:number|null,contractTotal:number|null}>}
 */
export function opexRows(result, payload, rates = {}) {
  const p = payload ?? {};
  const g = result?.groups ?? {};
  const term = Number(p.duration);
  // A MISSING TERM IS NOT A TERM OF ZERO. Architecture 11: the screen must be
  // able to say the figure cannot be stated, rather than dividing by nothing.
  const haveTerm = Number.isFinite(term) && term > 0;

  const units = {
    ss: num(p.ssExisting) + num(p.ssNew),
    aq: num(p.aqm),
    hemir: num(p.hemir),
  };

  // ── THE LUMP-SUM ALLOCATION, computed once ────────────────────────────
  const lumpRow = (g.installGroup?.rows ?? []).find((r) => r.key === 'inLump');
  let lumpShare = null;
  if (lumpRow) {
    const weightOf = (k) => INSTALL_RATES[k].reduce(
      (a, [rateKey, countKey]) => a + num(rates?.[rateKey]) * num(p[countKey]), 0);
    let weights = Object.fromEntries(OPEX_FEE_KEYS.map((k) => [k, weightOf(k)]));
    let whole = Object.values(weights).reduce((a, b) => a + b, 0);
    // FALLBACK, and it is reachable: a deal whose catalog carries no per-unit
    // install rates has nothing to weigh by, so it falls to unit count.
    if (!(whole > 0)) {
      weights = Object.fromEntries(OPEX_FEE_KEYS.map((k) => [k, units[k]]));
      whole = Object.values(weights).reduce((a, b) => a + b, 0);
    }
    lumpShare = Object.fromEntries(OPEX_FEE_KEYS.map((k) => [k,
      whole > 0 ? { price: num(lumpRow.rawPrice) * (weights[k] / whole),
        cost: num(lumpRow.rawCost) * (weights[k] / whole) } : { price: 0, cost: 0 }]));
  }

  return OPEX_FEE_KEYS.map((key) => {
    const n = units[key];
    const hwRows = g.hardwareGroup?.rows;
    const inRows = g.installGroup?.rows;
    const hoRows = g.hostingGroup?.rows;

    // THE WARRANTY RIDES WITH SAFESIGHT, per the Phase 0 measurement.
    const warrantyPrice = key === 'ss' ? sum(hwRows, ['hwWarranty'], 'rawPrice') : 0;
    const warrantyCost = key === 'ss' ? sum(hwRows, ['hwWarranty'], 'rawCost') : 0;

    const installPrice = lumpShare
      ? lumpShare[key].price
      : sum(inRows, INSTALL[key], 'rawPrice');
    const installCost = lumpShare
      ? lumpShare[key].cost
      : sum(inRows, INSTALL[key], 'rawCost');

    const oneOffPrice = sum(hwRows, HARDWARE[key], 'rawPrice') + warrantyPrice + installPrice;
    const oneOffCost = sum(hwRows, HARDWARE[key], 'rawCost') + warrantyCost + installCost;
    // Hosting is ALREADY per month, for every unit of the type.
    const hostingPriceMonth = sum(hoRows, HOSTING[key], 'rawPrice');
    const hostingCostMonth = sum(hoRows, HOSTING[key], 'rawCost');

    if (!haveTerm) {
      return { key, label: LABELS[key], units: n, monthlyFee: null, marginPct: null, contractTotal: null };
    }
    if (!(n > 0)) {
      return { key, label: LABELS[key], units: n, monthlyFee: null, marginPct: null, contractTotal: 0 };
    }

    const contractPrice = oneOffPrice + hostingPriceMonth * term;
    const contractCost = oneOffCost + hostingCostMonth * term;
    const monthlyFee = contractPrice / n / term;
    // THE BLENDED ALL-IN MARGIN, which is what R-OX3 rules and is deliberately
    // not any component's own: the warranty reaches the customer at cost, so a
    // SafeSight blend sits below the margin its hardware line is priced at.
    const marginPct = contractPrice > 0 ? (1 - contractCost / contractPrice) * 100 : null;
    return {
      key, label: LABELS[key], units: n,
      monthlyFee, marginPct,
      contractTotal: monthlyFee * n * term,
    };
  });
}
