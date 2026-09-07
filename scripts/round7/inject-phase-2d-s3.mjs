// Calibration for Round 7 Phase 2d session 3: documents, convert and the refresh.
//
// Uses session 2's hardened harness verbatim: the .in-flight marker that
// refuses to snapshot the wreckage of a killed run, and the expectHang stop
// that never scores a run which produced no parseable result.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2d-s3.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })
const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))

// ── A KILLED HARNESS MUST NOT BE INVISIBLE. Round 7 Phase 2d session 2 ──
//
// THIS HARNESS DESTROYED THE WORK IT WAS CALIBRATING, on its first run, and it
// is the third instance of that shape in this project (Verification 44).
//
// The mechanism, and it is specific to a sweep that deliberately injects a
// HANG: injections 1-14 each fail in a few seconds, so the run raced through
// them, applied the last one - which removes a guard against an infinite render
// loop - and hung. The shell killed the whole process at its own two-minute
// wall, so the restore never ran and the mutation stayed on disk.
//
// THE SECOND RUN THEN SNAPSHOTTED THE MUTATION AS THE ORIGINAL and faithfully
// restored it after every injection. The damage was not merely left: it was
// blessed. The only reason it surfaced is that the suite hung afterwards, which
// is luck rather than a control.
//
// The marker is the control. It is written before the first injection and
// removed after the final revert, so a run that finds one knows the previous
// run died mid-injection and REFUSES rather than snapshotting the wreckage.
const MARKER = path.join(SNAP, '.in-flight')
if (fs.existsSync(MARKER)) {
  console.error('REFUSED: a previous run of this harness did not finish.')
  console.error('  Its snapshots are in ' + SNAP + ' and the tree may still carry an injection.')
  console.error('  Restore each file from its snapshot, then delete ' + MARKER)
  process.exit(2)
}
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

const D = 'frontend-react/src/testbed/stageDocuments.ts'
const X = 'frontend-react/src/testbed/convert.ts'
const CP = 'frontend-react/src/testbed/ConvertPanel.tsx'
const ST = 'frontend-react/src/testbed/StageTabs.tsx'

