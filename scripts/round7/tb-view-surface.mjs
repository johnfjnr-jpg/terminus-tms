// ── THE SWAP'S POPULATION IS A VIEW, NOT A FILE ─────────────────────────
//
// Round 7 Phase 2c. The reach instrument's scope is test-bed-detail.js's 136
// names, and it reads 20/20. The Test Bed DETAIL VIEW is also built by app.js:
// the tab strip, the stage-panel loader, the documents and approvals panels,
// the closed panel, the next-stage action, the read-only banner. None of that
// is in the instrument's population, so the gate can say "every capability
// renders" about a view that does not.
//
// Verification 25's population clause, arriving at the instrument built to
// prevent this exact class of failure.
//
// THE DISPOSITION IS DECLARED, NOT INFERRED. A regex over function bodies was
// tried first and classified wrongly in both directions - `createTabStrip`
// mentions no Opportunity id though the Opportunity uses it, and
// `renderTestBedDetail` mentions "Opportunity" in a comment about converting.
// Verification 41: the enumeration itself is the instrument.
import { readFileSync } from 'node:fs'
import { topLevelNames } from '../lib/top-level-names.mjs'

const src = readFileSync('frontend/app.js', 'utf8')
const lines = src.split('\n')
const names = topLevelNames(src).sort((a, b) => a.line - b.line)
const sizeOf = new Map()
for (let i = 0; i < names.length; i++) {
  const end = i + 1 < names.length ? names[i + 1].line - 1 : lines.length
  sizeOf.set(names[i].name, (sizeOf.get(names[i].name) ?? 0) + (end - names[i].line + 1))
}

/** Every app.js name that builds the Test Bed DETAIL view, with its disposition. */
const VIEW = {
  // ── has a React counterpart the host reaches ──────────────────────────
  loadTbStageDetailTab: 'react: stageLoad.createStageLoader',
  switchTbTab: 'react: StageTabs activate',
  tbTabStrip: 'react: StageTabs strip',
  tbUserPickedTab: 'react: tabModel.landingTab userPicked',
  tbLastActiveTab: 'react: tabModel.shouldClearFeedback',
  markTbCurrentStageTab: 'react: StageTabs green dot',
  refreshTbNextStageButton: 'react: tabModel.nextStageState',
  markStagePanelsPending: 'react: stageLoad P3',
  markStagePanelSettled: 'react: stageLoad P3',
  markStagePanelFailed: 'react: stageLoad P3',
  stillCurrentTerminal: 'react: stageLoad token',
  tbStageTabLoadToken: 'react: stageLoad token',
  currentTbStageTab: 'react: StageTabs active',

  // ── shared with the Opportunity view, so it stays either way ──────────
  createTabStrip: 'shared with Opportunity',
  createSubTabs: 'shared with Opportunity',
  renderChevronStrip: 'shared with Opportunity',
  wireChevronHover: 'shared with Opportunity',
  hideChevronPopup: 'shared with Opportunity',
  chevronPopupId: 'shared with Opportunity',
  tbChevronHoverTimer: 'shared with Opportunity',
  tbChevronLoadToken: 'shared with Opportunity',
  buildStageApprovalRowHtml: 'shared with Opportunity',
  buildStageTrackListHtml: 'shared with Opportunity',
  renderStageApprovalsRows: 'shared with Opportunity',
  loadStageApprovals: 'shared with Opportunity',
  submitStageApproval: 'shared with Opportunity',

  // ── the LIST view, untouched by a detail swap ─────────────────────────
  renderTestBedsTable: 'list view', loadTestBeds: 'list view',
  renderTbMatrix: 'list view', renderTbMatrixCell: 'list view',
  renderTestBedMatrices: 'list view', tbStagesCache: 'list view',
  saveNewTestBed: 'list view', tbFilter: 'list view', setTbFilter: 'list view',
  applyTbFilter: 'list view', clearTbFilter: 'list view',
  tbSortKey: 'list view', tbSortDir: 'list view', tbSortValue: 'list view',

  // ── NO COUNTERPART. Each is a gap the swap would open ─────────────────
  renderTestBedDetail: 'react: ViewHeader + StageTabs render',
  // RENAMED IN THE SWAP COMMIT. A top-level function declaration in a classic
  // script is a property of `window`, and app.js loads AFTER the bundle - so
  // the old name silently overwrote the React registration. The live walk found
  // it; no unit test could.
  loadTestBedDetailSuperseded: 'react: TestBedHost load + viewLoad',
  renderTestBedDocuments: 'react: documents.documentRows + DocumentsPanel',
  confirmStageDocument: 'react: stageDocuments.confirmBody + DocumentsPanel',
  saveStageDocumentUrl: 'react: stageDocuments.saveUrlBody, approve:false',
  tbDocKey: 'react: documents.docKey',
  renderTbStageApprovals: 'react: shared/stageTracks + StageTrackList',
  applyConfirmedApproval: 'react: superseded by rendering from the reload',
  renderTbClosedPanel: 'react: closedPanel + ClosedRecordPanel',
  wireTbNextStageButton: 'react: tabModel.nextStageFor + StageTabs onNextStage',
  tbNextStageState: 'react: tabModel.nextStageFor',
  tbLandOnStageAfterLoad: 'react: viewLoad.createArrivalFlags landOn',
  tbArrivingFresh: 'react: viewLoad.createArrivalFlags consume',
  tbFreshNavigation: 'react: viewLoad.createArrivalFlags markNavigation',
  refreshTbStagePanels: 'react: StageTabs refreshToken',
  currentTestBed: 'react: TestBedHost record state',
  tbDetailStages: 'react: TestBedHost stages state',
  convertTestBed: 'react: convert.ts + ConvertPanel',
  wireTestBedConvertOnce: 'react: a component needs no once-only wiring guard',
  resetTestBedConvertForm: 'react: ConvertPanel cancel',
}

const present = new Set(names.map((n) => n.name))
const missing = Object.keys(VIEW).filter((n) => !present.has(n))
if (missing.length) {
  console.error(`REFUSED: these declared names are not in app.js: ${missing.join(', ')}`)
  process.exit(2)
}

const buckets = new Map()
for (const [name, disp] of Object.entries(VIEW)) {
  const kind = disp.startsWith('GAP') ? 'GAP'
    : disp.startsWith('react') ? 'react counterpart' : 'stays'
  if (!buckets.has(kind)) buckets.set(kind, [])
  buckets.get(kind).push({ name, disp, n: sizeOf.get(name) ?? 0 })
}
for (const kind of ['react counterpart', 'stays', 'GAP']) {
  const rows = (buckets.get(kind) ?? []).sort((a, b) => b.n - a.n)
  const sum = rows.reduce((t, r) => t + r.n, 0)
  console.log(`\n${kind.toUpperCase()}  (${rows.length} names, ${sum} lines)`)
  for (const r of rows) console.log(`    ${String(r.n).padStart(4)}  ${r.name.padEnd(26)} ${r.disp}`)
}
const gaps = buckets.get('GAP') ?? []
const gapLines = gaps.reduce((t, r) => t + r.n, 0)
console.log(`\nTHE SWAP ${gaps.length === 0 ? 'IS' : 'IS NOT'} TAKEABLE against the VIEW's population`
  + `: ${gapLines} lines across ${gaps.length} names have no React counterpart.`)
