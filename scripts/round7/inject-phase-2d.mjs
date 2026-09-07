// Calibration for Round 7 Phase 2d session 1: the stage panel's content.
//
// Verified-snapshot harness (Verification 44). Matchers anchor on TEST NAMES;
// a SILENT verdict is classified by its failure count (Verification 51).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2d.mjs <scratch-dir>'); process.exit(2) }
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

const M = 'frontend-react/src/testbed/documents.ts'
const A = 'frontend-react/src/shared/stageTracks.ts'
const Z = 'frontend-react/src/testbed/closedPanel.ts'
const X = 'frontend-react/src/testbed/tabModel.ts'
const MP = 'frontend-react/src/testbed/DocumentsPanel.tsx'
const AP = 'frontend-react/src/shared/StageTrackList.tsx'
const ZP = 'frontend-react/src/testbed/ClosedRecordPanel.tsx'

const INJECTIONS = [
  // ── M ────────────────────────────────────────────────────────────────
  { name: 'M2: THE TWO KEYS ARE INTERSECTED, so a mismatch vanishes', file: M,
    find: '  for (const d of gated) if (!names.includes(d.document)) names.push(d.document)',
    replace: '  // intersected',
    expect: 'the two keys are UNIONED, so a mismatch is visible rather than lost' },

  { name: 'M2: the gated list decides the order instead of the catalogue', file: M,
    find: '  const names = refDocs.map((d) => d.document_name)',
    replace: '  const names = gated.map((d) => d.document)',
    expect: 'the two keys are UNIONED, so a mismatch is visible rather than lost' },

  { name: 'M3: any status reads as Approved', file: M,
    find: "    const approved = req?.current_status === 'approved'",
    replace: '    const approved = !!req?.current_status',
    expect: 'three statuses, from current_status' },

  { name: 'M4/M5: not-gated and approved collapse into one blank', file: M,
    find: "      confirm: !req ? 'not-gated' : approved ? 'none' : 'offer',",
    replace: "      confirm: (!req || approved) ? 'none' : 'offer',",
    expect: 'a document with NO GATE RULE is catalogue-only and gets no Confirm' },

  { name: 'M6: the slug keeps the characters that break an id', file: M,
    find: "  name.replace(/\\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '')",
    replace: "  name.replace(/\\s+/g, '-')",
    expect: 'the row key is a slug' },

  { name: 'M7: a missing URL becomes the string undefined', file: M,
    find: "      url: req?.document_location ?? '',",
    replace: '      url: String(req?.document_location),',
    expect: 'the URL comes from document_location' },

  { name: 'M: the route stops encoding the stage', file: M,
    find: '  `/api/test-beds/${id}/document-requirements?stage=${encodeURIComponent(stage)}`',
    replace: '  `/api/test-beds/${id}/document-requirements?stage=${stage}`',
    expect: 'the route carries the stage, encoded' },

  // ── A ────────────────────────────────────────────────────────────────
  { name: 'A4: recordType gains a DEFAULT, hiding a missed call site', file: A,
    find: '  if (recordType === undefined) {',
    replace: '  if (false) {',
    expect: 'recordType is REQUIRED and throws' },

  { name: 'A2/A3: unknown and none-required collapse', file: A,
    find: "  if (!st) return { kind: 'unknown', text: UNKNOWN_STAGE }",
    replace: "  if (!st) return { kind: 'empty', text: TRACK_EMPTY }",
    expect: 'an unknown stage says so' },

  { name: 'A5: a version-scoped track becomes clickable', file: A,
    find: "  const clickable = !superseded && st.state === 'current' && !t.approved && !versionScoped",
    replace: "  const clickable = !superseded && st.state === 'current' && !t.approved",
    expect: 'clickable needs all four' },

  { name: 'A5: the superseded check goes, so a workflow record offers the old control', file: A,
    find: '  const clickable = !superseded &&',
    replace: '  const clickable = true &&',
    expect: 'clickable needs all four' },

  { name: 'A6: an approved version-scoped row stops naming the version', file: A,
    find: '      ? `${t.version_label ?? \'Version\'} · approved ${formatDate(t.decided_at)} · at ${st.stage_name}`',
    replace: "      ? `Approved ${formatDate(t.decided_at)}`",
    expect: 'a version-scoped APPROVED track names the version and the stage' },

  { name: 'A7: scope is INFERRED from the stage name', file: A,
    find: "  const versionScoped = t.scope === 'version'",
    replace: "  const versionScoped = t.scope === 'version' || st.stage_name === 'Proposal'",
    expect: 'scope is READ, never inferred from the stage name' },

  { name: 'A8: the workflow and not-yet cases collapse', file: A,
    find: "      : superseded ? 'Decided on the transition request'",
    replace: '      : superseded ? \'Not yet at this stage\'',
    expect: 'the four ordinary shapes each say something different' },

  // ── Z ────────────────────────────────────────────────────────────────
  { name: 'Z3: an empty stage group is rendered', file: Z,
    find: '    .filter((g) => (g.documents ?? []).length > 0)',
    replace: '    .filter(() => true)',
    expect: 'a stage that produced NOTHING is omitted, not shown empty' },

  { name: 'Z3: the groups are re-sorted alphabetically', file: Z,
    find: '  return (data.groups ?? [])\n    .filter',
    replace: '  return [...(data.groups ?? [])].sort((a, b) => a.stage.localeCompare(b.stage))\n    .filter',
    expect: "the ROUTE's group order is preserved, which is lifecycle order" },

  { name: 'Z4: the shortfall is implied rather than stated', file: Z,
    find: '      + `${data.total - data.produced} were never recorded.`',
    replace: "      + ''",
    expect: 'it DEGRADES HONESTLY' },

  { name: 'Z5: an unproduced document renders a blank URL line like a produced one', file: Z,
    find: "          : (d.produced ? 'No document URL recorded' : ''),",
    replace: "          : 'No document URL recorded',",
    expect: 'a document never produced SAYS so' },

  { name: 'Z5: a missing status reads as started rather than not produced', file: Z,
    find: "          : 'Not produced',",
    replace: "          : 'Started',",
    expect: 'a document never produced SAYS so' },

  // ── X ────────────────────────────────────────────────────────────────
  { name: 'X1: the array order decides the next stage instead of sort_order', file: X,
    find: '  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order)',
    replace: '  const ordered = [...stages]',
    expect: 'the list is SORTED first' },

  { name: 'X1: an unknown status yields the FIRST stage', file: X,
    find: '    nextStage: i < 0 ? null : (ordered[i + 1]?.stage_name ?? null),',
    replace: '    nextStage: ordered[i + 1]?.stage_name ?? null,',
    expect: 'an unknown status yields no next stage rather than the first' },

  // ── the rendered halves ──────────────────────────────────────────────
  { name: 'M7: the URL saves on every blur, changed or not', file: MP,
    find: '              onBlur={(e) => { if (e.target.value !== r.url) onSaveUrl(r.name, e.target.value) }} />',
    replace: '              onBlur={(e) => onSaveUrl(r.name, e.target.value)} />',
    expect: 'the URL box is prefilled, and saves only when it CHANGES' },

  { name: 'M4: the not-gated label goes, so the row reads like a bug', file: MP,
    find: "            {r.confirm === 'not-gated'",
    replace: '            {false',
    expect: 'the catalogue-only row says Not gated and offers no Confirm' },

  { name: 'A5: the row is clickable regardless of what the model said', file: AP,
    find: '          onClick={r.clickable ? () => onApprove(r.track) : undefined}>',
    replace: '          onClick={() => onApprove(r.track)}>',
    expect: 'only the clickable row responds' },

  { name: 'Z2: the closed record grows an editable URL box', file: ZP,
    find: '                    <span className="tb-closed-doc-url">{d.urlText}</span>',
    replace: '                    <input className="tb-closed-doc-url" defaultValue={d.urlText} />',
    expect: 'NO row carries a confirm control or an editable input' },

  { name: 'Z6: a failed load still states a count', file: ZP,
    find: '  if (failed || !data) {',
    replace: '  if (false) {',
    expect: 'a failed load says so and shows no groups' },

  { name: 'Z6: loading and a failed load collapse', file: ZP,
    find: '  if (loading) {',
    replace: '  if (false) {',
    expect: 'loading is a state of its own, not an empty record' },
]

const SUITES = [
  'src/__tests__/testbed-panel-content.test.ts',
  'src/__tests__/testbed-panel-surface.test.tsx',
  'src/__tests__/testbed-stage-tabs.test.ts',
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
const silent = []
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
  else silent.push({ name: inj.name, failed: r.failed })
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
if (silent.length) {
  console.log('\nSILENT, classified per the Verification 51 caveat:')
  for (const s of silent) {
    console.log(`  ${s.failed === 0 ? 'ZERO failures  -> a MISSING ASSERTION' : `${s.failed} failed -> the MATCHER missed`}  ${s.name}`)
  }
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