const INJECTIONS = [
  // ── C: the document write, and approve is the whole point ────────────
  { name: 'C2: THE URL SAVE STOPS PASSING approve:false, so it approves the document', file: D,
    find: '    approve: false as const,',
    replace: '    approve: true as const,',
    expect: 'SAVING A URL MUST NOT APPROVE' },

  { name: 'C2: approve is omitted from the save, so the route default approves', file: D,
    find: "  return {\n    document_type: documentType,\n    document_location: String(url ?? '').trim(),\n    approve: false as const,\n  }",
    replace: "  return {\n    document_type: documentType,\n    document_location: String(url ?? '').trim(),\n  }",
    expect: 'SAVING A URL MUST NOT APPROVE' },

  { name: 'C2: the CONFIRM starts sending approve:false, so nothing ever approves', file: D,
    find: "  return u ? { document_type: documentType, document_location: u }\n    : { document_type: documentType }",
    replace: "  return u ? { document_type: documentType, document_location: u, approve: false }\n    : { document_type: documentType, approve: false }",
    expect: 'a confirm does NOT pass approve at all' },

  { name: 'C3: the confirm stops carrying the URL box', file: D,
    find: '  return u ? { document_type: documentType, document_location: u }',
    replace: '  return false ? { document_type: documentType, document_location: u }',
    expect: 'confirm CARRIES the URL box' },

  { name: 'C3: an empty box sends an empty location, overwriting a stored URL', file: D,
    find: "  return u ? { document_type: documentType, document_location: u }\n    : { document_type: documentType }",
    replace: '  return { document_type: documentType, document_location: u }',
    expect: 'omits the key entirely when the box is empty' },

  { name: 'C4: the feedback stops naming the error', file: D,
    find: "    : { text: `Could not save URL: ${error ?? 'unknown error'}`, kind: 'err' as const }",
    replace: "    : { text: 'Could not save URL.', kind: 'err' as const }",
    expect: 'the feedback says which outcome, per row' },

  { name: 'the route becomes the one session 1 invented', file: D,
    find: '  `/api/test-beds/${id}/complete-document`',
    replace: '  `/api/test-beds/${id}/documents/confirm`',
    expect: 'ONE route serves both' },

  // ── X: convert ───────────────────────────────────────────────────────
  { name: 'X1: a blank name reaches the server', file: X,
    find: "  if (!n) return { ok: false, error: 'Opportunity name is required.' }",
    replace: '  if (false) return { ok: false, error: :: }'.replace('::', "'Opportunity name is required.'"),
    expect: 'the name is REQUIRED before any request' },

  { name: 'X1: the name is not trimmed', file: X,
    find: "  const n = String(name ?? '').trim()",
    replace: "  const n = String(name ?? '')",
    expect: 'a name is trimmed and sent under the route' },

  { name: 'a refusal loses the SERVER sentence and says something generic', file: X,
    find: "    return { text: error ?? 'Conversion failed.', kind: 'err', opportunityId: null }",
    replace: "    return { text: 'Conversion failed.', kind: 'err', opportunityId: null }",
    expect: "a refusal carries the SERVER's sentence" },

  { name: 'X3: success stops naming the record to go to', file: X,
    find: '    opportunityId: data?.id ?? null,',
    replace: '    opportunityId: null,',
    expect: 'success OFFERS navigation rather than performing it' },

  { name: 'X3: a REFUSAL offers a record to view', file: CP,
    find: '            {feedback.opportunityId',
    replace: '            {true',
    expect: "a REFUSAL keeps the form open and shows the server" },

  { name: 'X2: a refusal CLOSES the form, losing the typed name', file: CP,
    find: "                  if (f.kind === 'ok') setOpen(false)",
    replace: '                  setOpen(false)',
    expect: 'a REFUSAL keeps the form open and shows the server' },

  { name: 'X4: cancel stops clearing the feedback', file: CP,
    find: '  const reset = () => { setOpen(false); setName(\'\'); setFeedback(null) }',
    replace: "  const reset = () => { setOpen(false); setName('') }",
    expect: 'cancel clears the name AND the feedback' },

  // ── F: the stage refresh ─────────────────────────────────────────────
  { name: 'F1: the effect watches every render, so each one refetches', file: ST,
    // An effect with no dependency array re-runs on every render, and this one
    // renders. The expected result is a HANG, declared so the timeout is
    // evidence for this injection and a hard stop for any other.
    expectHang: true,
    find: '  }, [refreshToken])',
    replace: '  })',
    expect: 'an UNCHANGED token does not reload' },

  { name: 'F1: the refresh never fires at all', file: ST,
    find: '    if (refreshToken === undefined || !lastTab.current) return',
    replace: '    if (true) return',
    expect: 'a bumped token RE-LOADS the open stage' },
]

const SUITES = [
  'src/__tests__/testbed-convert-docs.test.ts',
  'src/__tests__/testbed-convert-surface.test.tsx',
  'src/__tests__/testbed-stage-surface.test.tsx',
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', ...SUITES, '--testTimeout=8000'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe', timeout: 20000 })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/Tests\s+(\d+) failed/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const i of INJECTIONS) if (!originals.has(i.file)) originals.set(i.file, snapshot(i.file))
fs.writeFileSync(MARKER, new Date(0).toISOString())

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
  const noResult = r.failed < 0
  if (noResult && !inj.expectHang) {
    // Verification 48. A stage that produced no result has not run, and
    // scoring it either way is a guess.
    console.error(`STOP: "${inj.name}" produced NO PARSEABLE RESULT in ${ms}ms.`)
    console.error('  Neither DETECTED nor SILENT is knowable. Restoring and stopping.')
    restore(inj.file, original)
    fs.rmSync(MARKER, { force: true })
    process.exit(2)
  }
  const fired = inj.expectHang ? noResult : (r.failed > 0 && r.out.includes(inj.expect))
  if (fired) detected++
  else silent.push({ name: inj.name, failed: r.failed })
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}`
    + `  (${inj.expectHang ? 'hung as declared' : `${r.failed} failed`}, ${ms}ms)`)
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
// Removed only after every file has been compared to its snapshot above.
if (process.exitCode !== 2) fs.rmSync(MARKER, { force: true })
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
