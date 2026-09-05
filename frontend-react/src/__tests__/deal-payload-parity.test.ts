// ── THE PARITY PROOF ─────────────────────────────────────────────────────
//
// The round's central claim, and the brief states it as a reduction: the React
// panel imports resolveRates, buildDealInputs and calculateDeal from src/lib
// UNTOUCHED, exactly as the vanilla does. So the whole computational claim
// reduces to
//
//   for identical visible inputs, the React payload reader produces a payload
//   deep-equal to readPayload()'s.
//
// THE VANILLA READER IS EXECUTED, NOT REIMPLEMENTED. Its source is extracted
// from frontend/opportunity-deal.js and run against a jsdom document built from
// the same corpus entry the React reader is given a values map for. Writing a
// second copy of it here would prove the two copies agree and nothing else -
// Verification 20, and the exact fault this test exists to rule out.
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { readDealPayload, pickSalespersonWritable, MARGIN_KEYS, MILESTONE_ROWS } from '../deal/payload'
import type { UiState, Values, CatalogRates } from '../deal/payload'

// Resolved from cwd, not from import.meta.url: under Vite a module's URL is an
// http one served through /@fs, so neither .pathname nor fileURLToPath yields a
// filesystem path. vitest runs with cwd at the workspace root.
const VANILLA = resolve(process.cwd(), '../frontend/opportunity-deal.js')
const src = readFileSync(VANILLA, 'utf8')

// Every id the vanilla reader touches, derived from its own source rather than
// listed here: a corpus built from a hand-typed list would stop covering the
// reader the moment somebody added an input.
const IDS = [...new Set([...src.matchAll(/'(deal-[a-zA-Z0-9-]+)'/g)].map((m) => m[1]))]
  .concat(
    Array.from({ length: MILESTONE_ROWS }, (_, i) =>
      [`deal-ms-${i}-month`, `deal-ms-${i}-label`, `deal-ms-${i}-usd`, `deal-ms-${i}-pct`,
       `deal-cm-${i}-month`, `deal-cm-${i}-label`, `deal-cm-${i}-usd`, `deal-cm-${i}-pct`]).flat(),
    MARGIN_KEYS.map((k) => `deal-margin-${k}`),
  )

// ── THE VANILLA READER, EXTRACTED AND EXECUTED ───────────────────────────
// The helpers and readPayload are lifted verbatim and evaluated with a document
// and a uiState supplied from outside. Nothing is rewritten.
function makeVanillaReader() {
  const grab = (name: string, kind = 'function') => {
    const i = src.indexOf(`${kind} ${name}(`)
    if (i < 0) throw new Error(`could not find ${kind} ${name} in the vanilla source`)
    // Balance braces from the first { after the signature.
    const open = src.indexOf('{', i)
    let depth = 0
    for (let j = open; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1) }
    }
    throw new Error(`unbalanced ${name}`)
  }
  const parts = ['num', 'emptyToNull', 'numOrNull', 'numOrUndefined',
    'readMilestones', 'readContractorMilestones', 'readPayload', 'pickSalespersonWritable']
    .map((n) => grab(n)).join('\n\n')
  const mk = src.match(/const MARGIN_KEYS\s*=\s*\[[^\]]*\]/)![0]
  const ck = src.match(/const COMMERCIALS_OWNED_KEYS\s*=\s*\[[\s\S]*?\]/)![0]
  const mr = src.match(/const MILESTONE_ROWS\s*=\s*\d+/)![0]
  const factory = new Function('document', 'uiState', 'catalogRates', 'toNumberOrNull',
    `${mk}\n${ck}\n${mr}\n${parts}\nreturn { readPayload, pickSalespersonWritable }`)
  return factory
}
const vanillaFactory = makeVanillaReader()

