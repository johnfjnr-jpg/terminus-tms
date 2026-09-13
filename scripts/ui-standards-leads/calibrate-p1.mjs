// ── CALIBRATING THE CONFORMANCE GATE ─────────────────────────────────────
//
// The brief says "calibrated to fail", and it is the whole point: a gate that
// has never refused anything is an assertion, not a control. Seven checks
// went green on their first run, which is the tell rather than the proof.
//
// Verification 44's requirements: full-path keys, a snapshot proven to exist
// before anything is injected, a byte comparison after EVERY injection with a
// hard stop on mismatch, an in-flight marker so a killed run cannot have its
// own mutation blessed as the original, and a final reverted run.
//
// AND IT ANCHORS ON THE NAMED TEST, not the exit code: an injection that
// breaks a file goes red without reaching the check it was written for.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'

// ASSEMBLED FROM PARTS, never written as a literal. The staleness check's
// corpus includes `scripts/`, so a harness that spells out the name it
// injects SATISFIES THE SCAN WITH ITS OWN SOURCE - the injection came back
// SILENT and the gate looked broken. Verification 39's Round 8 remedy: the
// harness names the string nowhere, because an exemption list rots and an
// absent string cannot.
const GONE = ['tbChevronLoad', 'Token', 'ZZ'].join('')
const SNAP = join(ROOT, '.verify/usl-snap')
const MARKER = join(SNAP, 'IN-FLIGHT')
if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists - a previous run was killed before restoring.`)
  console.error(`Restore by hand from ${SNAP}, delete the marker, then re-run.`)
  process.exit(2)
}
mkdirSync(SNAP, { recursive: true })
const keyFor = (rel) => rel.replace(/\//g, '_')

const INJECTIONS = [
  { id: 'a-panel-builds-its-own-header',
    file: 'frontend-react/src/leads/InlineSummary.tsx',
    find: '    <Panel\n      name="summary"',
    to: '    <div className="card-col-head" /> && <Panel\n      name="summary"',
    // RE-POINTED. This round RENAMED the test it anchors on, so the matcher
    // stopped matching and the injection came back SILENT while the gate was
    // going red exactly as it should. Verification 51's caveat: before a
    // silence names an unasserted claim, confirm the matcher saw the failure.
    expect: 'a Leads surface does not build a panel header of its own' },
  { id: 'a-dialogue-hand-rolls-a-backdrop',
    file: 'frontend-react/src/leads/NurtureDialog.tsx',
    find: '    <Modal\n      title="Move to Nurture"',
    to: '    <div className="modal-backdrop" /> && <Modal\n      title="Move to Nurture"',
    expect: 'SECTION 4 and 5 live in ONE place' },
  { id: 'a-control-loses-its-class',
    file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '          className="acct-picker-input"\n', to: '',
    expect: 'every control on a Leads surface carries a class' },
  { id: 'a-panel-action-takes-its-own-treatment',
    file: 'frontend-react/src/ui/SaveControl.tsx',
    find: '      <button type="button" className="btn-sm" data-testid={saveId}',
    to: '      <button type="button" className="btn-primary" data-testid={saveId}',
    expect: 'panel-scoped actions use ONE treatment' },
  { id: 'aria-controls-points-at-nothing',
    file: 'frontend-react/src/leads/LeadCardActions.tsx',
    find: '          aria-controls={`address-popup-region-${leadId}`}',
    to: '          aria-controls={`no-such-region-${leadId}`}',
    expect: 'every aria-controls on a Leads surface names a declared id' },
  { id: 'the-registry-stops-emitting',
    file: 'frontend-react/src/ui/Panel.tsx',
    find: 'data-panel={name}', to: 'data-panel-disabled={name}',
    expect: 'the registry is STRUCTURAL' },
  { id: 'the-document-cites-something-gone',
    file: 'INTERACTION_STANDARDS.md',
    // A UNIQUE anchor. `refreshTbNextStageButton()` appears twice in the
    // document, and the harness refused rather than guessing which - which
    // is the guard working, and the reason it exists.
    find: '`tbChevronLoadToken`', to: `\`${GONE}\``,
    expect: 'every identifier INTERACTION_STANDARDS cites still exists' },
  // ── THIS ROUND'S FOUR ─────────────────────────────────────────────────
  { id: 'a-panel-header-built-by-hand',
    file: 'frontend-react/src/leads/QualifyCompletion.tsx',
    find: '      className="lead-complete-group">',
    to: '      className="lead-complete-group lead-thing-title">',
    expect: 'a Leads surface does not build a panel header of its own' },
  { id: 'the-shell-vocabulary-stops-being-derived',
    file: 'frontend-react/src/ui/Panel.tsx',
    find: 'className="panel-head', to: 'className="pnl-head',
    expect: 'the shell vocabulary is DERIVED' },
  { id: 'the-autofill-override-uses-the-wrong-property',
    file: 'frontend/style.css',
    find: '  -webkit-box-shadow: 0 0 0 1000px var(--black) inset;',
    to: '  background-color: var(--black);',
    expect: 'the autofill override exists and targets' },
  { id: 'a-card-input-class-loses-autofill-cover',
    file: 'frontend/style.css',
    find: '.cd-note-input:-webkit-autofill,\n', to: '',
    expect: 'the autofill override exists and targets' },
  { id: 'the-escape-hatch-is-emptied',
    file: 'INTERACTION_STANDARDS.md',
    find: '## Identifiers asserted ABSENT', to: '## Identifiers formerly asserted ABSENT',
    expect: 'the escape hatch is USED, not merely available' },
]
const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

