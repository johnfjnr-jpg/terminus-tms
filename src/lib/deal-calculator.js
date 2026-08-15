/**
 * Terminus deal calculator - pure calculation module.
 *
 * Ported from Terminus_Ops_dc.html, methods buildLoanSchedule() and
 * buildOppDetail() (Claude Design prototype, extracted 2026-08-11).
 *
 * Every function here takes plain arguments and returns plain data.
 * No DOM, no `this.state`, no UI formatting (money strings, colours,
 * dimmed labels). This file is meant to be imported unchanged by both:
 *   - the Fastify backend (src/routes/deals.js), as the authoritative
 *     calculation on submit
 *   - the frontend, as an ES module, for live preview while a user
 *     edits an Opportunity
 *
 * IMPORTANT: this is a first-pass port, not yet verified against the
 * prototype's live output. Before this replaces the prototype logic,
 * run known deals through both and confirm every figure matches
 * exactly. See the parity test stub at the bottom of this file.
 */

/**
 * Builds a month-by-month loan repayment schedule.
 * Direct port of buildLoanSchedule(). This function was already pure
 * in the original file, no changes made beyond adding types/docs.
 *
 * @param {number} principal - loan amount
 * @param {number} monthlyRate - monthly interest rate as a decimal (e.g. 0.015 for 1.5%)
 * @param {number} termMonths - loan term in months
 * @param {'straight'|'declining'} method
 * @returns {{principal: number, interest: number}[]} one entry per month
 */
export function buildLoanSchedule(principal, monthlyRate, termMonths, method) {
  const schedule = [];
  let balance = principal;
  if (method === 'declining') {
    const payment = monthlyRate > 0
      ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths))
      : principal / termMonths;
    for (let i = 0; i < termMonths; i++) {
      const interest = balance * monthlyRate;
      let principalPortion = payment - interest;
      if (i === termMonths - 1 || principalPortion > balance) principalPortion = balance;
      balance -= principalPortion;
      schedule.push({ principal: principalPortion, interest });
    }
  } else {
    const principalPortion = termMonths > 0 ? principal / termMonths : 0;
    for (let i = 0; i < termMonths; i++) {
      const interest = balance * monthlyRate;
      schedule.push({ principal: principalPortion, interest });
      balance -= principalPortion;
    }
  }
  return schedule;
}

/**
 * Converts a cost to a sell price at a given margin percentage.
 * Extracted from the inline arrow function inside priceGroup() in
 * buildOppDetail(). Same rounding behaviour as the original.
 *
 * @param {number} cost
 * @param {number} marginPct - 0 to 99
 * @returns {number} price, rounded to the nearest whole unit
 */
export function priceFromCost(cost, marginPct) {
  const m = Math.min(99, marginPct || 0);
  return Math.round(cost / (1 - m / 100));
}

/**
 * Builds one cost/price group (e.g. "Unit cost and warranty",
 * "Installation", "Hosting per month") from a set of line items.
 *
 * This is the calculation core of priceGroup() from the original file,
 * with the UI row-building (edit handlers, dimmed note text, input
 * styling) stripped out. Callers on the frontend can re-attach display
 * formatting; this function only returns numbers.
 *
 * @param {Array<{key: string, cost: number, marginPct: number}>} lineItems
 * @returns {{rows: Array<{key: string, rawCost: number, rawPrice: number}>, rawTotalCost: number, rawTotalPrice: number}}
 */
export function buildCostGroup(lineItems) {
  const rows = lineItems.map(({ key, cost, marginPct }) => ({
    key,
    rawCost: cost,
    rawPrice: priceFromCost(cost, marginPct),
  }));
  return {
    rows,
    rawTotalCost: rows.reduce((s, r) => s + r.rawCost, 0),
    rawTotalPrice: rows.reduce((s, r) => s + r.rawPrice, 0),
  };
}

/**
 * Calculates hardware cost and warranty provision.
 * Extracted from the top section of buildOppDetail(), lines computing
 * hardwareCost, warrantyUnits, warrantyCost.
 *
 * @param {object} p
 * @param {number} p.ssUnitCost @param {number} p.ssUnits
 * @param {number} p.aqUnitCost @param {number} p.aqUnits
 * @param {number} p.hemirUnitCost @param {number} p.hemirUnits
 * @param {number} p.warrantyPct - defaults to 2 if not supplied, matching original default
 */
