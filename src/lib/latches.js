/**
 * THE LATCHES: which panels can be latched, and what a latched panel must
 * still admit. Round 41 item 7, on the business's rulings.
 *
 * ── WHY THIS IS A MODULE AND NOT A HANDFUL OF SELECTORS ────────────────────
 *
 * The rule that matters is rule 3, and it is a claim about the PAYLOAD rather
 * than about the DOM: a latched-off panel holding a missing or overridden input
 * has to say so on its own button. Expressed inline in the render it would be a
 * second reader of isSet() and appliesToDeal(), which is the shape this round
 * has removed four times.
 *
 * ── PANEL LEVEL, DELIBERATELY ─────────────────────────────────────────────
 *
 * Not input-to-number tracing. On this screen nearly every input feeds a visible
 * number, so the panel-level rule gives the same protection without a dependency
 * map that would outlive the feature's session-only scope.
 */
import { isSet, ZERO_IS_NOT_A_VALUE } from './deal-inputs.js';
import { appliesToDeal } from './approval-page.js';

/**
 * NEVER LATCHABLE, and the second one is the business's ruling of 2026-08-30.
 *
 * The top strip, because it is the always-visible read.
 *
 * AND THE P&L SUMMARY. The latches help a person reach a defensible position,
 * and the P&L IS the position: a screen showing four conclusions with the
 * working hidden is not a subtraction, it is abdication. `Show detail` remains
 * the summary's only collapse mechanism, which is why its detail panel is not
 * separately latchable either.
 */
export const NEVER_LATCHABLE = Object.freeze({
  'the top strip': 'the always-visible read, and it holds no inputs at all',
  'deal-section-4': 'the P&L is the position the latches exist to help reach',
});

/**
 * The latchable panels, each with the payload keys it holds that can be MISSING
 * and the controls it holds that can be OVERRIDDEN.
 *
 * `keys`        keys in ZERO_IS_NOT_A_VALUE this panel is where you enter
 * `marginKeys`  per-line margin boxes, where blank prices at target
 * `rateKeys`    installation rate boxes, where blank takes the catalog figure
 */
export const LATCH_PANELS = Object.freeze([
  { id: 'deal-section-1', label: 'Units Required', keys: [], marginKeys: [], rateKeys: [] },
  {
    id: 'deal-section-2',
    label: 'Installation',
    keys: ['lumpSumCost'],
    marginKeys: ['inSsEx', 'inSsNew', 'inAqm', 'inHemir'],
    rateKeys: ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir'],
  },
  {
    id: 'deal-section-3',
    label: 'Structural Terms',
    keys: ['targetMargin', 'warrantyPct', 'duration', 'whtPct', 'gstPct', 'fxContingency'],
    marginKeys: [], rateKeys: [],
  },
  {
    id: 'deal-section-5',
    label: 'Payment Terms',
    keys: ['recoveryMonths', 'factoringRatePct', 'factoringTermMonths'],
    marginKeys: [], rateKeys: [],
  },
  { id: 'deal-section-6', label: 'Cash flow', keys: [], marginKeys: [], rateKeys: [] },
]);

/**
 * The panels on which rule 3 can NEVER fire, named rather than discovered.
 *
 * A latch button that cannot carry a signal is not a defect, but it IS a claim:
 * whoever reads the buttons infers that a silent one means nothing is missing,
 * and on these two it is silent by construction. Unit counts are deliberately
 * outside ZERO_IS_NOT_A_VALUE, each reasoned individually, because zero is a
 * real answer to "how many"; Cash flow holds no inputs at all.
 */
export const NO_SIGNAL_POSSIBLE = Object.freeze(['deal-section-1', 'deal-section-6']);

/**
 * Whether a panel must signal, and what for.
 *
 * MISSING asks both halves: the key is unset AND it applies to this deal. A
 * field that cannot apply is not a gap, which is what the applicability work
 * exists to say.
 *
 * @param {object} panel one of LATCH_PANELS
 * @param {object} payload the deal as the screen holds it
 * @param {{marginOverrides?: object, rateValues?: object, catalogProblem?: boolean}} opts
 */
export function panelSignal(panel, payload, opts = {}) {
  const { marginOverrides = {}, rateValues = {}, catalogProblem = false } = opts;
  const filled = (v) => v !== undefined && v !== null && v !== '';

  const missing = panel.keys.filter((k) => appliesToDeal(k, payload) && !isSet(payload, k));
  const overridden = [
    ...panel.marginKeys.filter((k) => filled(marginOverrides[k])),
    ...panel.rateKeys.filter((k) => filled(rateValues[k])),
  ];

  // ── THE CATALOG FLAG, RULED SEPARATELY AND SCOPED TO ONE PANEL ──────────
  //
  // The business's ruling: latching a panel must not silence the screen's only
  // admission that it is pricing against an absent catalog rate. That notice
  // lives inside section 4, which ruling 1 then made never-latchable, so the
  // flag has no latch button to sit on and rides `Show detail` instead, which
  // ruling 1 names as the summary's only collapse mechanism. Reported at the
  // phase boundary rather than resolved silently.
  const catalog = catalogProblem && panel.carriesCatalogFlag === true;

  return {
    missing, overridden, catalog,
    signalled: missing.length > 0 || overridden.length > 0 || catalog,
  };
}

/**
 * One sentence for a signalled button's title, naming what it is hiding.
 * A signal nobody can resolve into a reason is a dot.
 */
export function signalSentence(signal, panel) {
  const parts = [];
  if (signal.missing.length) parts.push(`${signal.missing.length} value${signal.missing.length === 1 ? '' : 's'} not recorded`);
  if (signal.overridden.length) parts.push(`${signal.overridden.length} override${signal.overridden.length === 1 ? '' : 's'}`);
  if (signal.catalog) parts.push('a catalog problem');
  if (!parts.length) return `${panel.label} is hidden. Nothing in it is missing or overridden.`;
  return `${panel.label} is hidden and holds ${parts.join(' and ')}.`;
}

/**
 * EVERY key that can be missing belongs to exactly one panel, or the signal is
 * a claim about a set nobody checked (CLAUDE.md Verification 19).
 *
 * Returns the keys no panel claims. Used by the suite rather than at runtime.
 */
export function unclaimedMissingKeys() {
  const claimed = new Set(LATCH_PANELS.flatMap((p) => p.keys));
  return ZERO_IS_NOT_A_VALUE.filter((k) => !claimed.has(k));
}
