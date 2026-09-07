// Calibration for the five capabilities, Round 6 Phase 2b. One injection per
// behaviour family, restoring the shape the vanilla had a reason for - so each
// asserts a RULING rather than an implementation detail.
//
// Verified-snapshot harness per Verification 44: full-path keys, the snapshot
// asserted to exist and be non-empty BEFORE anything is injected, the restore
// compared byte-for-byte after EVERY injection with a stop on mismatch, and a
// unique-anchor requirement so an injection cannot land twice.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-r.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })

const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))

const snapshot = (f) => {
  const src = path.join(ROOT, f)
  const bytes = fs.readFileSync(src)
  if (!bytes.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), bytes)
  const back = fs.readFileSync(key(f))
  if (!back.equals(bytes)) { console.error(`REFUSED: snapshot of ${f} did not round-trip`); process.exit(2) }
  return bytes
}
const restore = (f, original) => {
  fs.writeFileSync(path.join(ROOT, f), original)
  const now = fs.readFileSync(path.join(ROOT, f))
  if (!now.equals(original)) { console.error(`STOP: restore of ${f} did not match`); process.exit(2) }
}

const NOTES = 'frontend-react/src/contact/NotesHistory.tsx'
const PARK = 'frontend-react/src/contact/ParkForm.tsx'
const ACTS = 'frontend-react/src/contact/StageActions.tsx'
const MODAL = 'frontend-react/src/contact/AccountDetailsModal.tsx'
const HOST = 'frontend-react/src/contact/ContactHost.tsx'

const INJECTIONS = [
  { name: 'N2: the empty open note button stops being disabled',
    file: NOTES,
    find: 'disabled={!text.trim()} onClick={onClick}>Add note</button>',
    replace: 'onClick={onClick}>Add note</button>',
    expect: 'the empty open state can reach the submit branch' },

  { name: 'N6: a 409 throws the typed text away',
    file: NOTES,
    find: 'if (await onAdd(t)) { setText(\'\'); setOpen(false) }',
    replace: 'await onAdd(t); setText(\'\'); setOpen(false)',
    expect: 'N6 a 409 RELOADS and KEEPS the typed text' },

  { name: 'N7: the add stops asking a dirty surface',
    file: NOTES,
    find: 'if (hasDirtyEdits) { onConfirmDiscard(() => { void submit() }); return }',
    replace: 'if (false) { onConfirmDiscard(() => { void submit() }); return }',
    expect: 'the add reloads, which would discard the open field' },

  { name: 'P2: the move happens BEFORE the note, so a failed move loses the reason',
    file: HOST,
    find: "  const park = async (date: string, reason: string) => {\n    setParkError(null)",
    replace: "  const park = async (date: string, reason: string) => {\n    setParkError(null)\n    await shell.api('POST', `/api/records/${contact.id}/transition`, { to_stage: 'Parked' })",
    expect: 'P2 TWO writes in order, and the NOTE goes first' },

  { name: 'P6: a backdrop click on a dirty form closes it',
    file: PARK,
    find: 'if (dirty) { setNagging(true); return }',
    replace: 'if (false) { setNagging(true); return }',
    expect: 'an accidental dismissal closed the form' },

  { name: 'P8: the form stays open under the discard dialogue',
    file: PARK,
    find: 'flushSync(() => { onCancel() })',
    replace: 'onCancel()',
    expect: 'the park popup was still covering the screen' },

  { name: 'U3: unqualify is offered on an already-unqualified contact',
    file: ACTS,
    find: "{status !== 'Unqualified'",
    replace: '{true',
    expect: 'U3 it is not offered' },

  { name: 'D1: delete returns to a FIXED list instead of the return view',
    file: HOST,
    find: 'shell.navigate(returnViewFor(record.status ?? null))\n  }\n\n  /** A2',
    replace: "shell.navigate('contacts')\n  }\n\n  /** A2",
    // THE SIBLING, not the obvious one. Hardcoding 'contacts' leaves the
    // QUALIFIED case passing by luck and breaks the unqualified one - so the
    // test this injection actually falsifies is the second of the pair. Fifth
    // time in this round that an expect matcher, not a missing detector, was
    // what a silence meant.
    expect: 'D1 and an unqualified one returns to leads' },

  { name: 'D2: a failed delete navigates anyway',
    file: HOST,
    find: "    const r = await shell.api('DELETE', `/api/contacts/${contact.id}`)\n    if (!r.ok) return",
    replace: "    const r = await shell.api('DELETE', `/api/contacts/${contact.id}`)\n    void r",
    expect: 'a failed delete navigated anyway' },

  { name: 'D3: create is offered on an unqualified contact',
    file: ACTS,
    find: '      {qualified\n        ? <div className="cd-create-section"',
    replace: '      {true\n        ? <div className="cd-create-section"',
    expect: 'D3 create is offered ONLY on a Qualified contact' },

  { name: 'A2: the modal stops opening when nothing matches',
    file: HOST,
    find: '          setModal(\'new\')',
    replace: '          void 0',
    expect: 'a blocked Account with no match left the person to find the form' },

  { name: 'A3: the name stops being required',
    file: MODAL,
    find: "if (!name.trim()) { setOwn('A name is required.'); return }",
    replace: 'if (false) { return }',
    expect: 'A3 the name is required' },
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', 'src/__tests__/contact-capabilities.test.tsx'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe' })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/Tests\s+(\d+) failed/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const inj of INJECTIONS) if (!originals.has(inj.file)) originals.set(inj.file, snapshot(inj.file))

let detected = 0
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times in ${inj.file}, needs exactly 1`); restore(inj.file, original); process.exit(2) }
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
for (const [f, bytes] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(bytes)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
