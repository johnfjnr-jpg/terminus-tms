// Calibration for the Contact surface, Round 6 Phase 1.
// Verification 9, and Verification 47: a suite green on its FIRST run is the
// signature of tests written to agree with the component. These make it evidence.
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

const LINK = 'frontend-react/src/contact/LinkAccountPanel.tsx'
const HOST = 'frontend-react/src/contact/ContactHost.tsx'
const PANEL = 'frontend-react/src/contact/ContactPanel.tsx'
const DESC = 'frontend-react/src/contact/descriptors.ts'
const BLOCK = 'frontend-react/src/contact/blocking.ts'
const EDITORS = 'frontend-react/src/field-row/editors.tsx'
const ROW = 'frontend-react/src/field-row/FieldRow.tsx'

const INJECTIONS = [
  // ── FAMILY: THE LOOKUP EDITOR ─────────────────────────────────────────
  { name: 'the display half stops resolving an id to its name',
    file: EDITORS,
    find: 'return normaliseOptions(field.options).find((o) => o.id === value)?.name ?? value',
    replace: 'return value',
    expect: 'a UUID reached the screen' },

  { name: 'an unrecognised stored id is DROPPED from the list',
    file: EDITORS,
    find: 'return [...list, { id: value, name: value }]',
    replace: 'return list',
    expect: 'the stored id was dropped from the list' },

  { name: 'the connected row renders the raw draft again',
    file: ROW,
    find: '{displayValueFor({ ...field, value: rows.valueOf(field.name) })\n          ? <>\n              {displayValueFor({ ...field, value: rows.valueOf(field.name) })}',
    replace: '{rows.valueOf(field.name)\n          ? <>\n              {rows.valueOf(field.name)}',
    expect: 'the connected row rendered the raw id' },

  // ── FAMILY: C2, THE TINT ──────────────────────────────────────────────
  { name: 'C2 REINSTATED: the gate key is matched against row names',
    file: DESC,
    find: "const GATE_KEY: Record<string, string> = {\n  industry: 'industry_id',\n}",
    replace: 'const GATE_KEY: Record<string, string> = {}',
    expect: 'a person blocked on Industry is shown nothing' },

  { name: 'an unplaceable blocker is swallowed instead of said out loud',
    file: HOST,
    find: '      if (lost.length) {',
    replace: '      if (false) {',
    // THE EXPECT IS THE TEST NAME, not a message fragment. The assertion that
    // fires here is `must('cd-save-feedback')` throwing, whose message is
    // "no cd-save-feedback" and mentions nothing about the blocker - so a
    // matcher on the blocker's name reported SILENT for an injection that was
    // caught. Verification 51: the silence had to be explained, and the answer
    // was about the instrument rather than about a missing detector.
    expect: 'AN UNPLACEABLE BLOCKER IS SAID OUT LOUD' },

  { name: 'the Account card stops being tinted',
    file: PANEL,
    find: 'blocked={accountCardBlocked(blocking)}',
    replace: 'blocked={false}',
    expect: 'cd-card-account' },

  // ── FAMILY: THE BLOCKING LIFECYCLE ────────────────────────────────────
  { name: 'resolution stops clearing the tint',
    file: BLOCK,
    find: '  const blockers = state.blockers.filter((b) => !gateFieldIsPresent(blockerValue(b.field, record, payload)))',
    replace: '  const blockers = state.blockers',
    expect: 'field-blocked' },

  { name: 'the emptiness rule becomes truthiness, so 0 and false block for ever',
    file: BLOCK,
    find: '!gateFieldIsPresent(blockerValue(b.field, record, payload))',
    replace: '!blockerValue(b.field, record, payload)',
    expect: "the server's emptiness rule is used" },

  { name: 'a blocking list survives onto a DIFFERENT contact',
    file: BLOCK,
    find: 'return state && state.recordId === recordId ? state : null',
    replace: 'return state',
    expect: 'blocking state survived onto a different contact' },

  // ── FAMILY: THE SAVE PATH ─────────────────────────────────────────────
  { name: 'industry is sent as a payload key instead of a column',
    file: HOST,
    find: "      if (k === 'industry') { body.industry_id = v || null; continue }",
    replace: '',
    expect: 'industry went through the payload' },

  { name: 'one note per FIELD instead of one per save session',
    file: HOST,
    find: "      { text: sentences.join(' '), at: new Date().toISOString(), by: shell.currentUserEmail() },",
    replace: "      ...sentences.map((s) => ({ text: s, at: new Date().toISOString(), by: shell.currentUserEmail() })),",
    expect: 'notes' },

  { name: 'the note names the industry by its id',
    file: HOST,
    find: "      k === 'industry' ? ((industries.find((i) => i.id === v)?.name ?? v) || 'nothing') : (v || 'nothing')",
    replace: "      (v || 'nothing')",
    expect: 'a UUID reached the notes history' },

  { name: 'the revision handshake is dropped from the save',
    file: HOST,
    find: '      expected_revision: Number.isInteger(record.latest_revision_number)\n        ? record.latest_revision_number : undefined,',
    replace: '      expected_revision: undefined,',
    expect: 'expected_revision' },

  { name: 'the surface starts sending a key it does not own',
    file: HOST,
    find: '      if (PAYLOAD_KEYS.has(k)) payloadUpdate[k] = v',
    replace: "      payloadUpdate[k] = v; payloadUpdate.legalEntity = 'x'",
    expect: 'legalEntity' },

  // ── FAMILY: THE LINK-ACCOUNT PANEL ────────────────────────────────────
  { name: 'the in-flight guard becomes STATE again, which cannot fire',
    file: LINK,
    find: "if (inFlight.current) return\n    inFlight.current = true",
    replace: "if (busy) return",
    expect: 'a second request went out while the first was in flight' },

  { name: 'C6 REINSTATED: the dirty path stops guarding',
    file: LINK,
    find: "    if (inFlight.current) return\n    if (hasDirtyEdits)",
    replace: "    if (hasDirtyEdits)",
    expect: 'the discard dialogue was opened twice' },

  { name: 'a link refusal closes the panel instead of showing why',
    file: LINK,
    find: "if (!r.ok) { setError(r.data?.error ?? 'Failed to link account.'); return }",
    replace: "if (!r.ok) { setOpen(false); return }",
    // The test aborts on `must('cd-link-error')` throwing, before reaching the
    // message about the panel - so the TEST NAME is the anchor, for the third
    // time in this sweep. A matcher on a message only fires if that assertion
    // is the FIRST to fail.
    expect: 'a refusal is SHOWN and the panel stays open' },

  { name: 'the search stops sharing its substring definition',
    file: LINK,
    find: "return accounts.filter((a) => a.name.toLowerCase().includes(q))",
    replace: "return accounts.filter((a) => a.name.toLowerCase().startsWith(q))",
    expect: 'one substring definition, shared by both callers' },
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run',
      'src/__tests__/contact-surface.test.tsx', 'src/__tests__/contact-blocking.test.ts',
      'src/__tests__/field-row-editors.test.tsx', 'src/__tests__/field-row.test.tsx',
      'src/__tests__/contact-link-account.test.tsx'],
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
