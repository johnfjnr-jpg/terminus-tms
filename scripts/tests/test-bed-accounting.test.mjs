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
import { readFileSync } from 'node:fs'
import { topLevelNames, reachability } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url)
const SOURCE = () => readFileSync(new URL('frontend/test-bed-detail.js', ROOT), 'utf8')

// `migrated` is this round's own bookkeeping; the report carries the evidence.
const CAPABILITIES = {
  'view-lifecycle': { migrated: false, names: [
    'tbDetailId', 'tbBed', 'tbPayload', 'tbLoadedRevision', 'tbWired',
    'initTestBedDetailPanel', 'wireTbOnce', 'renderTbReference',
    'mountTbReferenceSubTabs', 'captureTbOpenEdits', 'restoreTbOpenEdits'] },

  'field-rows': { migrated: false, names: [
    'tbEdits', 'REGION_OPTIONS', 'INSTALLATION_ENVIRONMENT_OPTIONS',
    'SITE_OWNERSHIP_OPTIONS', 'TB_NAME_FIELD', 'TB_TERMINUS_FIELDS',
    'TB_CUSTOMER_FIELDS', 'TB_SUMMARY_FIELD', 'TB_SITE_FIELDS',
    'TB_SENSOR_COUNT_FIELDS', 'TB_DATE_FIELDS', 'TB_COST_FIELDS',
    'TB_INSTALL_FIELDS', 'TB_ALL_EDITABLE_FIELDS', 'tbFieldLabel', 'tbFieldRow',
    'tbReadonlyRow', 'tbEffectiveValue', 'wireTbFieldInputs', 'openTbField',
    'discardTbField', 'onTbFieldInput', 'updateTbSaveBar', 'clearTbSaveFeedback'] },

  'save-path': { migrated: false, names: [
    'tbPatch', 'tbStaleMessage', 'saveTbFields', 'saveTbDirtyEntries'] },

  'cost-preview': { migrated: false, names: [
    'TB_COST_INPUT_KEYS', 'tbCostPreview', 'tbCostPreviewTimer',
    'tbCostFieldsDirty', 'scheduleTbCostPreview', 'runTbCostPreview',
    'renderTbCostBreakdown'] },

  'date-bounds': { migrated: false, names: ['refreshTbDateBounds'] },

  validation: { migrated: false, names: [
    'tbInvalidFields', 'tbValidateNumeric', 'tbMarkFieldValidity',
    'renderTbValidationFeedback', 'guardNumericEntry'] },

  'notes-history': { migrated: false, names: [
    'tbNotesExpanded', 'toggleTbNotes', 'tbNoteStageChip', 'tbNewNote',
    'renderTbNotes', 'addTbNote'] },

  'revision-history': { migrated: false, names: ['renderTbHistory'] },

  'site-details': { migrated: false, names: ['TB_SITE_PANEL_KEYS', 'renderTbSiteDetails'] },

  commercials: { migrated: false, names: ['renderTbCommercials'] },

  'install-section': { migrated: false, names: [
    'renderTbInstallSection', 'renderTbInstallNotes', 'addTbInstallNote'] },

  installer: { migrated: false, names: [
    'tbInstallerSearching', 'tbInstallerContacts', 'tbInstallerFeedback',
    'renderTbInstallerRow', 'openTbInstallerSearch', 'closeTbInstallerSearch',
    'renderTbInstallerResults', 'setTbInstaller'] },

  'tech-team': { migrated: false, names: ['renderTbTechTeamRow', 'setTbTechTeam'] },

  'customer-documents': { migrated: false, names: [
    'tbCustomerDocs', 'tbCustDocFeedback', 'renderTbCustomerDocuments',
    'addTbCustomerDocument', 'removeTbCustomerDocument'] },

  'sensor-counts': { migrated: false, names: [
    'tbUnitCounts', 'loadTbUnitCounts', 'COUNT_KEY_TO_UNIT_TYPE',
    'COUNT_KEY_FOR_UNIT_TYPE', 'tbLockedCountRow', 'renderTbSensorCounts',
    'tbUnitShortfall', 'renderTbCountCorrection'] },

  'use-cases': { migrated: false, names: [
    'renderTbUseCases', 'addTbUseCase', 'removeTbUseCase'] },

  'buyer-roles': { migrated: false, names: [
    'tbAccountContacts', 'CLIENT_BUYER_ROLES', 'CLIENT_BUYER_ROLE_LABELS',
    'renderTbBuyerRows', 'linkTbBuyer'] },

  'exit-criteria': { migrated: false, names: [
    'TB_EXIT_CRITERION_KEYS', 'renderTbStageExitCriteria', 'toggleExitCriterion',
    'tbCriterionQueue', 'applyConfirmedCriterionTick'] },

  scoring: { migrated: false, names: [
    'tbScoringCriteria', 'tbScoresExpanded', 'tbScoreReasons', 'tbScoreAnchorsOpen',
    'applyTbPendingMarks', 'tbScoreReasonRequired', 'tbScoreAwaitingReason',
    'applyTbScoreEntryLock', 'setTbScoreDraft', 'setTbMeasurability',
    'setTbScoreReason', 'tbScoreLevels', 'tbScoreKeys', 'showTbScoreAnchors',
    'toggleTbScoreAnchors', 'tbAnchorSet', 'toggleTbScoreHistory', 'tbScoreSeries',
    'recordTbScores', 'renderTbScoreSummary', 'ensureTbScoringCriteria',
    'tbScoreVisible', 'renderTbStageScoring', 'renderTbScores'] },

  units: { migrated: false, names: [
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