async function vanillaRead(values: Values, ui: UiState, rates: CatalogRates) {
  const { toNumberOrNull } = await import('../../../src/lib/numeric-payload.js')
  const dom = new JSDOM('<!doctype html><body></body>')
  const doc = dom.window.document
  for (const id of IDS) {
    if (values[id] === undefined) continue      // an absent id is an ABSENT ELEMENT
    const el = doc.createElement('input')
    el.id = id
    el.value = values[id] as string
    doc.body.appendChild(el)
  }
  const { readPayload, pickSalespersonWritable: vPick } = vanillaFactory(doc, ui, rates, toNumberOrNull)
  return { payload: readPayload(), pick: vPick }
}

const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const RATES: CatalogRates = {
  ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200,
  hoSafesight: 10, hoAqm: 8, hoHemir: 12,
}

// ── THE CORPUS ───────────────────────────────────────────────────────────
//
// Crosses the four empty-state contracts rather than averaging them, which is
// the Phase 0 finding: a corpus that never empties a margin box cannot see the
// numOrUndefined deletion contract at all.
const filled = (): Values => {
  const v: Values = {}
  for (const id of IDS) v[id] = '3'
  v['deal-bidCurrency'] = 'USD'; v['deal-proposalCurrency'] = 'SGD'
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    v[`deal-ms-${i}-label`] = `M${i}`; v[`deal-cm-${i}-label`] = `C${i}`
  }
  return v
}
const empty = (): Values => Object.fromEntries(IDS.map((id) => [id, '']))

const CORPUS: { name: string; values: Values }[] = [
  { name: 'every box filled', values: filled() },
  { name: 'every box EMPTY', values: empty() },
  { name: 'every element ABSENT', values: {} },
  // numOrUndefined: each margin key empty on its own, so the dropped key is
  // visible one at a time rather than only in aggregate.
  ...MARGIN_KEYS.map((k) => ({
    name: `margin ${k} empty (numOrUndefined drops the key)`,
    values: { ...filled(), [`deal-margin-${k}`]: '' },
  })),
  ...MARGIN_KEYS.slice(0, 3).map((k) => ({
    name: `margin ${k} ABSENT element`,
    values: (() => { const v = filled(); delete v[`deal-margin-${k}`]; return v })(),
  })),
  // numOrNull
  { name: 'numOrNull: gstPct empty', values: { ...filled(), 'deal-gstPct': '' } },
  { name: 'numOrNull: duration empty', values: { ...filled(), 'deal-duration': '' } },
  { name: 'numOrNull: recoveryMonths empty', values: { ...filled(), 'deal-recoveryMonths': '' } },
  { name: 'numOrNull: non-numeric text', values: { ...filled(), 'deal-targetMargin': 'abc' } },
  // emptyToNull
  { name: 'emptyToNull: bidCurrency empty', values: { ...filled(), 'deal-bidCurrency': '' } },
  { name: 'emptyToNull: proposalCurrency absent', values: (() => { const v = filled(); delete v['deal-proposalCurrency']; return v })() },
  // num: empty is a VALUE, zero
  { name: 'num: factoring rate empty is ZERO', values: { ...filled(), 'deal-factoring-ratePct': '' } },
  { name: 'num: factoring term non-numeric is ZERO', values: { ...filled(), 'deal-factoring-termMonths': 'x' } },
  // milestone filters
  { name: 'milestone with month and no amount', values: { ...filled(), 'deal-ms-0-usd': '0' } },
  { name: 'milestone with amount and no month', values: { ...filled(), 'deal-ms-1-month': '0' } },
  { name: 'contractor row with amount and NO month (incomplete)', values: { ...filled(), 'deal-cm-0-month': '0' } },
  { name: 'contractor pct empty stays NULL, not zero', values: { ...filled(), 'deal-cm-1-pct': '' } },
  { name: 'decimals throughout', values: Object.fromEntries(IDS.map((id) => [id, '2.5'])) },
  { name: 'negatives throughout', values: Object.fromEntries(IDS.map((id) => [id, '-4'])) },
]