export function calculateHardwareAndWarranty({
  ssUnitCost, ssUnits, aqUnitCost, aqUnits, hemirUnitCost, hemirUnits, warrantyPct = 2,
}) {
  const totalUnits = ssUnits + aqUnits + hemirUnits;
  const hardwareCost = ssUnitCost * ssUnits + aqUnitCost * aqUnits + hemirUnitCost * hemirUnits;
  const warrantyUnits = Math.ceil(totalUnits * warrantyPct / 100);
  const avgHwCost = totalUnits ? hardwareCost / totalUnits : 0;
  const warrantyCost = Math.round(warrantyUnits * avgHwCost);
  return { totalUnits, hardwareCost, warrantyUnits, warrantyCost, avgHwCost };
}

/**
 * Rolls up hardware, installation, and hosting groups into overall
 * contract value and cost figures.
 * Extracted from the section of buildOppDetail() computing
 * oneOffPrice, hostingTermPrice, contractNet, totalDealCost.
 *
 * @param {object} p
 * @param {{rawTotalCost: number, rawTotalPrice: number}} p.hardwareGroup
 * @param {{rawTotalCost: number, rawTotalPrice: number}} p.installGroup
 * @param {{rawTotalCost: number, rawTotalPrice: number}} p.hostingGroup - per month
 * @param {number} p.months - contract duration
 */
export function calculateContractTotals({ hardwareGroup, installGroup, hostingGroup, months }) {
  const oneOffPrice = hardwareGroup.rawTotalPrice + installGroup.rawTotalPrice;
  const hostingMonthPrice = hostingGroup.rawTotalPrice;
  const hostingTermPrice = hostingMonthPrice * months;
  const contractNet = oneOffPrice + hostingTermPrice;
  const totalDealCost = hardwareGroup.rawTotalCost + installGroup.rawTotalCost + hostingGroup.rawTotalCost * months;
  const achievedMarginPreFinance = contractNet ? ((contractNet - totalDealCost) / contractNet) * 100 : 0;
  return { oneOffPrice, hostingMonthPrice, hostingTermPrice, contractNet, totalDealCost, achievedMarginPreFinance };
}

/**
 * Applies withholding tax and GST to a contract net value.
 * Extracted from the invoiceBase / whtAmount / gstAmount lines.
 *
 * @param {number} contractNet
 * @param {number} whtPct
 * @param {number} gstPct
 * @param {boolean} grossUp
 */
export function calculateTax(contractNet, whtPct, gstPct, grossUp) {
  const invoiceBase = grossUp && whtPct < 100 ? Math.round(contractNet / (1 - whtPct / 100)) : contractNet;
  const whtAmount = Math.round(invoiceBase * whtPct / 100);
  const gstAmount = Math.round(invoiceBase * gstPct / 100);
  const whtBorne = grossUp ? 0 : whtAmount;
  return { invoiceBase, whtAmount, gstAmount, whtBorne };
}

/**
 * Builds the month-by-month cash flow model, including PO factoring.
 * This is the direct port of the `financeModel` IIFE inside
 * buildOppDetail(), the single most complex piece. Every value
 * previously pulled from `this.state.oppPayment`, `this.state.oppFactoring`,
 * `this.milestonesFor()`, `this.contractorMilestonesFor()` is now an
 * explicit argument.
 *
 * @param {object} p
 * @param {number} p.months - contract duration
 * @param {'single'|'twoPhase'|'hybrid'} p.structure
 * @param {number} [p.recoveryMonths] - required for twoPhase, ignored for single/hybrid
 * @param {boolean} p.annualInvoicing - true = annual in advance, false = monthly
 * @param {Array<{month: number, usd: number, pct: number}>} p.milestones - hardware milestones (hybrid structure)
 * @param {number} p.hardwarePriceAll - hardware + installation price total (groups[0].rawTotalPrice + groups[1].rawTotalPrice)
 * @param {number} p.hardwareCostAll - hardware + installation cost total (groups[0].rawTotalCost + groups[1].rawTotalCost)
 * @param {number} p.hostingMonthPrice
 * @param {number} p.hostingMonthCost
 * @param {boolean} p.lumpSumDeal
 * @param {number} p.lumpCost
 * @param {Array<{month: number, usd: number}>} p.contractorMilestones - only used when lumpSumDeal is true
 * @param {boolean} p.factoringEnabled
 * @param {number} p.factoringRatePct - e.g. 1.5 for 1.5% monthly, defaults to 1.5
 * @param {number} p.factoringTermMonths
 * @param {'straight'|'declining'} p.factoringMethod
 */
