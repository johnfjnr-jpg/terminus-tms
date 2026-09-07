// Calibration for Round 7 Phase 2b session 1: the stage-tab shell.
//
// The suite was GREEN ON ITS FIRST RUN, which is Verification 47's tell for
// tests written to agree with the component. These are what make it evidence.
//
// Verified-snapshot harness (Verification 44): full-path keys, snapshot
// round-tripped before anything is injected, restore compared byte-for-byte
// after EVERY injection with a stop on mismatch, unique anchors, final
// reverted run. Matchers anchor on TEST NAMES (Verification 51's caveat).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2b.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))
const snapshot = (f) => {
  const b = fs.readFileSync(path.join(ROOT, f))
  if (!b.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), b)
  if (!fs.readFileSync(key(f)).equals(b)) { console.error(`REFUSED: ${f} snapshot`); process.exit(2) }
  return b
}
const restore = (f, o) => {
  fs.writeFileSync(path.join(ROOT, f), o)
  if (!fs.readFileSync(path.join(ROOT, f)).equals(o)) { console.error(`STOP: restore of ${f}`); process.exit(2) }
}

const M = 'frontend-react/src/testbed/tabModel.ts'
const L = 'frontend-react/src/testbed/stageLoad.ts'
const T = 'frontend-react/src/testbed/StageTabs.tsx'
const P = 'frontend-react/src/testbed/StagePanel.tsx'
const U = 'frontend-react/src/testbed/UnitsPane.tsx'
const C = 'frontend-react/src/testbed/UseCasesList.tsx'

