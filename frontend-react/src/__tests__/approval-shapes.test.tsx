// ── THE THIRTEEN SHAPES, RENDERED ────────────────────────────────────────
//
// Derived from the brief's Phase 2 twelve-point list and the Phase 0 report's
// shape enumeration. NOT from ApprovalBlocks.tsx and NOT from the vanilla
// frontend/opportunity-approval.js: Verification 47 governs every test in this
// round, and a test written by reading the component is a test of the
// component's opinion of itself.
//
// Each shape asserts RENDERED TEXT, because the twelve points are statements
// about what an approver can read.
import { describe, test, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AskBlock, MovedBlock, ExposuresBlock, CostBasisBlock, NotRecordedBlock } from '../ApprovalBlocks'
import { build, payload, version, baseline, catalog, RATES, record } from './fixtures'
import { checkReconciliation } from '../../../src/lib/approval-page.js'
import type { ApprovalPage, Bridge } from '../approval-types'

// Rendered markup to the text a person reads, so an assertion cannot be
// satisfied by a class name or an attribute.
const asText = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()

const moved = (p: ApprovalPage) => asText(renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />))
const ask = (p: ApprovalPage) => asText(renderToStaticMarkup(<AskBlock ask={p.ask} />))
const cost = (p: ApprovalPage) => asText(renderToStaticMarkup(<CostBasisBlock costBasis={p.costBasis} />))
const notRec = (p: ApprovalPage) => asText(renderToStaticMarkup(<NotRecordedBlock rows={p.notRecorded} />))
const expo = (p: ApprovalPage) => asText(renderToStaticMarkup(<ExposuresBlock exposures={p.exposures} />))

// A baseline carrying cost-basis keys is what makes a bridge COMPARABLE.
const PRICED_BASE = payload({ ...RATES })

describe('shape 1: bridge present, and comparable', () => {
  const p = build({
    payload: payload({ ...RATES, targetMargin: 35, ssExisting: 12 }),
    version: version(), baseline: baseline(PRICED_BASE),
  })

  test('the bridge exists and is comparable', () => {
    expect(p.moved.bridge).not.toBeNull()
    expect(p.moved.bridge!.comparable).toBe(true)
    expect(p.moved.caveat ?? null).toBeNull()
  })

  test('point 10: opening and closing FRAME the bridge, with the rule above closing', () => {
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    expect(html).toContain('ds-row appr-frame"')
    expect(html).toContain('ds-row appr-frame appr-frame-close"')
    const t = asText(html)
    expect(t).toMatch(/Opening/)
    expect(t).toMatch(/Closing/)
    expect(t).toMatch(/Total movement [+-]\d+\.\d\d pts/)
  })

  test('the baseline is named with the revision it was approved at', () => {
    expect(moved(p)).toMatch(/Against V1, approved at revision 3 on 2026-08-01\./)
  })

  test('point 1: every figure comes from the server, so the rendered opening equals it', () => {
    expect(moved(p)).toContain(`${p.moved.bridge!.opening.marginPoints.toFixed(2)}%`)
    expect(moved(p)).toContain(`${p.moved.bridge!.closing.marginPoints.toFixed(2)}%`)
  })
})

describe('shape 2: stated absence', () => {
  const p = build({ payload: payload(), version: version(), baseline: null })

  test('point 7: no baseline renders the absence sentence, never an empty block', () => {
    expect(p.moved.bridge).toBeNull()
    const t = moved(p)
    expect(t).toContain('First approval. No prior approved version.')
    expect(t.length).toBeGreaterThan(80)
  })

  test('the target block still renders, because target applies without a baseline', () => {
    // The label, the NOTE and the value are three siblings in that DOM order,
    // so a regex spanning label to value fails on the note between them. The
    // parts are asserted separately, which is also the honest claim: a row is
    // three things, not one sentence.
    const t = moved(p)
    expect(t).toContain('Against target')
    expect(t).toMatch(/(above|below) by \d+\.\d\d pts/)
    expect(t).toMatch(/Achieved \d+\.\d\d% against target 30%/)
  })
})

