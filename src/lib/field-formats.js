/**
 * ── S1: THE FIELD SIZING STANDARD ────────────────────────────────────────
 *
 * John's ruling, 2026-09-26, permanent:
 *
 *   every numeric input declares its maximum format, held in ONE registry, not
 *   per-site literals. An input's width derives from its format string measured
 *   in the input's own computed font, plus fixed padding.
 *
 * THIS FILE IS THAT REGISTRY, and it is the source the standard in
 * DESIGN_PRINCIPLES.md points at. It lives in `src/lib` rather than in the
 * React tree because three readers need it: the components that size the
 * inputs, the estate-wide guard that checks them, and the census that
 * classifies them. Three readers of one table is fine; three tables would be
 * Verification 20.
 *
 * NOTHING HERE MEASURES ANYTHING. Measurement needs a font, which needs a
 * browser, so this module states the formats and derives a width FROM a
 * measurement passed in. That keeps the registry testable without a DOM and
 * keeps the one arithmetic rule in one place.
 */

/**
 * The maximum format each kind of number can hold, as a format string.
 *
 * `x` and `X` are placeholders; the separators are literal. The strings are
 * John's own, from the ruling.
 */
export const FORMATS = {
  'money-large': 'xxx,xxx.xx',
  'money-small': 'x,xxx.xx',
  percent: 'xx.x',
  months: 'XXX',
  count: 'XX',
}

/**
 * THE WIDEST REAL VALUE each format is meant to hold, which is NOT the same
 * width as the format string and that is the whole reason this constant
 * exists.
 *
 * Measured in the estate's own input font, 13px Satoshi:
 *
 *     format        format string   widest real value
 *     money-large       60px              66px
 *     money-small       47px              51px
 *     percent           24px              26px
 *     months            27px              22px
 *     count             18px              15px
 *
 * A DIGIT IS WIDER THAN AN `x` IN A PROPORTIONAL FONT. Sizing to the format
 * string alone would give money-large a 60px box for a value that needs 66px,
 * so the box would clip the very number the format exists to describe. The
 * ruling's 100% to 135% band is what leaves room to fix that: 66px sits inside
 * 60px to 81px, so one width can satisfy the guard AND hold the value.
 *
 * Derived by substituting the widest digit for every placeholder, which is what
 * a format string MEANS rather than a second table of numbers.
 */
export const widestValueFor = (format) =>
  (FORMATS[format] ?? '').replace(/[xX]/g, '9')

/**
 * Fixed padding, in px, added to the measured string.
 *
 * FOUR, AND THE NUMBER IS FORCED RATHER THAN CHOSEN. The ruling's ceiling is
 * 135% of the format string, and the ratio a fixed padding produces is worst
 * for the SHORTEST format.
 *
 * MEASURED IN THE PAGE, in the inputs' own 13px Satoshi, which is where the
 * arithmetic has to be done because sub-pixel widths decide it:
 *
 *     format        format string   widest value   ceiling (135%)   padding left
 *     count             17.06px        15.2px         23.03px           5.97px
 *     percent           23.34px        25.6px         31.51px           5.91px
 *     months            26.6px         21.5px         35.9px            9.3px
 *     money-small       46.6px         50.6px         62.9px           12.3px
 *     money-large       59.0px         65.6px         79.7px           14.1px
 *
 * `count` and `percent` bind it at just under 6px, and the width is CEILED to
 * a whole pixel, which can spend another one. SIX FAILED FOR EXACTLY THAT
 * REASON - measured live at 138%, three points over - so the first attempt at
 * this constant is recorded rather than quietly replaced. Four leaves every
 * format between 117% and 129%, which is inside the band with room for a font
 * that measures slightly differently.
 *
 * `months` still sets the floor from the other side: its widest real value is
 * NARROWER than its format string, so too little padding would put the box
 * under 100%. At four it lands at 117%.
 */
export const FIELD_PADDING_PX = 4

/**
 * The width rule, stated once.
 *
 * `measure` is a function from a string to its width in the INPUT'S OWN font,
 * which the caller supplies because only the caller has the font.
 */
export function widthFor(format, measure) {
  const spec = FORMATS[format]
  if (!spec) throw new Error(`field-formats: no format named ${format}`)
  // The wider of the format string and the widest value it can hold, so the
  // box satisfies the guard AND does not clip.
  return Math.ceil(Math.max(measure(spec), measure(widestValueFor(format)))) + FIELD_PADDING_PX
}

/**
 * ── WHICH FORMAT EACH NUMERIC INPUT TAKES ────────────────────────────────
 *
 * Exact ids first, then patterns for the generated grids. A field that matches
 * nothing is NOT given a default: `formatFor` returns null and the guard
 * reports it, because a silent default would be the per-site literal this
 * registry exists to remove, hidden one level down.
 */
const EXACT = {
  // counts of physical units
  'deal-ssExisting': 'count',
  'deal-ssNew': 'count',
  'deal-aqm': 'count',
  'deal-hemir': 'count',
  // durations
  'deal-duration': 'months',
  'deal-recoveryMonths': 'months',
  'deal-factoring-termMonths': 'months',
  // rates and percentages
  'deal-targetMargin': 'percent',
  'deal-warrantyPct': 'percent',
  'deal-whtPct': 'percent',
  'deal-gstPct': 'percent',
  'deal-fxContingency': 'percent',
  'deal-factoring-ratePct': 'percent',
  // money. N3: Cost (USD) inputs take money-large.
  'deal-lumpCost': 'money-large',
  'deal-inSsExisting': 'money-large',
  'deal-inSsNew': 'money-large',
  'deal-inAqm': 'money-large',
  'deal-inHemir': 'money-large',
}

const PATTERNS = [
  // N3: Margin takes percent.
  [/^deal-margin-/, 'percent'],
  [/^deal-opexmargin-/, 'percent'],
  // An OPEX monthly fee per unit is small money: 3,214.33, not 321,433.00.
  [/^deal-opexfee-/, 'money-small'],
  // The OPEX table's editable unit count, which is a count like any other.
  [/^deal-opexunits-/, 'count'],
  // Milestone and contractor grids: a month, a percentage, a dollar figure.
  [/^deal-(ms|cm)-\d+-month$/, 'months'],
  [/^deal-(ms|cm)-\d+-pct$/, 'percent'],
  [/^deal-(ms|cm)-\d+-usd$/, 'money-large'],
]

/** The format an input takes, or null when the registry does not name it. */
export function formatFor(id) {
  if (!id) return null
  if (EXACT[id]) return EXACT[id]
  for (const [re, f] of PATTERNS) if (re.test(id)) return f
  return null
}

/** Every exactly-named id, for a census that wants to check its own coverage. */
export const NAMED_IDS = Object.keys(EXACT)
