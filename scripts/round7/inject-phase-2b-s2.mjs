// Calibration for Round 7 Phase 2b session 2: the six ABSENT capabilities.
//
// Verified-snapshot harness (Verification 44). Matchers anchor on TEST NAMES
// (Verification 51's caveat), and any SILENT verdict is classified by its
// failure count: zero names a missing assertion, non-zero names the matcher.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-2b-s2.mjs <scratch-dir>'); process.exit(2) }
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

const I = 'frontend-react/src/testbed/installer.ts'
const E = 'frontend-react/src/testbed/techTeam.ts'
const V = 'frontend-react/src/testbed/validation.ts'
const D = 'frontend-react/src/testbed/customerDocs.ts'
const N = 'frontend-react/src/testbed/installNotes.ts'
const H = 'frontend-react/src/testbed/history.ts'
const IS = 'frontend-react/src/testbed/InstallSection.tsx'
const DP = 'frontend-react/src/testbed/CustomerDocsPanel.tsx'
const HP = 'frontend-react/src/testbed/HistoryPanel.tsx'

const INJECTIONS = [
  // ── I: installer ─────────────────────────────────────────────────────
  { name: 'I4: the search becomes case-SENSITIVE', file: I,
    find: '    .filter((a) => !t || String(a.payload?.name ?? \'\').toLowerCase().includes(t))',
    replace: '    .filter((a) => !t || String(a.payload?.name ?? \'\').includes(t))',
    expect: 'case-insensitive substring, and an empty term lists rather than hides' },

  { name: 'I4: an empty term hides everything instead of listing', file: I,
    find: '    .filter((a) => !t || String',
    replace: '    .filter((a) => !!t && String',
    expect: 'case-insensitive substring, and an empty term lists rather than hides' },

  { name: 'I4: the eight-result cap goes', file: I,
    find: '    .slice(0, 8)',
    replace: '    .slice(0)',
    expect: 'the result list is capped at eight' },

  { name: 'I3: both install kinds say the same thing', file: I,
    find: "  i.client_installed ? 'Client installs with their own staff' : 'Installed by a contractor'",
    replace: "  'Installed by a contractor'",
    expect: 'client-installed is DERIVED, and both words are said' },

  { name: 'I6: a cleared tech team is reported as a SUCCESS', file: I,
    find: "      kind: 'err',\n      text: 'Installer changed.",
    replace: "      kind: 'ok',\n      text: 'Installer changed.",
    expect: 'a cleared tech team is reported as an ERROR, not a success' },

  { name: 'I6: the clearing is not reported at all', file: I,
    find: '  if (data?.cleared_tech_team) {',
    replace: '  if (false) {',
    expect: 'a cleared tech team is reported as an ERROR, not a success' },

  // ── E: tech team ─────────────────────────────────────────────────────
  { name: 'E2: a select is offered with NO installer', file: E,
    find: '  if (!installer) {',
    replace: '  if (false) {',
    expect: 'NO INSTALLER means NO CONTROL' },

  { name: 'E3: the empty-contacts case collapses into the no-installer one', file: E,
    find: '    placeholder: contacts.length ? \'Select a contact\' : `No Contacts at ${who} yet`,',
    replace: '    placeholder: \'Select a contact\',',
    expect: 'an installer with NO contacts still renders the select, saying so' },

  { name: 'E4: the source Account is not named', file: E,
    find: '    source: `From ${who}`,',
    replace: '    source: undefined,',
    expect: 'the source Account is named under the control' },

  // ── V: validation ────────────────────────────────────────────────────
  { name: 'V2: an EMPTY field becomes a problem', file: V,
    find: "  if (String(raw ?? '').trim() === '') return null",
    replace: "  if (String(raw ?? '').trim() === '') return 'must be a number'",
    expect: 'an EMPTY field is not-set, which is legitimate' },

  { name: 'V3: THE NEGATIVE REFUSAL GOES, which is the half the guard lacks', file: V,
    find: "  if (n < 0) return 'cannot be negative'",
    replace: '  if (false) return null',
    expect: 'a NEGATIVE is refused, which the keystroke guard alone does not do' },

  { name: 'V2: the whole-number rule stops reading the field\'s own flag', file: V,
    find: "  if (f.integer && !Number.isInteger(n)) return 'must be a whole number'",
    replace: "  if (!Number.isInteger(n)) return 'must be a whole number'",
    expect: 'a decimal is fine where the field is not an integer field' },

  { name: 'V4: the message loses its full stop', file: V,
    find: "  return [...invalid.values()].join('. ') + '.'",
    replace: "  return [...invalid.values()].join('. ')",
    expect: 'the message is label plus problem, joined across fields' },

  { name: 'V4: an empty map produces an empty message rather than none', file: V,
    find: '  if (!invalid.size) return null',
    replace: "  if (!invalid.size) return ''",
    expect: 'no invalid fields produces NO message rather than an empty stop' },

  { name: 'V5: the banner ownership marker changes, so it clears other messages', file: V,
    find: "export const VALIDATION_OWNER = 'validation'",
    replace: "export const VALIDATION_OWNER = 'msg-error'",
    expect: 'the banner is OWNED' },

  // ── D: customer documents ────────────────────────────────────────────
  { name: 'D4: only the NAME is required', file: D,
    find: '  if (!n || !u) return',
    replace: '  if (!n) return',
    expect: 'both a name and a link are required, and the words say both' },

  { name: 'D4: the values are not trimmed, so whitespace passes', file: D,
    find: "  const n = String(name ?? '').trim()\n  const u = String(url ?? '').trim()",
    replace: "  const n = String(name ?? '')\n  const u = String(url ?? '')",
    expect: 'both a name and a link are required, and the words say both' },

  { name: 'D3: the remove route keys on the name instead of the id', file: D,
    find: 'export const customerDocRoute = (id: string, docId: string) =>\n  `${CUSTOMER_DOCS_ROUTE(id)}/${docId}`',
    replace: 'export const customerDocRoute = (id: string, _docId: string) =>\n  `${CUSTOMER_DOCS_ROUTE(id)}/by-name`',
    expect: 'removal is keyed on the row ID, never the name' },

  // ── N: install notes ─────────────────────────────────────────────────
  { name: 'N2: a note is APPENDED, so the list stops being newest first', file: N,
    find: '  return [{ text: t, at, by, ...(stage ? { stage } : {}) }, ...list]',
    replace: '  return [...list, { text: t, at, by, ...(stage ? { stage } : {}) }]',
    expect: 'a note is prepended, so the list is NEWEST FIRST' },

  { name: 'N3: a blank note is written', file: N,
    find: '  if (!t) return null',
    replace: '  if (false) return null',
    expect: 'a blank note is not written at all' },

  // ── H: history ───────────────────────────────────────────────────────
  { name: 'H2: THE CLIENT RE-SORTS, becoming a second reader of the order', file: H,
    find: '  return entries.map((e, i) => ({',
    replace: '  return [...entries].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).map((e, i) => ({',
    expect: 'a list the client would sort DIFFERENTLY is still left alone' },

  { name: 'H5: an empty detail prints braces', file: H,
    find: '    detail: e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : \'\',',
    replace: '    detail: e.detail ? JSON.stringify(e.detail) : \'\',',
    expect: 'an EMPTY detail object renders as nothing, not as {}' },

  { name: 'H5: the timestamp keeps its T and its seconds', file: H,
    find: "    when: String(e.timestamp ?? '').slice(0, 16).replace('T', ' '),",
    replace: "    when: String(e.timestamp ?? ''),",
    expect: 'four columns, with the timestamp cut to minutes' },

  { name: 'H4: the count stops being singular-aware', file: H,
    find: "export const historyCount = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}.`",
    replace: 'export const historyCount = (n: number) => `${n} entries.`',
    expect: 'the count is singular-aware' },

  // ── the rendered halves ──────────────────────────────────────────────
  { name: 'I2: Cancel is offered with no installer to cancel back to', file: IS,
    find: '              {p.installer\n                ? <button type="button" className="btn-sm" data-testid="tb-installer-cancel"',
    replace: '              {true\n                ? <button type="button" className="btn-sm" data-testid="tb-installer-cancel"',
    expect: 'with none set the SEARCH is the row, and there is nothing to cancel to' },

  { name: 'I5: every result is marked as the record\'s own Account', file: IS,
    find: '                      {a.id === p.ownAccountId',
    replace: '                      {true',
    expect: "the record's OWN Account is marked in the results" },

  { name: 'E5: the placeholder CLEARS the tech team', file: IS,
    find: '                  if (!e.target.value) return',
    replace: '                  // cleared',
    expect: 'choosing the PLACEHOLDER is a no-op, not a clear' },

  { name: 'D5: a refused add clears the boxes anyway', file: DP,
    find: '            if (ok) { setName(\'\'); setUrl(\'\') } else { setError(\'Could not add the document.\') }',
    replace: '            setName(\'\'); setUrl(\'\'); if (!ok) setError(\'Could not add the document.\')',
    expect: 'a REFUSED add keeps the typing' },

  { name: 'D6: the link loses its rel, so the new tab can reach back', file: DP,
    find: '                  target="_blank" rel="noopener noreferrer"',
    replace: '                  target="_blank"',
    expect: 'the link opens in a new tab, safely' },

  { name: 'H6: a failed load still carries the notice', file: HP,
    find: '    return <p className="empty-state" data-testid="tb-history-block">Unable to load history.</p>',
    replace: '    return <div data-testid="tb-history-block"><p className="sub" data-testid="tb-history-notice">{HISTORY_NOTICE}</p><p>Unable to load history.</p></div>',
    expect: 'a FAILED load says so and drops the notice' },

  { name: 'H3: the notice is dropped from the EMPTY state', file: HP,
    find: '      <p className="sub" data-testid="tb-history-notice">{HISTORY_NOTICE}</p>\n      {rows.length',
    replace: '      {rows.length ? <p className="sub" data-testid="tb-history-notice">{HISTORY_NOTICE}</p> : null}\n      {rows.length',
    expect: 'the notice renders above the EMPTY state too' },
]

const SUITES = [
  'src/__tests__/testbed-absent-six.test.ts',
  'src/__tests__/testbed-absent-six-surface.test.tsx',
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