// ── SHAPES 3, 4 AND 5 ARE UNREACHABLE THROUGH buildApprovalPage TODAY ─────
//
// MEASURED, not assumed, and this is a Phase 3 finding rather than a fixture
// convenience:
//
//   NON-RECONCILING. `rounding` is the display error of
//   (closing - opening - sum(steps)). Sequential attribution telescopes, so the
//   true value is 0 and each toFixed(2) contributes at most 0.005, over
//   steps + 2 terms. `tolerance` IS (steps + 2) x 0.005. The bound and the
//   tolerance are the same quantity, so reconciles can be false ONLY if
//   telescoping itself fails.
//   Searched 810 payload pairs: 273 produced a non-zero rounding line and NOT
//   ONE failed to reconcile.
//
//   UNEXPLAINED. `total - summed`, zero for the same telescoping reason.
//
//   UNASSIGNED KEYS. pricedKeys() minus every key a step claims. Computed:
//   23 priced keys, 30 claimed, and the difference is EMPTY. No payload change
//   can leave a priced key unclaimed.
//
// All three are fail-safes for a FUTURE change - a step applied out of order, a
// new priced key added to the calculation and not to a step. That is a good
// reason for them to exist and no reason at all for their rendering to be
// untested, so the state is produced HERE by the system's own
// checkReconciliation, given step effects that do not telescope. That is the
// exact condition the guard exists for, and it is the system computing it.
function nonTelescoping(p: ApprovalPage, over: Partial<Bridge>): ApprovalPage {
  const b = p.moved.bridge!
  return { ...p, moved: { ...p.moved, bridge: { ...b, ...over } } }
}

describe('shape 3: the bridge does not reconcile', () => {
  const base = build({ payload: payload({ ...RATES, targetMargin: 35 }), version: version(), baseline: baseline(PRICED_BASE) })
  const recon = checkReconciliation(10, 20, [1, 1, 1]) as { rounding: number; tolerance: number; reconciles: boolean }
  const p = nonTelescoping(base, { reconciliation: recon, displayRounding: recon.rounding })

  test('the system itself reports it as not reconciling', () => {
    expect(recon.reconciles).toBe(false)
  })

  test('point 6: it is an error telling the approver not to rely on the figures', () => {
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    expect(html).toContain('msg-error')
    const t = asText(html)
    expect(t).toContain('This bridge does not reconcile')
    expect(t).toContain('Do not rely on the figures below; report this.')
    expect(t).toMatch(/against a rounding tolerance of 0\.025/)
  })

  test('and it is NOT printed as a rounding row', () => {
    expect(moved(p)).not.toMatch(/Rounding [+-]?\d/)
  })
})

describe('shape 4: an unexplained residual', () => {
  const base = build({ payload: payload({ ...RATES, targetMargin: 35 }), version: version(), baseline: baseline(PRICED_BASE) })
  const p = nonTelescoping(base, { unexplained: 0.4212 })

  test('point 6: it is its own error, distinct from the reconciliation one', () => {
    const t = moved(p)
    expect(t).toContain('0.4212 points are unexplained')
    expect(t).toContain('The bridge does not reconcile; do not rely on it.')
    // The reconciliation sentence is a DIFFERENT fault and must not appear
    // just because this one did.
    expect(t).not.toContain('This bridge does not reconcile. The steps leave')
  })
})

describe('shape 5: a priced key no step accounts for', () => {
  const base = build({ payload: payload({ ...RATES, targetMargin: 35 }), version: version(), baseline: baseline(PRICED_BASE) })
  const p = nonTelescoping(base, { unassignedKeys: ['warrantyPct', 'gstPct'] })

  test('it is a warning naming the keys, not an error', () => {
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    expect(html).toContain('msg-warning')
    expect(asText(html)).toContain('Changed and not accounted for by any step: warrantyPct, gstPct.')
  })
})

