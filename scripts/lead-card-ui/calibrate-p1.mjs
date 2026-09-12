// ── PHASE 1's CALIBRATION SWEEP ──────────────────────────────────────────
//
// Every new check shown firing on an injected fault and silent on the healthy
// tree. Built to Verification 44's requirements, each of which this estate
// has paid for:
//
//   - snapshots the ACTUAL BYTES, keyed by FULL PATH (src/lib and src/routes
//     mirror basenames on purpose, and a harness once restored one over the
//     other);
//   - asserts the snapshot exists BEFORE injecting anything (a zsh harness
//     silently snapshotted nothing and landed nine injections cumulatively);
//   - compares restored bytes after EVERY injection and STOPS DEAD on a
//     mismatch rather than compounding;
//   - writes an IN-FLIGHT MARKER and REFUSES to start if one is present, so a
//     killed run cannot have its own mutation snapshotted as the original by
//     the next run;
//   - never uses `git checkout` as the restore: that reverts to the last
//     COMMIT, and a mid-phase tree is not the last commit;
//   - ends with a FULL REVERTED RUN, which has been the sole witness to a
//     broken harness four times in this estate.
//
// AND IT ANCHORS ON WHICH ASSERTION FAILED, not on the exit code. An
// injection that kills a probe early goes red without ever reaching the check
// it was written for, and a red run and a red run look the same.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = join(ROOT, '.verify/lcuf-snap')
const MARKER = join(SNAP, 'IN-FLIGHT')

if (existsSync(MARKER)) {
  console.error(`REFUSING TO RUN: ${MARKER} exists.`)
  console.error('A previous run was killed before restoring. Restore from')
  console.error(`${SNAP} by hand, delete the marker, and re-run.`)
  process.exit(2)
}
mkdirSync(SNAP, { recursive: true })