const INJECTIONS = [
  // ── T: the tab model ─────────────────────────────────────────────────
  { name: 'T1: the stage key is SPLIT on the hyphen, so Pre-Site breaks', file: M,
    find: "export const stageOf = (key: string) =>\n  isStageTab(key) ? key.slice(STAGE_PREFIX.length) : null",
    replace: "export const stageOf = (key: string) =>\n  isStageTab(key) ? key.split('-')[1] : null",
    expect: 'a stage name carrying a hyphen survives the key round trip' },

  { name: 'T2: the stage tabs stop sharing one pane', file: M,
    find: "export const paneFor = (key: string) =>\n  isStageTab(key) ? 'tb-tab-stage-detail' : `tb-tab-${key}`",
    replace: 'export const paneFor = (key: string) => `tb-tab-${key}`',
    expect: 'the eight stage tabs share ONE pane' },

  { name: 'T4: the load default overrides the user\'s click again', file: M,
    find: '  if (fresh && !userPicked) return \'reference\'',
    replace: '  if (fresh) return \'reference\'',
    expect: 'unless the user has already clicked' },

  { name: 'T5: a landed transition stops outranking the open tab', file: M,
    find: '  if (landing) return tabKey(landing)\n',
    replace: '',
    expect: 'a landed transition outranks everything' },

  { name: 'T6: the feedback clears on a RE-APPLY, erasing a save failure', file: M,
    find: 'export const shouldClearFeedback = (last: string | null, next: string) =>\n  last !== null && last !== next',
    replace: 'export const shouldClearFeedback = (last: string | null, next: string) =>\n  last !== next || last === next',
    expect: 'the feedback clears on a tab CHANGE and survives a re-apply' },

  { name: 'T7: Next Stage stops being gated on the open tab', file: M,
    find: '    disabled: activeTab !== tabKey(state.currentStage),',
    replace: '    disabled: false,',
    expect: 'Next Stage is enabled only on the CURRENT stage tab' },

  { name: 'T7: the final stage keeps the Next Stage label', file: M,
    find: "  if (!state.nextStage) return { disabled: true, label: 'Final stage' }",
    replace: "  if (!state.nextStage) return { disabled: true, label: 'Next Stage' }",
    expect: 'with no next stage the LABEL changes' },

  // ── P: the load ──────────────────────────────────────────────────────
  { name: 'P1: THE TOKEN GUARD GOES, so an older load overwrites a newer stage', file: L,
    find: '      if (!current()) return\n      if (!r.ok) { deps.onPanel(id, {}); return }',
    replace: '      if (!r.ok) { deps.onPanel(id, {}); return }',
    expect: 'THE OLDER LOAD MAY NOT WRITE' },

  { name: 'P2: the three fetches are awaited before any panel renders', file: L,
    find: '    const running = [\n      settle(',
    replace: '    const running = [\n      await settle(',
    expect: 'each panel renders on ITS OWN response' },

  { name: 'P3: pending is stamped AFTER the first await, not before', file: L,
    find: '    for (const id of PANEL_IDS) deps.onPanel(id, { pending: stage })',
    replace: '    await Promise.resolve()\n    for (const id of PANEL_IDS) deps.onPanel(id, { pending: stage })',
    expect: 'pending is stamped SYNCHRONOUSLY' },

  { name: 'P3: a FAILED panel claims the stage anyway', file: L,
    find: '      if (!r.ok) { deps.onPanel(id, {}); return }',
    replace: '      if (!r.ok) { deps.onPanel(id, { stage }); return }',
    expect: 'a FAILURE clears both' },

  { name: 'P4: terminal is decided by MATCHING THE STRING Closed', file: L,
    find: "    const terminal = ordered.length > 0\n      && ordered[ordered.length - 1].stage_name === stage",
    replace: "    const terminal = stage === 'Closed'",
    expect: 'terminal is decided by the DATA' },

  { name: 'P5: the terminal branch stops stamping the scoring card', file: L,
    find: "      deps.onScoringCard?.({ hidden: true, stage })\n      return { terminal: true",
    replace: "      return { terminal: true",
    expect: 'the terminal branch STILL stamps' },

  { name: 'P7: units are derived for every stage', file: L,
    find: '    if (isInstall) deps.onDeriveUnits?.()',
    replace: '    deps.onDeriveUnits?.()',
    expect: 'units are derived only for the stage that owns them' },

  { name: 'P8: the scoring card is revealed before its criteria are derived', file: L,
    find: '    deps.onScoringCard?.({ hidden: true, stage: undefined })',
    replace: '    deps.onScoringCard?.({ hidden: false, stage })',
    expect: 'the scoring card is HIDDEN until its own criteria are derived' },

  { name: 'P9: a STALE throw wipes the newer load\'s settled panel', file: L,
    find: '      if (!current()) return { terminal: false, panelsVisible: true, panels }\n      for (const id of PANEL_IDS) {',
    replace: '      for (const id of PANEL_IDS) {',
    expect: 'a STALE throw may not clear a newer load' },

  // ── B and C: the rendered panel ──────────────────────────────────────
  { name: 'B1: the rendered tick writes a BOOLEAN', file: P,
    find: '                onClick={() => onTick(exitTickPayload(c.field, met, new Date().toISOString()))} />',
    replace: '                onClick={() => onTick({ [c.field]: !met } as never)} />',
    expect: 'a tick writes a TIMESTAMP, never a boolean' },

  { name: 'C5: the record button stops being blocked', file: P,
    find: '        disabled={!!blocking}',
    replace: '        disabled={false}',
    expect: 'the record button is BLOCKED until a required reason is given' },

  { name: 'P8: the card renders without the hidden attribute', file: P,
    find: '      hidden={card.hidden} data-stage={card.stage}>',
    replace: '      data-stage={card.stage}>',
    expect: 'the card is HIDDEN WHILE THE LOAD IS IN FLIGHT' },

  // ── the shell ────────────────────────────────────────────────────────
  { name: 'T3: the dot marks the OPEN tab instead of the record\'s stage', file: T,
    find: '            {isStageTab(t.key) && stageOf(t.key) === currentStage',
    replace: '            {isStageTab(t.key) && t.key === active',
    expect: "the green dot marks the RECORD's stage" },

  { name: 'P6: the install section renders on every stage', file: T,
    find: '            <div data-testid="tb-stage-install-section" hidden={!installVisible}>',
    replace: '            <div data-testid="tb-stage-install-section">',
    expect: 'the install section is hidden by ATTRIBUTE off its own stage' },

  { name: 're-navigation: the landing effect is keyed on MOUNT', file: T,
    find: '  }, [landing, fresh, activate])',
    replace: '  }, [])',
    expect: 'a second visit to a DIFFERENT record re-derives the landing tab' },

  // ── S and U ──────────────────────────────────────────────────────────
  { name: 'S2: the correction is offered whether or not anything is missing', file: U,
    find: '        {shortfall.missing > 0\n          ? (',
    replace: '        {true\n          ? (',
    expect: 'offers no correction when the units are all there' },

  { name: 'S7: the pane stops filtering by type', file: U,
    find: '  const shown = unitsForTab(tab, units)',
    replace: '  const shown = [...units]',
    expect: 'the pane shows ONE type, and the tab chooses which' },

  { name: 'U: a blank use case is written after all', file: C,
    find: '    if (!next || busy) return',
    replace: '    if (busy) return\n    if (!next) { await onWrite([]); return }',
    expect: 'a blank addition writes NOTHING' },

  { name: 'U2: removing writes the removed item rather than the list', file: C,
    find: "                onClick={() => { void run(removeUseCase(useCases, i)) }}>Remove</button>",
    replace: "                onClick={() => { void run([uc]) }}>Remove</button>",
    expect: 'removing also writes the whole list' },
]

const SUITES = [
  'src/__tests__/testbed-stage-tabs.test.ts',
  'src/__tests__/testbed-stage-surface.test.tsx',
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', ...SUITES],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe' })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/Tests\s+(\d+) failed/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const i of INJECTIONS) if (!originals.has(i.file)) originals.set(i.file, snapshot(i.file))

let detected = 0
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times in ${inj.file}`); restore(inj.file, original); process.exit(2) }
  fs.writeFileSync(path.join(ROOT, inj.file), text.replace(inj.find, inj.replace))
  const t0 = Date.now()
  const r = run()
  const ms = Date.now() - t0
  const fired = r.failed > 0 && r.out.includes(inj.expect)
  if (fired) detected++
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}  (${r.failed} failed, ${ms}ms)`)
  restore(inj.file, original)
}

const final = run()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed} failed)`}`)
for (const [f, b] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(b)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