describe('shape 6 and 7: missing cost basis, in use and not in use', () => {
  const inUse = build({
    payload: payload(), version: version(), baseline: null,
    catalog: catalog({ missing: ['safesight'] }),
  })
  const notInUse = build({
    payload: payload({ ssExisting: 0, ssNew: 0 }), version: version(), baseline: null,
    catalog: catalog({ missing: ['safesight'] }),
  })

  test('point 8: in use renders the zero-cost warning WITH the unit count', () => {
    const detail = inUse.costBasis.missingDetail.find((m) => m.product === 'safesight')
    expect(detail?.inUse).toBe(true)
    const html = renderToStaticMarkup(<CostBasisBlock costBasis={inUse.costBasis} />)
    expect(html).toContain('msg-error')
    const t = asText(html)
    expect(t).toContain('No current Base Cost batch for SafeSight.')
    expect(t).toContain(`This deal carries ${detail!.units} of them`)
    expect(t).toContain('priced at ZERO cost')
    expect(t).toContain('higher than the deal will achieve')
  })

  test('point 8: not in use renders the not-affected note, and NOT the warning', () => {
    const detail = notInUse.costBasis.missingDetail.find((m) => m.product === 'safesight')
    expect(detail?.inUse).toBe(false)
    const html = renderToStaticMarkup(<CostBasisBlock costBasis={notInUse.costBasis} />)
    const t = asText(html)
    expect(t).toContain('This deal carries none of them, so nothing on this page is affected by it.')
    expect(t).not.toContain('priced at ZERO cost')
    expect(html).not.toContain('msg-error')
  })

  test('the product label is a product name, not a database value', () => {
    expect(cost(inUse)).toContain('SafeSight')
    expect(cost(inUse)).not.toContain('safesight')
  })
})

describe('shape 8: nothing is running on a default', () => {
  test('an empty notRecorded says so rather than rendering an empty block', () => {
    const t = asText(renderToStaticMarkup(<NotRecordedBlock rows={[]} />))
    expect(t).toBe('Every field on this deal was set by a person. Nothing is running on a default.')
  })
})

describe('shape 9: no version has been taken', () => {
  const p = build({ payload: payload(), version: null, baseline: null })

  test('the ask says so rather than pretending', () => {
    expect(ask(p)).toContain('No version has been taken. There is nothing to approve yet.')
  })

  test('and it renders no version row, because there is no version to describe', () => {
    expect(ask(p)).not.toContain('Taken from revision')
  })
})

describe('shape 10: a baseline that is not comparable', () => {
  // A baseline whose inputs carry NO cost-basis keys. Its lines priced at zero,
  // so the steps are not a comparison of two priced deals.
  const p = build({
    payload: payload({ ...RATES }), version: version(),
    baseline: baseline(payload()),
  })

  test('the system reports it as not comparable', () => {
    expect(p.moved.bridge).not.toBeNull()
    expect(p.moved.bridge!.comparable).toBe(false)
    expect(p.moved.caveat).toBeTruthy()
  })

  test('point 6: the caveat says it must not be read as a comparison', () => {
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    expect(html).toContain('msg-error')
    const t = asText(html)
    expect(t).toContain('carries no cost basis, so its lines priced at zero')
    expect(t).toContain('not a comparison of two priced deals and must not be read as one')
  })

  test('and the bridge still renders beneath it, caveated rather than withheld', () => {
    expect(moved(p)).toMatch(/Opening/)
    expect(moved(p)).toMatch(/Closing/)
  })
})

describe('shape 11: a deal with no cash exposure', () => {
  const p = build({ payload: payload({ invoicing: 'upfront', structure: 'single' }), version: version(), baseline: null })

  test('every exposure renders as money with a stated basis, not a percentage', () => {
    const t = expo(p)
    expect(p.exposures.length).toBeGreaterThan(0)
    for (const e of p.exposures) expect(t).toContain(e.label)
    expect(t).toContain('Money at risk, not the percentages that produced it.')
    expect(t).toMatch(/(borne by Terminus|not borne)/)
  })
})

describe('shape 12: a conditional disclosure fires, and stays silent', () => {
  // recoveryMonths applies to twoPhase and does not apply to single.
  const twoPhase = build({ payload: payload({ structure: 'twoPhase', recoveryMonths: undefined }), version: version(), baseline: null })
  const single = build({ payload: payload({ structure: 'single', recoveryMonths: undefined }), version: version(), baseline: null })

  test('it fires when the field applies to this deal', () => {
    expect(twoPhase.notRecorded.some((r) => r.key === 'recoveryMonths')).toBe(true)
    expect(notRec(twoPhase)).toContain('Recovery months')
  })

  test('it stays silent when the field cannot apply to this deal', () => {
    expect(single.notRecorded.some((r) => r.key === 'recoveryMonths')).toBe(false)
    expect(notRec(single)).not.toContain('Recovery months')
  })

  test('point 2: what it does render is a value AND its provenance, never a blank', () => {
    const rows = build({ payload: payload({ whtPct: undefined }), version: version(), baseline: null })
    const row = rows.notRecorded.find((r) => r.key === 'whtPct')
    expect(row?.sentence).toBeTruthy()
    const t = notRec(rows)
    expect(t).toContain('Withholding tax %')
    expect(t).toContain(row!.sentence as string)
    expect(t).not.toMatch(/Withholding tax % --/)
  })
})

