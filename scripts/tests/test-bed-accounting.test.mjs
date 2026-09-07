// ── THE TEST BED SURFACE'S CAPABILITY ACCOUNTING ────────────────────────
//
// Round 7 Phase 0, and it runs BEFORE the field census by instruction. Round 6
// censused a surface's fields twice with two reconciled instruments, passed a
// twelve-position checklist and an eighteen-injection sweep, and then swapped
// away five working capabilities - because not one of them was a field.
//
// THE CAPABILITY LIST, NOT THE FIELD LIST, IS THIS SURFACE'S SCOPE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { topLevelNames, reachability } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url)
const SOURCE = () => readFileSync(new URL('frontend/test-bed-detail.js', ROOT), 'utf8')

// `migrated` HAS A READER, which is what stops it being bookkeeping prose that
// rots (Verification 22, and Architecture 9's fourth variant). Every capability
// names the React modules that implement it, and the flag is asserted to AGREE
// with whether those files exist on disk. A flag flipped without a module, or a
// module deleted under a flag, fails.
const CAPABILITIES = {
  'view-lifecycle': { migrated: false, modules: [], names: [
    'tbDetailId', 'tbBed', 'tbPayload', 'tbLoadedRevision', 'tbWired',
    'initTestBedDetailPanel', 'wireTbOnce', 'renderTbReference',
    'mountTbReferenceSubTabs', 'captureTbOpenEdits', 'restoreTbOpenEdits'] },

  'field-rows': { migrated: true, modules: ['descriptors.ts', 'TestBedPanel.tsx'], names: [
    'tbEdits', 'REGION_OPTIONS', 'INSTALLATION_ENVIRONMENT_OPTIONS',
    'SITE_OWNERSHIP_OPTIONS', 'TB_NAME_FIELD', 'TB_TERMINUS_FIELDS',
    'TB_CUSTOMER_FIELDS', 'TB_SUMMARY_FIELD', 'TB_SITE_FIELDS',
    'TB_SENSOR_COUNT_FIELDS', 'TB_DATE_FIELDS', 'TB_COST_FIELDS',
    'TB_INSTALL_FIELDS', 'TB_ALL_EDITABLE_FIELDS', 'tbFieldLabel', 'tbFieldRow',
    'tbReadonlyRow', 'tbEffectiveValue', 'wireTbFieldInputs', 'openTbField',
    'discardTbField', 'onTbFieldInput', 'updateTbSaveBar', 'clearTbSaveFeedback'] },

  'save-path': { migrated: true, modules: ['TestBedHost.tsx'], names: [
    'tbPatch', 'tbStaleMessage', 'saveTbFields', 'saveTbDirtyEntries'] },

  'cost-preview': { migrated: true, modules: ['costPreview.ts'], names: [
    'TB_COST_INPUT_KEYS', 'tbCostPreview', 'tbCostPreviewTimer',
    'tbCostFieldsDirty', 'scheduleTbCostPreview', 'runTbCostPreview',
    'renderTbCostBreakdown'] },

  'date-bounds': { migrated: true, modules: ['dateBounds.ts'], names: ['refreshTbDateBounds'] },

  validation: { migrated: false, modules: [], names: [
    'tbInvalidFields', 'tbValidateNumeric', 'tbMarkFieldValidity',
    'renderTbValidationFeedback', 'guardNumericEntry'] },

  'notes-history': { migrated: false, modules: [], names: [
    'tbNotesExpanded', 'toggleTbNotes', 'tbNoteStageChip', 'tbNewNote',
    'renderTbNotes', 'addTbNote'] },

  'revision-history': { migrated: false, modules: [], names: ['renderTbHistory'] },

  'site-details': { migrated: false, modules: [], names: ['TB_SITE_PANEL_KEYS', 'renderTbSiteDetails'] },

  commercials: { migrated: false, modules: [], names: ['renderTbCommercials'] },

  'install-section': { migrated: false, modules: [], names: [
    'renderTbInstallSection', 'renderTbInstallNotes', 'addTbInstallNote'] },

  installer: { migrated: false, modules: [], names: [
    'tbInstallerSearching', 'tbInstallerContacts', 'tbInstallerFeedback',
    'renderTbInstallerRow', 'openTbInstallerSearch', 'closeTbInstallerSearch',
    'renderTbInstallerResults', 'setTbInstaller'] },

  'tech-team': { migrated: false, modules: [], names: ['renderTbTechTeamRow', 'setTbTechTeam'] },

  'customer-documents': { migrated: false, modules: [], names: [
    'tbCustomerDocs', 'tbCustDocFeedback', 'renderTbCustomerDocuments',
    'addTbCustomerDocument', 'removeTbCustomerDocument'] },

  'sensor-counts': { migrated: true, modules: ['units.ts'], names: [
    'tbUnitCounts', 'loadTbUnitCounts', 'COUNT_KEY_TO_UNIT_TYPE',
    'COUNT_KEY_FOR_UNIT_TYPE', 'tbLockedCountRow', 'renderTbSensorCounts',
    'tbUnitShortfall', 'renderTbCountCorrection'] },

  'use-cases': { migrated: true, modules: ['useCases.ts'], names: [
    'renderTbUseCases', 'addTbUseCase', 'removeTbUseCase'] },

  'buyer-roles': { migrated: true, modules: ['descriptors.ts'], names: [
    'tbAccountContacts', 'CLIENT_BUYER_ROLES', 'CLIENT_BUYER_ROLE_LABELS',
    'renderTbBuyerRows', 'linkTbBuyer'] },

  'exit-criteria': { migrated: true, modules: ['exitCriteria.ts'], names: [
    'TB_EXIT_CRITERION_KEYS', 'renderTbStageExitCriteria', 'toggleExitCriterion',
    'tbCriterionQueue', 'applyConfirmedCriterionTick'] },

  scoring: { migrated: true, modules: ['scoring.ts', 'scoreReason.ts'], names: [
    'tbScoringCriteria', 'tbScoresExpanded', 'tbScoreReasons', 'tbScoreAnchorsOpen',
    'applyTbPendingMarks', 'tbScoreReasonRequired', 'tbScoreAwaitingReason',
    'applyTbScoreEntryLock', 'setTbScoreDraft', 'setTbMeasurability',
    'setTbScoreReason', 'tbScoreLevels', 'tbScoreKeys', 'showTbScoreAnchors',
    'toggleTbScoreAnchors', 'tbAnchorSet', 'toggleTbScoreHistory', 'tbScoreSeries',
    'recordTbScores', 'renderTbScoreSummary', 'ensureTbScoringCriteria',
    'tbScoreVisible', 'renderTbStageScoring', 'renderTbScores'] },

  units: { migrated: true, modules: ['unitQueue.ts', 'units.ts'], names: [
    'UNIT_TYPES', 'UNIT_TYPE_FOR_TAB_KEY', 'UNIT_STATES', 'tbUnits', 'tbUnitRow',
    'renderTbUnitPane', 'tbUnitWriteQueues', 'tbUnitWriteQueue', 'tbUnitSettleRow',
    'onTbUnitFieldChange', 'renderTbUnits'] },
}