export function buildCashFlowModel({
  months,
  structure,
  recoveryMonths,
  annualInvoicing = true,
  milestones = [],
  hardwarePriceAll,
  hardwareCostAll,
  hostingMonthPrice,
  hostingMonthCost,
  lumpSumDeal,
  lumpCost,
  contractorMilestones = [],
  factoringEnabled,
  factoringRatePct = 1.5,
  factoringTermMonths,
  factoringMethod = 'straight',
}) {
  const recov = structure === 'single' ? months : (recoveryMonths || 0);
  const msPctTotal = milestones.reduce((s, m) => s + m.pct, 0);
  const due = milestones.filter((m) => m.month > 0 && m.usd > 0);

  const facRate = (factoringRatePct || 0) / 100;
  const defaultTerm = structure === 'hybrid' ? 12 : Math.max(1, recov);
  const facTerm = Math.max(1, factoringTermMonths || defaultTerm);

  const principal = hardwareCostAll;
  const contractorBase = lumpSumDeal ? lumpCost : hardwareCostAll; // matches original: groups[1].rawTotalCost when not lump sum
  const contractorMs = lumpSumDeal ? contractorMilestones.filter((x) => x.month > 0 && x.usd > 0) : [];
  const contractorStaged = contractorMs.length > 0;
  const contractorTotal = contractorMs.reduce((s, x) => s + x.usd, 0);
  const upfrontCost = contractorStaged ? principal - contractorTotal : principal;

  const schedule = buildLoanSchedule(principal, facRate, facTerm, factoringMethod);

  const recoveryPerMonth = recov > 0 ? hardwarePriceAll / recov : 0;

  const accrHw = [];
  const accrHost = [];
  for (let m = 1; m <= months; m++) {
    accrHw.push(structure !== 'hybrid' ? (m <= recov ? recoveryPerMonth : 0) : 0);
    accrHost.push(hostingMonthPrice);
  }

  const billed = (accr) => {
    if (!annualInvoicing) return accr.slice();
    const out = accr.map(() => 0);
    for (let y = 0; y * 12 < months; y++) {
      let sum = 0;
      for (let i = y * 12; i < Math.min((y + 1) * 12, months); i++) sum += accr[i];
      out[y * 12] = sum;
    }
    return out;
  };

  const hwBilled = billed(accrHw);
  const hostBilled = billed(accrHost);

  const rows = [];
  let cum = 0;
  // Tracks the true minimum cumulative cash position across every month, not
  // just how far negative it goes. Starting at null (rather than 0) matters:
  // a deal whose cash flow stays positive throughout still has a real trough
  // (e.g. $5k in month 3) that a salesperson needs to see, it isn't $0.
  let minCash = null;
  let minCashMonth = 0;

  for (let m = 1; m <= months; m++) {
    const hardwareIn = structure !== 'hybrid'
      ? hwBilled[m - 1]
      : due.filter((x) => x.month === m).reduce((s, x) => s + x.usd, 0);
    const hostingIn = hostBilled[m - 1];
    const plRevenue = hardwareIn + hostingIn;
    const advance = (factoringEnabled && m === 1) ? principal : 0;
    const cashIn = plRevenue + advance;

    const hwOut = m === 1 ? upfrontCost : 0;
    const contractorOut = contractorMs.filter((x) => x.month === m).reduce((s, x) => s + x.usd, 0);
    const se = (factoringEnabled && m > 1 && m <= facTerm + 1) ? schedule[m - 2] : null;
    const facP = se ? se.principal : 0;
    const facI = se ? se.interest : 0;
    const plCost = hwOut + contractorOut + hostingMonthCost + facI;
    const cashOut = plCost + facP;
    const cashNet = cashIn - cashOut;
    cum += cashNet;
    if (minCash === null || Math.round(cum) < minCash) {
      minCash = Math.round(cum);
      minCashMonth = m;
    }
    rows.push({
      m, hardwareIn, hostingIn, advance, cashIn, hwOut, contractorOut,
      hostOut: hostingMonthCost, facP, facI, plRevenue, plCost,
      plNet: plRevenue - plCost, cashOut, cashNet, cum,
    });
  }

  const totRev = rows.reduce((s, r) => s + r.plRevenue, 0);
  const totCost = rows.reduce((s, r) => s + r.plCost, 0);
  const facInterest = rows.reduce((s, r) => s + r.facI, 0);

  return {
    structure, recov, rows, totRev, totCost, totNet: totRev - totCost, annualInvoicing,
    marginAchieved: totRev ? ((totRev - totCost) / totRev) * 100 : 0,
    minCash: minCash ?? 0, minCashMonth, factoringEnabled, facTerm, factoringMethod, principal, contractorStaged,
    facInterest, msPctTotal,
  };
}

