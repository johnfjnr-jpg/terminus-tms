// Calibration for Round 7 Phase 2d session 2: the view's load and render.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2d-s2.mjs <scratch-dir>'); process.exit(2) }
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

const V = 'frontend-react/src/testbed/viewLoad.ts'
const H = 'frontend-react/src/testbed/ViewHeader.tsx'
const T = 'frontend-react/src/testbed/TestBedHost.tsx'

const INJECTIONS = [
  { name: 'L2: a plain load reads as an ARRIVAL, jumping to Reference on every save', file: V,
    find: '  let freshNavigation = false',
    replace: '  let freshNavigation = true',
    expect: 'a load is NOT an arrival unless something says so' },

  { name: 'L1: the arrival flag SURVIVES being consumed', file: V,
    find: '      const was = freshNavigation\n      freshNavigation = false\n      return was',
    replace: '      return freshNavigation',
    expect: 'THE FLAG IS SPENT EVEN WHEN THE LOAD THEN FAILS' },

  { name: 'R5: the landing stage is read and NOT cleared', file: V,
    find: '      const was = landing\n      landing = null\n      return was',
    replace: '      return landing',
    expect: 'the landing stage is read and CLEARED' },

  { name: 'R6: the terminal stage is excepted from landing again', file: V,
    find: '    landOn(stage: string) { landing = stage },',
    replace: "    landOn(stage: string) { landing = stage === 'Closed' ? null : stage },",
    expect: 'the landing applies to EVERY stage including the terminal one' },

  { name: 'L5: the door stops needing an owner, so an unowned record locks', file: V,
    find: '  return !!record?.owner_id && !!viewerId && record.owner_id !== viewerId',
    replace: '  return !!viewerId && record?.owner_id !== viewerId',
    expect: 'an absent id on either side is NOT not-mine' },

  { name: 'L5: the door inverts, locking the owner out of their own record', file: V,
    find: '  return !!record?.owner_id && !!viewerId && record.owner_id !== viewerId',
    replace: '  return !!record?.owner_id && !!viewerId && record.owner_id === viewerId',
    expect: 'not-mine needs ALL THREE' },

  { name: 'L7: the refusal text becomes an access-denied', file: V,
    find: "  'This record belongs to another user. You can view it, but only its owner can change it.'",
    replace: "  'Access denied.'",
    expect: 'the refusal text says view-not-edit, not access-denied' },

  { name: 'L4: a failed load keeps the last record\'s name', file: V,
    find: "  if (!record) return { name: 'Not found', client: '' }",
    replace: "  if (false) return { name: 'Not found', client: '' }",
    expect: 'a failed load reads Not found rather than a stale name' },

  { name: 'R1: a missing name renders empty rather than visibly absent', file: V,
    find: "    name: record.payload?.name ?? '--',",
    replace: "    name: record.payload?.name ?? '',",
    expect: 'name and client organisation, with the name falling back visibly' },

  { name: 'R1: the client element is dropped when empty, so the header moves', file: H,
    find: '      <p className="sub" data-testid="tb-detail-client">{client}</p>',
    replace: '      {client ? <p className="sub" data-testid="tb-detail-client">{client}</p> : null}',
    expect: 'the client element STAYS when empty' },

  { name: 'L6: the banner renders on every record', file: H,
    find: '        {readOnly',
    replace: '        {true',
    expect: "the banner is EMPTY on an owned record and present on another's" },

  { name: 'L5: the host stops reading the viewer, so nobody is ever the owner', file: T,
    find: '  const readOnly = notMine(record, shell.currentUserId())',
    replace: '  const readOnly = notMine(record, null)',
    expect: "another user's record shows it" },

  { name: 'L5: a signed-out viewer is told the record is somebody else\'s', file: T,
    find: '  const readOnly = notMine(record, shell.currentUserId())',
    replace: "  const readOnly = notMine(record, shell.currentUserId() ?? 'nobody')",
    expect: 'a signed-out viewer is NOT told the record is somebody' },

  { name: 'the history read trusts data.entries again, which a bare array satisfies', file: T,
    find: '      setHistory(r.ok && Array.isArray(r.data?.entries)\n        ? { entries: r.data.entries, failed: false }\n        : { entries: [], failed: !r.ok })',
    replace: '      setHistory(r.ok ? { entries: (r.data?.entries ?? []) as HistoryEntry[], failed: false }\n        : { entries: [], failed: true })',
    expect: 'a response whose data is a BARE ARRAY does not reach the history panel' },

  { name: 'the drafts guard goes, and the suite hangs on a render loop', file: T,
    // THE EXPECTED RESULT IS A HANG, and that is declared rather than scored as
    // a silence. Verification 48: a harness must stop on a run that produced no
    // parseable result, never treat it as a verdict - an expired token and a
    // caught injection read identically otherwise. Declaring it here makes the
    // timeout the evidence for THIS injection and a STOP for any other.
    expectHang: true,
    find: '    setDrafts((prev) => {\n      const keys = Object.keys(next)',
    replace: '    setDrafts(next)\n    void ((prev: Record<string, string>) => {\n      const keys = Object.keys(next)',
    expect: 'the OWNER sees no banner' },
]

const SUITES = [
  'src/__tests__/testbed-view-load.test.ts',
  'src/__tests__/testbed-view-surface.test.tsx',
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
