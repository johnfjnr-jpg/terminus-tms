import type { Values, UiState, CatalogRates } from './payload'
import { readDealPayload, pickSalespersonWritable, readContractorMilestones } from './payload'
import type { ContractorMilestone } from './payload'

// ── THE FORM/VERSION SEAM, AS RULED ──────────────────────────────────────
//
// Round 3 D2b. The first version of this file implemented the FIVE members
// Phase 0 measured, with a test asserting the key set was exactly seven. D2's
// item-0 measurement found ELEVEN names crossing, and two of them carried
// behaviour the five could not express:
//
//   saveVersion:    if (isDealFormDirty()) { const saved = await saveDeal() }
//   restoreVersion: if (isDealFormDirty()) { window.openDiscardConfirm(go) }
//
// TAKING A VERSION SAVES THE DEAL FIRST. A version must freeze what is STORED,
// not what is on screen, so the save is part of versioning rather than a
// courtesy before it. A React form behind the old seam would have let
// saveVersion freeze an unsaved form.
//
// THE RULING FOLDS THAT INTO ONE MEMBER. `freezeCurrentState()` saves if dirty
// and returns what was frozen, so the version machinery cannot get the ORDER
// wrong and cannot forget the save: there is no way to obtain the payload
// except through the call that saves it.
//
// `num('deal-lumpCost')` MEASURED, per the ruling's instruction: exactly one
// `num()` call exists in the version machinery, it reads `deal-lumpCost`, and
// that is a FORM input (census section "installation", markup
// `#deal-lumpCost-group`). So it folds into the return - and it needs no
// member of its own, because `lumpSumCost` is already a payload key. The
// version file reads `frozen.payload.lumpSumCost`.
//
// `opportunityId` and `wired` do NOT appear here. They were module state, and
// the split makes the first an init parameter and the second internal to the
// version file - which is why they were a design question rather than a member.

export interface FrozenState {
  /** What was SAVED, not what is on screen. */
  payload: Record<string, unknown>
  /** The schedule the version refuses to freeze if it does not reconcile. */
  contractorMilestones: ContractorMilestone[]
  /** The rates the version records alongside the inputs. */
  catalogRates: CatalogRates
}

export interface DealFormSeam {
  /**
   * Saves the form if it is dirty, then returns what was frozen.
   *
   * THROWS the save's own error rather than returning a flag: a version taken
   * from a form whose save was refused would freeze a payload the record does
   * not hold, and every caller must deal with that rather than be able to
   * ignore a falsy return.
   */
  freezeCurrentState(): Promise<FrozenState>
  /** Restore asks this before overwriting, and prompts rather than discarding. */
  hasUnsavedChanges(): boolean
  readContractorMilestones(): ContractorMilestone[]
  populateForm(payload: Record<string, unknown>): void
  recompute(): unknown
  /** Read at render time by app.js, never cached. */
  oppCurrentVersionRejection(): unknown
  oppRefreshVersionActions(): void
}

export interface SeamSources {
  getValues(): Values
  getUi(): UiState
  getRates(): CatalogRates
  /** The baseline the form's dirty model compares against. */
  getBaseline(): Record<string, unknown> | null
  /** Resolves when the write has been accepted; rejects with the refusal. */
  save(payload: Record<string, unknown>): Promise<void>
  populate(payload: Record<string, unknown>): void
  recompute(): unknown
  currentVersionRejection(): unknown
  refreshVersionActions(): void
}

export function makeSeam(src: SeamSources): DealFormSeam {
  // One reader for the payload, and it is the PROVED one, so the version
  // machinery freezes exactly the payload the parity proof covers.
  const payloadNow = () => readDealPayload(src.getValues(), src.getUi(), src.getRates())

  const hasUnsavedChanges = () => {
    const baseline = src.getBaseline()
    if (!baseline) return false
    const now = pickSalespersonWritable(payloadNow())
    return JSON.stringify(now) !== JSON.stringify(baseline)
  }

  return {
    hasUnsavedChanges,

    async freezeCurrentState(): Promise<FrozenState> {
      // SAVE FIRST, THEN READ. The order is the whole point of folding these
      // into one member, and it is asserted in the suite rather than left to
      // the reading of this function.
      if (hasUnsavedChanges()) await src.save(pickSalespersonWritable(payloadNow()))
      return {
        payload: payloadNow(),
        contractorMilestones: readContractorMilestones(src.getValues()),
        catalogRates: src.getRates(),
      }
    },

    readContractorMilestones: () => readContractorMilestones(src.getValues()),
    populateForm: (payload) => src.populate(payload),
    recompute: () => src.recompute(),
    oppCurrentVersionRejection: () => src.currentVersionRejection(),
    oppRefreshVersionActions: () => src.refreshVersionActions(),
  }
}

// ── THE SAVE ─────────────────────────────────────────────────────────────
//
// `window.oppPatch` keeps owning the route, the expected_revision, the 409
// retry and the revision adoption. This is a port of `saveDeal`, not a
// reimplementation of the write.
export interface SaveResult { ok: boolean; status?: number; data?: unknown }

export async function saveDeal(
  opportunityId: string,
  payload: Record<string, unknown>,
  oppPatch: (id: string, body: unknown) => Promise<SaveResult>,
): Promise<SaveResult> {
  // The projection, not the payload: sending the raw payload would write the
  // catalog rates onto the record as per-deal overrides.
  return oppPatch(opportunityId, { payload: pickSalespersonWritable(payload) })
}