for (const rel of FILES) writeFileSync(join(SNAP, keyFor(rel)), readFileSync(join(ROOT, rel)))
for (const rel of FILES) {
  const p = join(SNAP, keyFor(rel))
  if (!existsSync(p) || !readFileSync(p).equals(readFileSync(join(ROOT, rel)))) {
    console.error(`SNAPSHOT MISSING OR DIFFERENT for ${rel} - refusing`); process.exit(2)
  }
}
writeFileSync(MARKER, 'in flight')
console.log(`snapshotted ${FILES.length} files by full path, marker written\n`)

const run = () => {
  try {
    return { out: execFileSync('node', ['--test',
      'scripts/tests/panel-conformance.test.mjs', 'scripts/tests/standards-staleness.test.mjs'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }), code: 0 }
  } catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } }
}

const results = []
for (const inj of INJECTIONS) {
  const abs = join(ROOT, inj.file)
  const before = readFileSync(abs, 'utf8')
  if (!before.includes(inj.find)) {
    console.error(`ANCHOR NOT FOUND for ${inj.id} in ${inj.file}`); rmSync(MARKER); process.exit(2)
  }
  if (before.split(inj.find).length - 1 !== 1) {
    console.error(`ANCHOR NOT UNIQUE for ${inj.id}`); rmSync(MARKER); process.exit(2)
  }
  writeFileSync(abs, before.replace(inj.find, inj.to))
  const t0 = process.hrtime.bigint()
  const { out, code } = run()
  const ms = Number((process.hrtime.bigint() - t0) / 1000000n)
  // `node --test` marks a failure with U+2716. Anchored on the NAMED test.
  const failed = out.split('\n').filter((l) => /^\s*(✖|not ok)/.test(l))
  const fired = failed.some((l) => l.includes(inj.expect))
  const why = fired ? `"${inj.expect}" failed`
    : (code === 0 ? 'the gate stayed GREEN' : 'red, but NOT on the named check')
  results.push({ id: inj.id, fired, why })
  console.log(`  ${fired ? 'FIRED  ' : 'SILENT '} ${inj.id.padEnd(36)} ${String(ms).padStart(5)}ms  ${why}`)

  const snap = readFileSync(join(SNAP, keyFor(inj.file)))
  writeFileSync(abs, snap)
  if (!readFileSync(abs).equals(snap)) {
    console.error(`RESTORE MISMATCH on ${inj.file} - STOPPING`); process.exit(2)
  }
}

console.log('\nthe reverted run:')
for (const rel of FILES) {
  if (!readFileSync(join(ROOT, rel)).equals(readFileSync(join(SNAP, keyFor(rel))))) {
    console.error(`  ${rel} DIFFERS from its snapshot`); process.exit(2)
  }
  console.log(`  ${rel} byte-identical`)
}
const final = run()
console.log(`  the two gates: exit ${final.code}`)
rmSync(MARKER)
const silent = results.filter((r) => !r.fired)
console.log(`\n${results.length - silent.length}/${results.length} fired`)
for (const s of silent) console.log(`  SILENT: ${s.id} - ${s.why}`)
process.exit(silent.length === 0 && final.code === 0 ? 0 : 1)