// FULL PATH as the key, separators replaced. Never the basename.
const keyFor = (rel) => rel.replace(/\//g, '_')

const INJECTIONS = [
  { id: 'R7-timestamp-raw', file: 'src/lib/format-dates.js',
    find: "return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`\n    + ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`",
    to: 'return s',
    runner: 'pure', expect: 'a timestamp renders DD/MM/YY HH:MM:SS' },
  { id: 'R7-date-carries-time', file: 'src/lib/format-dates.js',
    find: "  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`",
    to: "  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)} 00:00:00`",
    runner: 'pure', expect: 'a date renders DD/MM/YY and carries no time' },
  { id: 'R7-day-shifts-westward', file: 'src/lib/format-dates.js',
    find: '  const m = DATE_ONLY.exec(s)\n  if (m)', to: '  const m = null\n  if (m)',
    runner: 'pure', expect: 'a date-only value does not shift a day' },
  { id: 'R7-census-sees-a-raw-render', file: 'frontend-react/src/contact/NotesHistory.tsx',
    find: '<span className="ref-notes-when">{formatTimestamp(n.at)}</span>',
    to: '<span className="ref-notes-when">{n.at}</span>',
    runner: 'census', expect: 'RAW' },
  { id: 'R1-no-filtering', file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '  const matches = findAccountMatches(query, accounts)',
    to: '  const matches = query.trim() ? accounts : []',
    runner: 'react', expect: 'A2 it filters PER KEYSTROKE' },
  { id: 'R1-create-back-inside-the-list', file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '      <div className="acct-picker-row">\n        <input',
    to: '      <div className="acct-picker-row">\n        <span />\n        <input',
    runner: 'react', expect: 'A3 CREATE IS TO THE RIGHT OF THE INPUT' },
  { id: 'R1-enter-picks-unhighlighted', file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '      if (active >= 0 && active < matches.length) { e.preventDefault(); choose(matches[active]) }',
    to: '      { e.preventDefault(); choose(matches[active >= 0 ? active : 0]) }',
    runner: 'react', expect: 'A10 Enter with NOTHING highlighted' },
  { id: 'R1-door-exemption-on-a-wrapper', file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '    <div className="acct-picker" data-testid={`acct-picker-${leadId}`}>',
    to: '    <div className="acct-picker" aria-controls={listId} data-testid={`acct-picker-${leadId}`}>',
    runner: 'react', expect: 'A11 THE DOOR' },
  { id: 'R1-reentrancy-guard-removed', file: 'frontend-react/src/leads/AccountPicker.tsx',
    find: '    if (inFlight.current) return\n    inFlight.current = true',
    to: '    if (busy) return', runner: 'react', expect: 'A12 two clicks in one tick' },
  { id: 'R3-title-not-on-the-header-row', file: 'frontend-react/src/contact/NotesHistory.tsx',
    find: '        {title\n          ? <span className="lead-card-col-title" data-testid="cd-notes-title">{title}</span>\n          : null}',
    to: '        {null}', runner: 'react', expect: 'N-R3 given a title' },
  { id: 'R3-shared-class-on-every-surface', file: 'frontend-react/src/contact/NotesHistory.tsx',
    find: "      <div className={`cd-notes-header-row${title ? ' card-col-head' : ''}`}",
    to: '      <div className="cd-notes-header-row card-col-head"',
    runner: 'react', expect: 'N-R3 WITHOUT the prop' },
  { id: 'R8-buttons-unclassed-again', file: 'frontend-react/src/contact/NotesHistory.tsx',
    find: '          ? <button type="button" className="btn-sm" data-testid="cd-add-note-btn"\n              disabled={open && !text.trim()}',
    to: '          ? <button type="button" data-testid="cd-add-note-btn"\n              disabled={open && !text.trim()}',
    runner: 'react', expect: 'N-R8 the header controls are CLASSED' },
  { id: 'R4-empty-sentence-reinstated', file: 'frontend-react/src/contact/NotesHistory.tsx',
    find: '        {notes.slice(0, shown).map((n, i) => (',
    to: '        {notes.length === 0 ? <p className="empty-state" data-testid="cd-notes-empty">No notes yet.</p> : null}\n        {notes.slice(0, shown).map((n, i) => (',
    runner: 'react', expect: 'N1 an empty history says NOTHING' },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

// ── SNAPSHOT, AND PROVE IT EXISTS ────────────────────────────────────────
for (const rel of FILES) {
  const bytes = readFileSync(join(ROOT, rel))
  writeFileSync(join(SNAP, keyFor(rel)), bytes)
}
for (const rel of FILES) {
  const p = join(SNAP, keyFor(rel))
  if (!existsSync(p)) { console.error(`SNAPSHOT MISSING for ${rel} - refusing`); process.exit(2) }
  if (!readFileSync(p).equals(readFileSync(join(ROOT, rel)))) {
    console.error(`SNAPSHOT DIFFERS from source for ${rel} - refusing`); process.exit(2)
  }
}
writeFileSync(MARKER, new Date(0).toISOString())
console.log(`snapshotted ${FILES.length} files by full path, marker written\n`)

const run = (runner) => {
  try {
    if (runner === 'pure')
      return { out: execFileSync('node', ['--test', 'scripts/tests/format-dates.test.mjs'],
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }), code: 0 }
    if (runner === 'react')
      // SCOPED to the two files holding the named assertions, because the
      // full suite thirteen times over exceeded a two-minute wall and the run
      // was killed mid-sweep. The FINAL REVERTED RUN below is still the whole
      // suite, so the green claim keeps its full population; only the
      // injection detection is narrowed, and it is narrowed to exactly the
      // files the anchors live in.
      return { out: execFileSync('npm', ['run', '--prefix', 'frontend-react', 'test', '--',
        '--run', 'src/__tests__/account-picker.test.tsx', 'src/__tests__/contact-capabilities.test.tsx'],
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }), code: 0 }
    return { out: execFileSync('node', ['scripts/lead-card-ui/census-timestamps.mjs'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }), code: 0 }
  } catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } }
}

// A census failure is a non-zero RAW count, not an exit code.
const censusRaw = (out) => { const m = /=== R7: \d+ routed, (\d+) RAW ===/.exec(out); return m ? Number(m[1]) : null }

