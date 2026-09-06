// ── THE FIVE SECTIONS THE SCREEN ACTUALLY HAS ────────────────────────────
//
// The vanilla's own ids, because the stylesheet targets them, the latch panels
// in src/lib/latches.js name them, and dirtySections groups by the section an
// input SITS IN. The React panel had invented its own - deal-section-catalog,
// -milestones, -toggles, -ui - which no rule and no latch panel knows about.
//
// Section 4 is deliberately absent from the latchable set: it is the summary,
// which is what the latches are FOR. Hiding it would hide the answer rather
// than the inputs.
import { CENSUS } from './census'
import { dealDirtyKeys, sectionOfKey } from './dirty'

export interface VanillaSection {
  id: string
  title: string
  /** Sections 1 and 2 share one latch and one intake row. */
  intake?: boolean
  latchable: boolean
}

export const VANILLA_SECTIONS: VanillaSection[] = [
  { id: 'deal-sections-1-2', title: 'Units Required and Installation', intake: true, latchable: true },
  { id: 'deal-section-3', title: 'Structural Terms', latchable: true },
  { id: 'deal-section-5', title: 'Payment Terms', latchable: true },
  { id: 'deal-section-6', title: 'Cash flow (USD)', latchable: true },
]

// ── THE MAP, MEASURED FROM THE VANILLA MARKUP RATHER THAN ASSUMED ────────
//
// Every census field was read out of the vanilla's own skeleton and placed
// where the vanilla renders it. The census `section` label and the vanilla
// placement AGREE everywhere except one, and that one is recorded rather than
// smoothed over:
//
//   deal-recoveryMonths carries census section 'structural' and the vanilla
//   renders it in PAYMENT TERMS, beside the invoicing radios, because hardware
//   recovery is a payment-terms question. The census label is not wrong for
//   what it is used for elsewhere; the SCREEN is what this map describes.
const SECTION_OF_CENSUS: Record<string, string> = {
  units: 'deal-sections-1-2',
  installation: 'deal-sections-1-2',
  structural: 'deal-section-3',
  risk: 'deal-section-3',
  payment: 'deal-section-5',
  // Measured from the vanilla skeleton, not inferred from the names:
  // #deal-milestones-tbody is in section 5 and #deal-contractor-tbody is in
  // sections 1-2, beside the installation lump sum it reconciles against.
  milestones: 'deal-section-5',
  contractor: 'deal-sections-1-2',
}

const FIELD_EXCEPTIONS: Record<string, string> = {
  'deal-recoveryMonths': 'deal-section-5',
}

export function vanillaSectionOf(fieldId: string, censusSection: string): string | null {
  return FIELD_EXCEPTIONS[fieldId] ?? SECTION_OF_CENSUS[censusSection] ?? null
}

/** Every census field, grouped by the section the vanilla renders it in. */
// The seven pricing-card margins are rendered by section 4's cards, exactly as
// the vanilla does. Excluded HERE rather than at the call site, so there is one
// place that decides it: rendering them in both produces one id with two
// elements, and readPayload reads whichever the DOM returns first.
export const PRICING_CARD_MARGIN_IDS = new Set(
  ['hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'hoSs', 'hoAqm', 'hoHemir']
    .map((k) => `deal-margin-${k}`))

// Section 5 renders these three itself, inside the payment card and the
// factoring panel, where the vanilla puts them. Same rule as the pricing-card
// margins: the exclusion lives here so one place decides it.
export const SECTION5_OWNED_IDS = new Set(
  ['deal-recoveryMonths', 'deal-factoring-ratePct', 'deal-factoring-termMonths'])

export function censusBySection(): Record<string, typeof CENSUS> {
  const out: Record<string, typeof CENSUS> = {}
  for (const f of CENSUS) {
    if (PRICING_CARD_MARGIN_IDS.has(f.id) || SECTION5_OWNED_IDS.has(f.id)) continue
    const s = vanillaSectionOf(f.id, f.section)
    if (!s) continue
    ;(out[s] ??= [] as unknown as typeof CENSUS).push(f as never)
  }
  return out
}

// ── DIRTY SECTIONS, IN THE SCREEN'S OWN TERMS ────────────────────────────
//
// The vanilla groups a dirty key by the SECTION ITS INPUT SITS IN, walking up
// from the element. React has no DOM to walk at this point, so it maps the key
// the same way the render does - through the field-level map above - which is
// what keeps the save button and the input in the same section.
//
// Mapping at KEY level rather than at census-section level is what carries the
// deal-recoveryMonths exception: it is a 'structural' key rendered in Payment
// Terms, and a save button that appeared over Structural Terms for it would
// point at a section the changed field is not in.
export function dirtyVanillaSections(
  payload: Record<string, unknown>, lastSavedPayload: Record<string, unknown> | null,
): Set<string> {
  const out = new Set<string>()
  for (const key of dealDirtyKeys(payload, lastSavedPayload)) {
    const census = sectionOfKey(key)
    if (!census) continue
    const sec = vanillaSectionOf(`deal-${key}`, census)
    if (sec) out.add(sec)
  }
  return out
}