// Latch states and uiState variants: the payload's non-input half.
const UI_VARIANTS: UiState[] = [
  UI,
  { ...UI, structure: 'single', invoicing: 'milestones', grossUp: true },
  { ...UI, factoringEnabled: true, factoringMethod: 'discount', installResp: 'Client Own Installation Team' },
]

describe('payload parity: the React reader against the executed vanilla reader', () => {
  test('the corpus covers every empty-state contract', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(20)
    expect(CORPUS.some((c) => /numOrUndefined/.test(c.name))).toBe(true)
    expect(CORPUS.filter((c) => /^margin .* empty/.test(c.name))).toHaveLength(MARGIN_KEYS.length)
    expect(IDS.length).toBeGreaterThan(30)
  })

  for (const entry of CORPUS) {
    for (const [ui, i] of UI_VARIANTS.map((u, i) => [u, i] as const)) {
      test(`${entry.name} [ui ${i}]`, async () => {
        const { payload: vanilla } = await vanillaRead(entry.values, ui, RATES)
        const react = readDealPayload(entry.values, ui, RATES)
        expect(react).toEqual(vanilla)
        // toEqual ignores undefined-valued keys; the deletion contract needs
        // the KEY SET compared too, or a dropped margin key would pass.
        expect(Object.keys(react.marginOverrides as object).sort())
          .toEqual(Object.keys((vanilla as Record<string, object>).marginOverrides).sort())
      })
    }
  }

  test('and the salesperson-writable projection matches, key set included', async () => {
    for (const entry of CORPUS) {
      const { payload: vanilla, pick } = await vanillaRead(entry.values, UI, RATES)
      const react = pickSalespersonWritable(readDealPayload(entry.values, UI, RATES))
      expect(react, entry.name).toEqual(pick(vanilla))
      expect(Object.keys(react).sort(), entry.name).toEqual(Object.keys(pick(vanilla)).sort())
    }
  })

  // ── NO OWNED KEY IS EVER `undefined` IN THE PROJECTION ─────────────────
  //
  // `toEqual` treats an undefined-valued key as absent, and `Object.keys`
  // counts it as present, so neither of the assertions above can see the
  // difference between `null` and `undefined` at the top level. This one can.
  //
  // IT WAS ADDED BECAUSE A CALIBRATION DID NOT FIRE. Removing the
  // `undefined ? null` coercion from pickSalespersonWritable changed nothing,
  // and the reason turned out to be worth recording rather than patching over:
  // see the "unreachable branch" test below.
  test('every owned key is present and NOT undefined, which the equality checks cannot see', async () => {
    for (const entry of CORPUS) {
      const react = pickSalespersonWritable(readDealPayload(entry.values, UI, RATES))
      for (const [k, v] of Object.entries(react)) {
        expect(v, `${entry.name}: owned key ${k} is undefined, which a save reads as deletion`)
          .not.toBe(undefined)
      }
    }
  })

  // ── THE COERCION'S BRANCH IS UNREACHABLE FROM THIS READER ──────────────
  //
  // Verification 9: a branch nobody has watched fail. `readDealPayload` assigns
  // EVERY one of the 26 owned keys unconditionally - marginOverrides is always
  // an object, the milestone readers always return arrays - so `payload[key]`
  // is never undefined and the `? null` never runs.
  //
  // It is correct defensive code and it stays: it is the projection's guarantee
  // to the save path, not this reader's. But it is not evidence about this
  // reader, and the vanilla shares the identical unreachable branch, so parity
  // holds either way. Asserted directly rather than left as a passing
  // calibration that proved nothing.
  test('the undefined-to-null coercion cannot be reached from this reader', () => {
    for (const entry of CORPUS) {
      const payload = readDealPayload(entry.values, UI, RATES)
      const owned = Object.keys(pickSalespersonWritable(payload))
      const undef = owned.filter((k) => payload[k] === undefined)
      expect(undef, `${entry.name}: reachable now, so the coercion is live and needs its own corpus entry`)
        .toEqual([])
    }
  })
})