test('the scan sees every declaration FORM, including window assignment', () => {
  const found = topLevelNames(SOURCE())
  const forms = new Set(found.map((f) => f.form))
  for (const f of ['function', 'window', 'let', 'const']) {
    assert.ok(forms.has(f), `no ${f} declaration was seen`)
  }
  assert.ok(found.length >= 130, `only ${found.length} top-level names parsed`)
})

test('and it sees an ARROW assigned to window, which the keyword form misses', () => {
  // CALIBRATED ON THE ONE THAT GOT THROUGH. Round 6's instrument anchored the
  // window branch on `function`, so `window.toggleExitCriterion = (a, b) => {}`
  // was invisible - and app.js carries thirteen more of the same shape.
  const found = topLevelNames(SOURCE())
  assert.ok(found.some((f) => f.name === 'toggleExitCriterion' && f.form === 'window'),
    'the arrow-form global is not seen, so the window branch is keyword-anchored again')
})

test('EVERY top-level name is claimed by an enumerated capability', () => {
  const claimed = new Map()
  for (const [cap, { names }] of Object.entries(CAPABILITIES)) {
    for (const n of names) {
      assert.ok(!claimed.has(n), `${n} is claimed by both ${claimed.get(n)} and ${cap}`)
      claimed.set(n, cap)
    }
  }
  const unclaimed = topLevelNames(SOURCE()).map((f) => f.name).filter((n) => !claimed.has(n))
  assert.deepEqual(unclaimed, [],
    'these top-level names belong to no enumerated capability, which means a '
    + 'capability nobody has written down: ' + unclaimed.join(', '))
})

test('and every enumerated name still exists, so the map cannot rot', () => {
  const present = new Set(topLevelNames(SOURCE()).map((f) => f.name))
  const missing = []
  for (const [cap, { names }] of Object.entries(CAPABILITIES)) {
    for (const n of names) if (!present.has(n)) missing.push(`${cap}: ${n}`)
  }
  assert.deepEqual(missing, [], 'enumerated names that no longer exist: ' + missing.join(', '))
})

test('every capability declares whether it is migrated', () => {
  for (const [cap, v] of Object.entries(CAPABILITIES)) {
    assert.equal(typeof v.migrated, 'boolean', `${cap} does not say whether it is migrated`)
  }
})

test('the reachability split is recorded, for the shell round', () => {
  const { reachable, lexical } = reachability(topLevelNames(SOURCE()))
  assert.ok(reachable.length > 0 && lexical.length > 0,
    'the split produced nothing, so it did not run')
})

test('the migrated flag AGREES with the modules on disk, so it cannot be prose', () => {
  const disagreements = []
  for (const [cap, v] of Object.entries(CAPABILITIES)) {
    assert.ok(Array.isArray(v.modules), `${cap} declares no module list`)
    const built = v.modules.length > 0
      && v.modules.every((m) => existsSync(new URL(`frontend-react/src/testbed/${m}`, ROOT)))
    if (built !== v.migrated) {
      disagreements.push(`${cap}: flag says ${v.migrated}, modules on disk say ${built}`)
    }
  }
  assert.deepEqual(disagreements, [], disagreements.join('; '))
})

test('and a migrated capability names at least one module', () => {
  // Otherwise the agreement above is satisfied by declaring nothing on both
  // sides, which is Verification 14: true by absence.
  const migrated = Object.entries(CAPABILITIES).filter(([, v]) => v.migrated)
  assert.ok(migrated.length > 0, 'no capability is migrated, so this asserts nothing')
  for (const [cap, v] of migrated) {
    assert.ok(v.modules.length > 0, `${cap} is migrated and names no module`)
  }
})
