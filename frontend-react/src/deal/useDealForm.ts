import { useCallback, useMemo, useState } from 'react'
import { readDealPayload, pickSalespersonWritable } from './payload'
import type { UiState, Values, CatalogRates } from './payload'
import { resolveRates } from '../../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../../src/lib/deal-calculator.js'

// ── THE FORM'S STATE, AND recompute ──────────────────────────────────────
//
// THE VALUES MAP IS THE STATE, deliberately. `id -> string` is exactly what the
// PROVED reader takes, so the thing under test in Phase 2 and the thing the
// screen holds are the same object. A shape richer than this - typed fields,
// per-input objects - would need converting before every read, and the
// conversion would be a second reader of the form (Verification 20) sitting
// between the screen and a payload already proved exact.
//
// THE EMPTY-STATE CONTRACTS ARE THEREFORE RENDER-LEVEL FACTS, per input, with
// no normalisation: an input writes the string a person typed, `''` included,
// and the reader's four contracts decide what `''` means for that key. Nothing
// between the box and the reader coerces anything.
//
// recompute IS THE VANILLA'S, FUNCTION FOR FUNCTION. resolveRates,
// buildDealInputs and calculateDeal are imported from src/lib untouched, which
// is what makes the payload parity proof sufficient for the whole computation.

export interface DealFormState {
  values: Values
  ui: UiState
  setValue(id: string, next: string): void
  /** Whole-map replacement, for a restore writing a payload into the form. */
  setValues(next: Values): void
  setUi(patch: Partial<UiState>): void
  payload: Record<string, unknown>
  writable: Record<string, unknown>
  result: unknown
  computeError: string | null
}

export const DEFAULT_UI: UiState = {
  installResp: 'Client Own Installation Team',
  structure: 'twoPhase',
  invoicing: 'annual',
  grossUp: false,
  factoringEnabled: false,
  factoringMethod: 'straight',
}

export function useDealForm(
  initialValues: Values, catalogRates: CatalogRates, testBedCost = 0, initialUi: UiState = DEFAULT_UI,
): DealFormState {
  const [values, setValues] = useState<Values>(initialValues)
  const [ui, setUiState] = useState<UiState>(initialUi)

  const setValue = useCallback((id: string, next: string) => {
    setValues((v) => ({ ...v, [id]: next }))
  }, [])
  const setUi = useCallback((patch: Partial<UiState>) => {
    setUiState((u) => ({ ...u, ...patch }))
  }, [])

  const payload = useMemo(
    () => readDealPayload(values, ui, catalogRates), [values, ui, catalogRates])

  // The salesperson-writable projection AT THE EDGE, computed from the payload
  // rather than gathered separately: one reader, one projection.
  const writable = useMemo(() => pickSalespersonWritable(payload), [payload])

  const { result, computeError } = useMemo(() => {
    try {
      const resolution = resolveRates(payload, catalogRates)
      // The cast is a TS inference limit, not a shape disagreement.
      // buildDealInputs' real signature is `(payload, { testBedCost = 0, rates } = {})`
      // and it THROWS when rates is missing; TS infers the options type from the
      // `= {}` default and sees only testBedCost. src/lib moves untouched, so the
      // accommodation belongs here rather than in a JSDoc edit over there.
      const inputs = buildDealInputs(payload,
        { testBedCost, rates: (resolution as { rates: unknown }).rates } as { testBedCost?: number })
      return { result: calculateDeal(inputs), computeError: null }
    } catch (err) {
      // A compute failure is SHOWN, never swallowed. The vanilla panel would
      // throw into the console and leave the last figures on screen, which is
      // the worst outcome on a pricing surface: stale numbers that look live.
      return { result: null, computeError: err instanceof Error ? err.message : String(err) }
    }
  }, [payload, catalogRates, testBedCost])

  return { values, ui, setValue, setValues, setUi, payload, writable, result, computeError }
}
