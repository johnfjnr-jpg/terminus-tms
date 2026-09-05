import type { Values, UiState, CatalogRates } from './payload'
import { readDealPayload, pickSalespersonWritable, readContractorMilestones } from './payload'

// ── THE INTERIM FORM/VERSION SEAM ────────────────────────────────────────
//
// Round 3 migrates the deal FORM; the version machinery is Round 4. So for one
// round the vanilla version code must be able to call into a React form, and
// Phase 0 measured exactly what crosses - five things, and no more:
//
//   version READS the form   readPayload(), readContractorMilestones(),
//                            catalogRates, and one DOM id, deal-version-reason
//   version WRITES the form  populateForm(payload), then recompute()
//
// `saveVersion` is 129 lines and touches the form through the first four.
// `restoreVersion` is 24 lines and touches it through the last two.
//
// THE REASON BOX IS NOT PROXIED. It is version machinery that happens to live
// in the form's DOM, and Round 4 should take it rather than this seam pretend
// to own it. The vanilla keeps reading its own element.
//
// THE OUTWARD FEEDS ARE PART OF THE SEAM, not extras. app.js calls both by name
// at moments it chooses - `renderOppRejectedBanner` at render time and again
// after stage-approvals resolve - and it does so because the deal module
// renders BEFORE the data they depend on arrives. A React panel that did not
// supply them would leave the approval control hidden on every load.
export interface DealFormSeam {
  readPayload(): Record<string, unknown>
  readContractorMilestones(): unknown[]
  catalogRates(): CatalogRates
  populateForm(payload: Record<string, unknown>): void
  recompute(): unknown
  /** Read at render time by app.js, never cached: the answer changes when the versions arrive. */
  oppCurrentVersionRejection(): unknown
  oppRefreshVersionActions(): void
}

export interface SeamSources {
  getValues(): Values
  getUi(): UiState
  getRates(): CatalogRates
  populate(payload: Record<string, unknown>): void
  recompute(): unknown
  currentVersionRejection(): unknown
  refreshVersionActions(): void
}

export function makeSeam(src: SeamSources): DealFormSeam {
  return {
    // Reads go through the PROVED reader, so the version machinery freezes
    // exactly the payload the parity proof covers. A separate gathering path
    // here would be a second reader of the form (Verification 20) on the one
    // surface where the two must agree.
    readPayload: () => readDealPayload(src.getValues(), src.getUi(), src.getRates()),
    readContractorMilestones: () => readContractorMilestones(src.getValues()),
    catalogRates: () => src.getRates(),
    populateForm: (payload) => src.populate(payload),
    recompute: () => src.recompute(),
    oppCurrentVersionRejection: () => src.currentVersionRejection(),
    oppRefreshVersionActions: () => src.refreshVersionActions(),
  }
}

// ── THE SAVE ─────────────────────────────────────────────────────────────
//
// `window.oppPatch` KEEPS OWNING the route, the expected_revision, the 409
// retry and the revision adoption. Phase 0 measured that the deal module never
// calls the opportunities route itself: it sends a projection and app.js does
// the rest, so this is a port of `saveDeal`, not a reimplementation of the
// write.
export interface SaveResult { ok: boolean; status?: number; data?: unknown }

export async function saveDeal(
  opportunityId: string,
  payload: Record<string, unknown>,
  oppPatch: (id: string, body: unknown) => Promise<SaveResult>,
): Promise<SaveResult> {
  // The projection, not the payload. Sending the raw payload would write the
  // catalog rates onto the record as per-deal overrides.
  return oppPatch(opportunityId, { payload: pickSalespersonWritable(payload) })
}