const results = []
for (const inj of INJECTIONS) {
  const abs = join(ROOT, inj.file)
  const before = readFileSync(abs, 'utf8')
  if (!before.includes(inj.find)) {
    console.error(`ANCHOR NOT FOUND for ${inj.id} in ${inj.file} - refusing to guess`)
    rmSync(MARKER); process.exit(2)
  }
  if (before.split(inj.find).length - 1 !== 1) {
    console.error(`ANCHOR NOT UNIQUE for ${inj.id} - refusing`); rmSync(MARKER); process.exit(2)
  }
  writeFileSync(abs, before.replace(inj.find, inj.to))
  const t0 = process.hrtime.bigint()
  const { out, code } = run(inj.runner)
  const ms = Number((process.hrtime.bigint() - t0) / 1000000n)

  let fired, why
  if (inj.runner === 'census') {
    const n = censusRaw(out)
    fired = n !== null && n > 0
    why = n === null ? 'the census did not report a count at all' : `${n} RAW`
  } else {
    // ANCHORED ON THE NAMED ASSERTION. A red run is not enough: an injection
    // that breaks the file kills the run without reaching the check.
    // `node --test` marks a failure with U+2716 HEAVY MULTIPLICATION X. The
    // first version of this matcher listed U+2717 and U+00D7 and missed it,
    // so two injections that DID fire were scored SILENT - Verification 51's
    // caveat exactly: before a silence names an unasserted claim, confirm the
    // matcher saw the failure. Both runners' marks are listed here.
    const failed = out.split('\n').filter((l) => /^\s*(✖|✗|×|not ok|FAIL)/.test(l) || l.includes('FAIL '))
    fired = failed.some((l) => l.includes(inj.expect))
    why = fired ? `"${inj.expect}" failed` : (code === 0 ? 'the suite stayed GREEN' : 'red, but NOT on the named assertion')
  }
  results.push({ id: inj.id, fired, why, ms, code })
  console.log(`  ${fired ? 'FIRED  ' : 'SILENT '} ${inj.id.padEnd(34)} ${String(ms).padStart(6)}ms  ${why}`)

  // RESTORE AND VERIFY, EVERY TIME.
  const snap = readFileSync(join(SNAP, keyFor(inj.file)))
  writeFileSync(abs, snap)
  if (!readFileSync(abs).equals(snap)) {
    console.error(`RESTORE MISMATCH on ${inj.file} after ${inj.id} - STOPPING`); process.exit(2)
  }
}

// ── THE FINAL REVERTED RUN ───────────────────────────────────────────────
console.log('\nthe reverted run, which has been the sole witness to a broken harness four times:')
for (const rel of FILES) {
  if (!readFileSync(join(ROOT, rel)).equals(readFileSync(join(SNAP, keyFor(rel))))) {
    console.error(`  ${rel} DIFFERS from its snapshot`); process.exit(2)
  }
  console.log(`  ${rel} byte-identical`)
}
const pure = run('pure'); const cen = run('census')
const react = (() => { try {
  return { out: execFileSync('npm', ['run', '--prefix', 'frontend-react', 'test'],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }), code: 0 }
} catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } } })()
console.log(`  pure   exit ${pure.code}`)
console.log(`  react  exit ${react.code}  ${/Tests\s+(\d+ passed)/.exec(react.out)?.[1] ?? ''}`)
console.log(`  census RAW ${censusRaw(cen.out)}`)
rmSync(MARKER)

const silent = results.filter((r) => !r.fired)
console.log(`\n${results.length - silent.length}/${results.length} fired`)
if (silent.length) {
  console.log('\nSILENT, and a silence is a finding rather than a pass:')
  for (const s of silent) console.log(`  ${s.id}: ${s.why}`)
}
const green = pure.code === 0 && react.code === 0 && censusRaw(cen.out) === 0
console.log(`\nreverted tree green: ${green}`)
process.exit(silent.length === 0 && green ? 0 : 1)