/**
 * Top level entry point: given full deal inputs, returns the complete
 * calculated deal, matching the figures buildOppDetail() produced
 * (minus all UI-only fields like row labels and edit handlers).
 *
 * This is the function the Fastify route should call, both for live
 * preview and for the authoritative recompute-on-submit check.
 */
export function calculateDeal(input) {
  const {
    ssUnitCost, ssUnits, aqUnitCost, aqUnits, hemirUnitCost, hemirUnits,
    warrantyPct,
    installLineItems, // array of {key, cost, marginPct} for the installation group, or [] if none
    hostingLineItems, // array of {key, cost, marginPct} for the hosting group
    hardwareMargins, // { hwSs, hwAqm, hwHemir, hwWarranty } - each hardware/warranty line prices independently, same as install/hosting lines
    months,
    structure, recoveryMonths, annualInvoicing, milestones,
    lumpSumDeal, lumpCost, contractorMilestones,
    factoringEnabled, factoringRatePct, factoringTermMonths, factoringMethod,
    whtPct = 0, gstPct = 0, grossUp = false,
    testBedCost = 0, // Milestone 5: carried unchanged from opportunity_details.test_bed_cost
    // when this Opportunity was converted from a Test Bed. Deliberately
    // NOT part of installLineItems/hostingLineItems - those groups price
    // every line to the customer (cost x margin -> price), and this is a
    // sunk R&D cost already incurred before the Opportunity existed, not
    // something billed to this client. Added straight to total cost
    // instead, so it reduces achievedMargin without touching contractNet -
    // DESIGN_PRINCIPLES.md Section 6's description of the (never built)
    // Pilot cost treatment: "reducing net profit and margin for that
    // deal", not a priced line item.
  } = input;

  const hw = calculateHardwareAndWarranty({
    ssUnitCost, ssUnits, aqUnitCost, aqUnits, hemirUnitCost, hemirUnits, warrantyPct,
  });

  const hardwareGroup = buildCostGroup([
    { key: 'hwSs', cost: ssUnitCost * ssUnits, marginPct: hardwareMargins?.hwSs },
    { key: 'hwAqm', cost: aqUnitCost * aqUnits, marginPct: hardwareMargins?.hwAqm },
    { key: 'hwHemir', cost: hemirUnitCost * hemirUnits, marginPct: hardwareMargins?.hwHemir },
    { key: 'hwWarranty', cost: hw.warrantyCost, marginPct: hardwareMargins?.hwWarranty },
  ]);

  const installGroup = buildCostGroup(installLineItems || []);
  const hostingGroup = buildCostGroup(hostingLineItems || []);

  const totals = calculateContractTotals({ hardwareGroup, installGroup, hostingGroup, months });
  const tax = calculateTax(totals.contractNet, whtPct, gstPct, grossUp);

  const cashFlow = buildCashFlowModel({
    months, structure, recoveryMonths, annualInvoicing,
    milestones: milestones || [],
    hardwarePriceAll: totals.oneOffPrice,
    hardwareCostAll: hardwareGroup.rawTotalCost + installGroup.rawTotalCost,
    hostingMonthPrice: hostingGroup.rawTotalPrice,
    hostingMonthCost: hostingGroup.rawTotalCost,
    lumpSumDeal, lumpCost, contractorMilestones: contractorMilestones || [],
    factoringEnabled, factoringRatePct, factoringTermMonths, factoringMethod,
  });

  const financeCost = Math.round(cashFlow.facInterest || 0);
  const testBedCostAmount = testBedCost || 0;
  const totalDealCostAll = totals.totalDealCost + financeCost + tax.whtBorne + testBedCostAmount;
  const achievedMargin = totals.contractNet
    ? ((totals.contractNet - totalDealCostAll) / totals.contractNet) * 100
    : 0;

  return {
    hardware: hw,
    groups: { hardwareGroup, installGroup, hostingGroup },
    totals,
    tax,
    cashFlow,
    financeCost,
    testBedCost: testBedCostAmount,
    totalDealCostAll,
    achievedMargin,
  };
}
