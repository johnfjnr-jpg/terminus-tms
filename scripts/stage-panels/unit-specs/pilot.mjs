// ── UNIT CALIBRATION FOR THE STAGE PANELS PILOT ──────────────────────────
//
// One injection per ruled behaviour, each scored by WHICH NAMED TEST failed,
// never by exit code. Run with scripts/testbed-core/calibrate-unit.mjs, which
// snapshots by full path, refuses a repeated anchor, and compares bytes after
// every restore.
//
// What is NOT here: the column COUNT and the measured widths. jsdom has no
// layout, so those are the live spec's business; what jsdom can see is the
// class the grid rule is written against, and that is asserted.
const TABS = 'frontend-react/src/testbed/StageTabs.tsx'
const PANEL = 'frontend-react/src/testbed/StagePanel.tsx'
const HOST = 'frontend-react/src/testbed/TestBedHost.tsx'
const SCORING = 'frontend-react/src/testbed/scoring.ts'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

// R1: the two panels SWAPPED, which is the order regression the ruling names.
// Both still render; only their order changes, so the injection cannot be
// satisfied by the documents panel simply going missing.
const DOCS = `            {hasDocuments(panelData.documents)
              ? (
                <ReadPanel panelId="tb-stage-documents-section"
                  panel={panels['tb-stage-documents-section']}
                  empty="No documents required at this stage.">
                  {documents?.(stageOf(active) as string, panelData.documents)}
                </ReadPanel>)
              : null}`
const CRITERIA = `            <ExitCriteria stage={stageOf(active) as string}
              data={criteriaData}
              panel={panels['tb-stage-exit-criteria-list']}
              onTick={deps.onTick}
              approvers={approversOf(payload)}
              approvals={approvals?.(stageOf(active) as string, panelData.approvals)}
              approvalsPanel={panels['tb-stage-approval-row']}
              pending={new Set(Object.keys(scores.drafts).filter((k) => scores.drafts[k] !== ''))} />`
const DOCS_THEN_CRITERIA = `${DOCS}\n\n${CRITERIA}`
const CRITERIA_THEN_DOCS = `${CRITERIA}\n\n${DOCS}`

export default {
  name: 'stage-panels-pilot',
  testFiles: ['src/__tests__/stage-panels.test.tsx'],
  injections: [
    // R1 order. One edit, and both panels survive it: the find is the pair in
    // the ruled order and the replacement is the same pair reversed.
    I('R1 documents renders AFTER the exit criteria', TABS,
      DOCS_THEN_CRITERIA, CRITERIA_THEN_DOCS,
      ['the order is scoring, documents, exit criteria']),

    // R2. The grid is a stylesheet rule hanging off this class; without it the
    // panels stack full width and only a live width measurement would say so.
    I('R2 the row loses the class the grid rule is written against', TABS,
      '<div className="tb-stage-panels-row" data-testid="tb-stage-panels-row">',
      '<div className="" data-testid="tb-stage-panels-row">',
      ['a grid row holds the panels, and every one of them is inside it']),

    // R1 relocation. The criteria element closes before its body, so the
    // approvals section renders as a sibling: exactly the arrangement the
    // ruling replaced, and the one a later edit would drift back to.
    I('R1 the approvals render OUTSIDE the criteria panel', PANEL,
      '<div data-testid="tb-stage-exit-criteria-list" data-stage={panel.stage}>{body}</div>',
      '<><div data-testid="tb-stage-exit-criteria-list" data-stage={panel.stage} />{body}</>',
      ['the approvals are INSIDE the criteria panel, and are not a panel of the row']),

    // R1 approvers. The wrong payload key reads as an unnamed approver.
    I('R1 the Commercial approver is read from nowhere', TABS,
      "{ track: 'Commercial', name: String(payload?.commercialAuthority ?? '').trim() },",
      "{ track: 'Commercial', name: '' },",
      ['each track names its configured approver, or says none is named']),

    // R1 absence. An empty field rendering blank is the default a form gives.
    I('R1 an empty approver field renders blank instead of saying so', PANEL,
      "{a.track}: {a.name || 'no approver named'}", '{a.track}: {a.name}',
      ['each track names its configured approver, or says none is named']),

    // R1 intact. Measured live: the body was { track } alone and the route
    // answered 400 in 0.66ms, so the relocated control could grant nothing.
    I('R1 the approve click sends no decision', HOST,
      "{ track, decision: 'approved' }", '{ track }',
      ['the approve click sends a decision, which the route requires']),

    // R3. The panel on every stage is the state this ruling replaced.
    I('R3 the documents panel renders on every stage again', TABS,
      '  return !!d && ((d.reference_docs?.length ?? 0) > 0 || (d.completable_documents?.length ?? 0) > 0)',
      '  return true',
      ['Qualification has none, so the panel does not render at all']),

    // R4, both directions. Offering everything, and offering nothing.
    I('R4 every criterion is offered on every stage', SCORING,
      '  const gate = criteriaForStage(all, stage)\n  if (gate.length) return gate\n'
        + '  return all.filter((c) => Array.isArray(payload?.[c.criterion_key]) && (payload[c.criterion_key] as unknown[]).length > 0)',
      '  return [...all]',
      ['a stage the gate asks nothing of still offers the criteria already scored',
        'with nothing scored and no measurability, the card does not render']),
    I('R4 a stage the gate asks nothing of offers nothing', SCORING,
      '  return all.filter((c) => Array.isArray(payload?.[c.criterion_key]) && (payload[c.criterion_key] as unknown[]).length > 0)',
      '  return []',
      ['a stage the gate asks nothing of still offers the criteria already scored']),
  ],
}