describe('shape 13: an absent governing input fails loud', () => {
  // The governing input for recoveryMonths is `structure`. With it missing the
  // disclosure must FIRE rather than be skipped, which is the deliberate
  // fail-loud branch: a field that cannot be shown not to apply is disclosed.
  const p = build({ payload: payload({ structure: undefined, recoveryMonths: undefined }), version: version(), baseline: null })

  test('the disclosure fires rather than being skipped', () => {
    expect(p.notRecorded.some((r) => r.key === 'recoveryMonths')).toBe(true)
    expect(notRec(p)).toContain('Recovery months')
  })
})

// ── POINTS THAT ARE NOT SHAPES ───────────────────────────────────────────

describe('point 9: the change-note cap', () => {
  // A step carrying more than three changes. Produced by moving many keys at
  // once, which is what a catalog reprice does.
  // The 'risk terms' step claims warrantyPct, whtPct, gstPct, grossUp,
  // fxContingency, factoring and contractorMilestones. Moving five of them at
  // once is one step carrying five changes, which is what a terms renegotiation
  // does and is exactly the wall of note-sized text the cap exists for.
  const p = build({
    payload: payload({
      ...RATES, warrantyPct: 9, whtPct: 15, gstPct: 7, grossUp: true, fxContingency: 3,
    }),
    version: version(),
    baseline: baseline({ ...PRICED_BASE, grossUp: false, fxContingency: 0 }),
  })

  test('a step with more than three changes names three, then counts the rest', () => {
    const big = p.moved.bridge!.steps.find((s) => s.changes.length > 3)
    expect(big, 'no step carried more than three changes; the cap is untested').toBeTruthy()
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    expect(asText(html)).toMatch(new RegExp(`and ${big!.changes.length - 3} more`))
  })

  test('and the full list survives in the title attribute', () => {
    const big = p.moved.bridge!.steps.find((s) => s.changes.length > 3)!
    const html = renderToStaticMarkup(<MovedBlock moved={p.moved} target={p.target} />)
    const titles = [...html.matchAll(/title="([^"]*)"/g)].map((m) => m[1])
    const full = titles.find((t) => t.split(' | ').length === big.changes.length)
    expect(full, 'no title carried every change').toBeTruthy()
  })
})

describe('point 11: escaping, with no dangerouslySetInnerHTML anywhere', () => {
  const XSS = '<img src=x onerror="alert(1)">Deal & Co "quoted" \'apostrophe\''
  const p = build({ payload: payload(), version: version({ reason: XSS }), baseline: null })

  test('markup in a version reason is escaped, not emitted', () => {
    const html = renderToStaticMarkup(<AskBlock ask={p.ask} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    // And it is still READABLE: escaping that loses the text is a different bug.
    expect(asText(html)).toContain('<img src=x onerror="alert(1)">Deal & Co "quoted"')
  })
})

describe('point 1: nothing is computed client-side', () => {
  const p = build({
    payload: payload({ ...RATES, targetMargin: 35 }), version: version(), baseline: baseline(PRICED_BASE),
  })

  test('every figure rendered is a formatting of a figure the server sent', () => {
    const t = moved(p)
    const b = p.moved.bridge!
    // The three the block asserts a relationship between. If the view derived
    // any of them the rendered value would differ from the server's own.
    expect(t).toContain(b.opening.marginPoints.toFixed(2))
    expect(t).toContain(b.closing.marginPoints.toFixed(2))
    expect(t).toContain(b.total.marginPoints.toFixed(2))
    for (const s of b.steps) expect(t).toContain(s.marginPoints.toFixed(2))
  })

  test('the ask renders the server margin, not one recomputed from net and cost', () => {
    const a = build({ payload: payload({ ...RATES }), version: version(), baseline: null })
    expect(ask(a)).toContain(`${a.ask.achievedMargin.toFixed(2)}%`)
  })
})
