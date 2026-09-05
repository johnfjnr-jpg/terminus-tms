import type { UiState } from './payload'

// ── THE INSTALLATION TAB AND THE BUTTON STATE MACHINERY ──────────────────
//
// All of it is a pure function of uiState in the vanilla too - the functions
// only differ in that they write classes instead of returning a shape. Ported
// as returned shapes so the behaviour can be asserted without a DOM.

export interface InstallVisibility {
  table: boolean          // per-unit rows
  signpost: boolean       // appears EXACTLY when the rows it points at do
  seeTable: boolean
  lumpCostGroup: boolean
  contractorGroup: boolean
  notApplicable: boolean
}

export function installVisibility(ui: UiState): InstallVisibility {
  const isPerUnit = ui.installResp.includes('Per Unit')
  const isLumpSum = ui.installResp.includes('Lump Sum')
  return {
    table: isPerUnit,
    // ONE CONDITION, READ ONCE, rather than a second test that could drift.
    signpost: isPerUnit,
    seeTable: isPerUnit,
    lumpCostGroup: isLumpSum,
    contractorGroup: isLumpSum,
    notApplicable: !isPerUnit && !isLumpSum,
  }
}

export interface StructureVisibility {
  topScheduleRow: boolean
  invoicingToggle: boolean
  recoveryGroup: boolean
  recoveryReadonly: boolean
  hybridGroup: boolean
}

// Hybrid replaces the recovery row and the invoicing radios with its own
// milestone table and hosting-only schedule.
export function structureVisibility(ui: UiState): StructureVisibility {
  const s = ui.structure
  return {
    topScheduleRow: s !== 'hybrid',
    invoicingToggle: s !== 'hybrid',
    recoveryGroup: s === 'twoPhase',
    recoveryReadonly: s === 'single',
    hybridGroup: s === 'hybrid',
  }
}

export interface ToggleState { label: string; on: boolean; title: string; ariaChecked: 'true' | 'false' }

// W-E: the same treatment as the factoring toggle, because it is the same
// control in every way that matters - a boolean that changes the pricing. Two
// controls one section apart behaving identically and looking different is a
// thing to learn twice.
export function grossUpToggle(ui: UiState): ToggleState {
  const on = ui.grossUp
  return {
    on,
    label: on ? 'Gross up enabled' : 'Gross up disabled',
    ariaChecked: on ? 'true' : 'false',
    title: on
      ? 'Withholding tax is grossed up and recovered from the customer. Click to turn it off.'
      : 'Withholding tax is absorbed by Terminus. Click to turn it on.',
  }
}

export function factoringToggle(ui: UiState): ToggleState {
  const on = ui.factoringEnabled
  return {
    on,
    label: on ? 'PO factoring enabled' : 'PO factoring disabled',
    ariaChecked: on ? 'true' : 'false',
    title: on
      ? 'The facility is on and its cost is priced in. Click to turn it off.'
      : 'No factoring facility. Click to turn it on.',
  }
}

export const structureIsActive = (ui: UiState, key: string) => ui.structure === key
export const invoicingIsActive = (ui: UiState, key: string) => ui.invoicing === key
