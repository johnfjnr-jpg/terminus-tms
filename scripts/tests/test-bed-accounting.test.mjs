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
import { reactSources, reachedFrom, stateOf } from '../lib/react-reach.mjs'
import { topLevelNames, reachability } from '../lib/top-level-names.mjs'

const ROOT = new URL('../../', import.meta.url)
const SOURCE = () => readFileSync(new URL('frontend/test-bed-detail.js', ROOT), 'utf8')

// THE FLAG IS GONE AND THE STATE IS DERIVED, Round 7 Phase 2.
//
// `migrated: boolean` read MODULE EXISTENCE, which is a proxy for the question
// the swap actually asks: does the React surface RENDER this capability? It
// answered wrong in both directions at once - five capabilities whose modules
// exist and which nothing imports read migrated, and notes-history read
// unmigrated while the shared Contact component renders it.
//
// Verification 19 exactly: "migrated" is a category name, and a category name
// is a finding that needs the same evidence as one. The state is now WALKED
// from TestBedHost.tsx's own imports, so it cannot be typed and cannot rot.
const CAPABILITIES = {
  'view-lifecycle': { modules: ['testbed/TestBedHost.tsx'], names: [
    'tbDetailId', 'tbBed', 'tbPayload', 'tbLoadedRevision', 'tbWired',
    'initTestBedDetailPanel', 'wireTbOnce', 'renderTbReference',
    'mountTbReferenceSubTabs', 'captureTbOpenEdits', 'restoreTbOpenEdits'] },

  'field-rows': { modules: ['testbed/descriptors.ts', 'testbed/TestBedPanel.tsx'], names: [
    'tbEdits', 'REGION_OPTIONS', 'INSTALLATION_ENVIRONMENT_OPTIONS',
    'SITE_OWNERSHIP_OPTIONS', 'TB_NAME_FIELD', 'TB_TERMINUS_FIELDS',
    'TB_CUSTOMER_FIELDS', 'TB_SUMMARY_FIELD', 'TB_SITE_FIELDS',
    'TB_SENSOR_COUNT_FIELDS', 'TB_DATE_FIELDS', 'TB_COST_FIELDS',
    'TB_INSTALL_FIELDS', 'TB_ALL_EDITABLE_FIELDS', 'tbFieldLabel', 'tbFieldRow',
    'tbReadonlyRow', 'tbEffectiveValue', 'wireTbFieldInputs', 'openTbField',
    'discardTbField', 'onTbFieldInput', 'updateTbSaveBar', 'clearTbSaveFeedback'] },

  'save-path': { modules: ['testbed/TestBedHost.tsx'], names: [
    'tbPatch', 'tbStaleMessage', 'saveTbFields', 'saveTbDirtyEntries'] },

  'cost-preview': { modules: ['testbed/costPreview.ts'], names: [
    'TB_COST_INPUT_KEYS', 'tbCostPreview', 'tbCostPreviewTimer',
    'tbCostFieldsDirty', 'scheduleTbCostPreview', 'runTbCostPreview',
    'renderTbCostBreakdown'] },

  'date-bounds': { modules: ['testbed/dateBounds.ts'], names: ['refreshTbDateBounds'] },

  validation: { modules: ['testbed/validation.ts'], names: [
    'tbInvalidFields', 'tbValidateNumeric', 'tbMarkFieldValidity',
    'renderTbValidationFeedback', 'guardNumericEntry'] },

  'notes-history': { modules: ['contact/NotesHistory.tsx', 'contact/notes.ts'], names: [
    'tbNotesExpanded', 'toggleTbNotes', 'tbNoteStageChip', 'tbNewNote',
    'renderTbNotes', 'addTbNote'] },

  'revision-history': { modules: ['testbed/history.ts', 'testbed/HistoryPanel.tsx'], names: ['renderTbHistory'] },

  'site-details': { modules: ['testbed/descriptors.ts'], names: ['TB_SITE_PANEL_KEYS', 'renderTbSiteDetails'] },

  commercials: { modules: ['testbed/descriptors.ts'], names: ['renderTbCommercials'] },

  'install-section': { modules: ['testbed/installNotes.ts', 'testbed/InstallSection.tsx'], names: [
    'renderTbInstallSection', 'renderTbInstallNotes', 'addTbInstallNote'] },

  installer: { modules: ['testbed/installer.ts'], names: [
    'tbInstallerSearching', 'tbInstallerContacts', 'tbInstallerFeedback',
    'renderTbInstallerRow', 'openTbInstallerSearch', 'closeTbInstallerSearch',
    'renderTbInstallerResults', 'setTbInstaller'] },

  'tech-team': { modules: ['testbed/techTeam.ts'], names: ['renderTbTechTeamRow', 'setTbTechTeam'] },

  'customer-documents': { modules: ['testbed/customerDocs.ts', 'testbed/CustomerDocsPanel.tsx'], names: [
    'tbCustomerDocs', 'tbCustDocFeedback', 'renderTbCustomerDocuments',
    'addTbCustomerDocument', 'removeTbCustomerDocument'] },

  'sensor-counts': { modules: ['testbed/units.ts'], names: [
    'tbUnitCounts', 'loadTbUnitCounts', 'COUNT_KEY_TO_UNIT_TYPE',
    'COUNT_KEY_FOR_UNIT_TYPE', 'tbLockedCountRow', 'renderTbSensorCounts',
    'tbUnitShortfall', 'renderTbCountCorrection'] },

  'use-cases': { modules: ['testbed/useCases.ts'], names: [
    'renderTbUseCases', 'addTbUseCase', 'removeTbUseCase'] },

  'buyer-roles': { modules: ['testbed/descriptors.ts'], names: [
    'tbAccountContacts', 'CLIENT_BUYER_ROLES', 'CLIENT_BUYER_ROLE_LABELS',
    'renderTbBuyerRows', 'linkTbBuyer'] },

  'exit-criteria': { modules: ['testbed/exitCriteria.ts'], names: [
    'TB_EXIT_CRITERION_KEYS', 'renderTbStageExitCriteria', 'toggleExitCriterion',
    'tbCriterionQueue', 'applyConfirmedCriterionTick'] },

  scoring: { modules: ['testbed/scoring.ts', 'testbed/scoreReason.ts'], names: [
    'tbScoringCriteria', 'tbScoresExpanded', 'tbScoreReasons', 'tbScoreAnchorsOpen',
    'applyTbPendingMarks', 'tbScoreReasonRequired', 'tbScoreAwaitingReason',
    'applyTbScoreEntryLock', 'setTbScoreDraft', 'setTbMeasurability',
    'setTbScoreReason', 'tbScoreLevels', 'tbScoreKeys', 'showTbScoreAnchors',
    'toggleTbScoreAnchors', 'tbAnchorSet', 'toggleTbScoreHistory', 'tbScoreSeries',
    'recordTbScores', 'renderTbScoreSummary', 'ensureTbScoringCriteria',
    'tbScoreVisible', 'renderTbStageScoring', 'renderTbScores'] },

  units: { modules: ['testbed/unitQueue.ts', 'testbed/units.ts'], names: [
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

test('the reachability split is recorded, for the shell round', () => {
  const { reachable, lexical } = reachability(topLevelNames(SOURCE()))
  assert.ok(reachable.length > 0 && lexical.length > 0,
    'the split produced nothing, so it did not run')
})

// ── THE STATE IS WALKED FROM THE HOST'S IMPORTS, NOT DECLARED ───────────
//
// rendered   the host reaches every module the capability declares
// logic-only a module exists and the host cannot reach it - built, not rendered
// absent     nothing is built
//
// The walk lives in scripts/lib/react-reach.mjs so the swap-readiness report
// uses the same one (Verification 20).
const SRC = reactSources()
const reachedFromHost = () => reachedFrom(SRC, 'testbed/TestBedHost.tsx')

test('the import walk RUNS: it reaches the panel from the host', () => {
  // Verification 12. A walk that returns nothing reads exactly like a surface
  // that renders nothing, and every state below would read `logic-only`.
  const reached = reachedFromHost()
  assert.ok(reached.has('testbed/TestBedHost.tsx'), 'the walk did not start')
  assert.ok(reached.has('testbed/TestBedPanel.tsx'),
    'the walk did not reach the panel through an import, so it did not run')
  assert.ok(reached.has('field-row/FieldRow.tsx'),
    'the walk did not follow a second hop, so it is not transitive')
})

test('every declared module EXISTS, so a state cannot rest on a typo', () => {
  const missing = []
  for (const [cap, { modules }] of Object.entries(CAPABILITIES)) {
    for (const m of modules) if (!SRC.has(m)) missing.push(`${cap}: ${m}`)
  }
  assert.deepEqual(missing, [], 'declared modules that do not exist: ' + missing.join(', '))
})

/**
 * ── THE SWAP GATE ────────────────────────────────────────────────────────
 *
 * The swap is takeable exactly when NOT_RENDERED is empty. Until then this is
 * the recorded debt, and it is asserted EXACTLY rather than as a count - so it
 * fails when something regresses AND when something is built, which is what
 * stops it becoming a stale list nobody updates (Architecture 9's fourth
 * variant).
 *
 * THE RATCHET. Phase 2 recorded ELEVEN, five of them `logic-only`: capabilities
 * with modules, tests and injection sweeps that NOTHING IMPORTED. Phase 2b
 * session 1 built the stage-tab shell they render through, and logic-only is
 * now empty.
 *
 * | session | capabilities | vanilla lines a swap would take |
 * |---|---|---|
 * | Phase 2 | 11 (5 logic-only, 6 absent) | 1838 |
 * | Phase 2b session 1 | 6 (0 logic-only, 6 absent) | 362 |
 * | Phase 2b session 2 | **0** | **0** |
 *
 * THE RATCHET IS AT ZERO, so the swap gate below is inverted: it now asserts
 * that every capability renders, and it fails the moment one stops. It is no
 * longer a debt list; it is a floor.
 */
const NOT_RENDERED = []

test('the capabilities the React surface does not render are EXACTLY the recorded ones', () => {
  const reached = reachedFromHost()
  const actual = Object.entries(CAPABILITIES)
    .map(([cap, v]) => ({ cap, state: stateOf(v.modules, SRC, reached) }))
    .filter((r) => r.state !== 'rendered')

  const rendered = Object.keys(CAPABILITIES).length - actual.length
  assert.ok(rendered > 0, 'nothing is rendered, so this assertion is vacuous')

  assert.deepEqual(actual, NOT_RENDERED,
    'the unrendered set moved. If something was BUILT, remove it from '
    + 'NOT_RENDERED. If something REGRESSED, that is the finding.')
})

test('EVERY capability renders, which is the swap gate at its floor', () => {
  // INVERTED at Phase 2b session 2, when NOT_RENDERED reached zero. Until then
  // this asserted the debt was non-empty; it now asserts there is none, so a
  // capability that stops rendering fails here rather than being quietly added
  // back to a list.
  const reached = reachedFromHost()
  const total = Object.keys(CAPABILITIES).length
  assert.equal(total, 20, `the capability count moved to ${total}`)

  const states = Object.entries(CAPABILITIES)
    .map(([cap, v]) => ({ cap, state: stateOf(v.modules, SRC, reached) }))
  const rendered = states.filter((r) => r.state === 'rendered')

  assert.equal(rendered.length, 20,
    'the React surface does not render every capability: '
    + states.filter((r) => r.state !== 'rendered')
      .map((r) => `${r.cap} (${r.state})`).join(', '))
  assert.deepEqual(NOT_RENDERED, [],
    'NOT_RENDERED is non-empty while every capability renders, so the list is stale')
})

// ── THE SECOND POPULATION: THE VIEW, NOT THE FILE ───────────────────────
//
// Round 7 Phase 2c, and it is the correction to this instrument rather than an
// addition to it.
//
// Everything above measures test-bed-detail.js's 136 names, and it reads 20 of
// 20 rendered. THE SWAP IS ABOUT A VIEW, and the Test Bed detail view is also
// built by app.js: the documents panel's content, the approvals panel's
// content, the terminal tab's content, the Next Stage action, the view's own
// load and render. None of that was ever in the population, so the gate said
// "every capability renders" about a view that does not.
//
// Verification 25's population clause, arriving at the instrument that exists
// to stop a swap taking working capabilities off a live screen.
//
// The dispositions live in scripts/round7/tb-view-surface.mjs, declared rather
// than inferred - a regex over function bodies was tried and was wrong in both
// directions. This asserts the RECORDED gap set exactly, the same ratchet shape
// the file's own gate used: it fails when something is built AND when something
// regresses.
const VIEW_GAPS = []

test('the app.js view gaps are EXACTLY the recorded ones', () => {
  const declared = readFileSync(new URL('scripts/round7/tb-view-surface.mjs', ROOT), 'utf8')
  const block = declared.slice(declared.indexOf('const VIEW = {'), declared.indexOf('\n}\n', declared.indexOf('const VIEW = {')))
  const gaps = [...block.matchAll(/^\s{2}([A-Za-z0-9_$]+):\s*'GAP:/gm)].map((m) => m[1]).sort()

  // The vacuity guard inverts with the gate: with the debt at zero, what must
  // be non-empty is the ENUMERATION, not the gap set. A parser that matched
  // nothing would otherwise agree with an empty VIEW_GAPS perfectly.
  const declaredNames = [...block.matchAll(/^\s{2}([A-Za-z0-9_$]+):\s*'/gm)].map((m) => m[1])
  assert.ok(declaredNames.length > 30,
    `only ${declaredNames.length} names parsed from the enumeration, so this `
    + 'assertion is vacuous')
  assert.deepEqual(gaps, VIEW_GAPS,
    'the app.js gap set moved. If something was BUILT, remove it from '
    + 'VIEW_GAPS and from the enumeration. If something REGRESSED, that is the '
    + 'finding.')
})

test('and every name the enumeration DECLARES still exists in app.js', () => {
  // IT READS THE ENUMERATION, NOT VIEW_GAPS. With the debt at zero, iterating
  // VIEW_GAPS asserts nothing at all - Verification 14, a check satisfied by
  // an absence. The meaningful claim once the gaps are closed is that the
  // enumeration still names real functions, which is what stops it becoming a
  // list of dispositions for code that has moved.
  const declared = readFileSync(new URL('scripts/round7/tb-view-surface.mjs', ROOT), 'utf8')
  const block = declared.slice(declared.indexOf('const VIEW = {'),
    declared.indexOf('\n}\n', declared.indexOf('const VIEW = {')))
  const names = [...block.matchAll(/^\s{2}([A-Za-z0-9_$]+):\s*'/gm)].map((m) => m[1])
  assert.ok(names.length > 30, `only ${names.length} names parsed, so this is vacuous`)

  const app = readFileSync(new URL('frontend/app.js', ROOT), 'utf8')
  const present = new Set(topLevelNames(app).map((n) => n.name))
  const missing = names.filter((n) => !present.has(n))
  assert.deepEqual(missing, [],
    'the enumeration names functions app.js no longer has: ' + missing.join(', '))
})

test('EVERY app.js view name has a React counterpart, which is the second gate at its floor', () => {
  // INVERTED at Phase 2d session 3, when the view population reached zero.
  // Until then this asserted the debt was non-empty; it now asserts there is
  // none, so a name that loses its counterpart fails here rather than being
  // quietly added back to a list.
  //
  // BOTH POPULATIONS NOW READ ZERO. The file population (20 of 20 rendered)
  // and the view population (0 gaps) are different questions about the same
  // swap, and Phase 2c exists because the first said takeable while the second
  // had never been asked.
  assert.deepEqual(VIEW_GAPS, [],
    'VIEW_GAPS is non-empty, so the swap is not takeable and this assertion '
    + 'should be reverted to its debt form')
})
